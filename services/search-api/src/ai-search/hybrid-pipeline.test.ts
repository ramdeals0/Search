import assert from "node:assert/strict";
import test from "node:test";
import { fuseRetrievalCandidates, sortFusedCandidates } from "./candidate-fusion.js";
import { unifiedRerankCandidates } from "./unified-rerank.js";
import { getDefaultAiRankingConfig } from "./ai-ranking-config-store.js";
import type { ProductDocument } from "@retailer-search/shared-types";

const products: ProductDocument[] = [
  {
    id: "p1",
    sku: "SKU-1",
    title: "Cordless Drill",
    brand: "RapidDrive",
    category: "Tools",
    subcategory: "Drills",
    description: "20V drill",
    price: 99,
    inventory: 5,
    inStock: true,
    attributes: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "p2",
    sku: "SKU-2",
    title: "Impact Driver",
    brand: "RapidDrive",
    category: "Tools",
    subcategory: "Drivers",
    description: "Compact driver",
    price: 79,
    inventory: 3,
    inStock: true,
    attributes: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

test("fuseRetrievalCandidates merges lexical and semantic without duplicates", () => {
  const fused = fuseRetrievalCandidates({
    lexicalHits: [
      {
        ...products[0],
        score: 80,
        rankingDebug: {
          productId: "p1",
          baseScore: 50,
          exactMatchScore: 10,
          inventoryScore: 5,
          popularityScore: 5,
          merchandisingAdjustment: 10,
          finalScore: 80,
          appliedRuleNames: ["boost-tools"],
        },
      },
    ],
    semanticHits: [
      { productId: "p1", score: 0.9 },
      { productId: "p2", score: 0.7 },
    ],
  });

  assert.equal(fused.length, 2);
  const p1 = fused.find((entry) => entry.productId === "p1");
  assert.ok(p1);
  assert.deepEqual(p1?.retrievalSources.sort(), ["lexical", "semantic"]);
  assert.ok((p1?.semanticScore ?? 0) > 0);
  assert.ok((p1?.lexicalScore ?? 0) > 0);

  const p2 = fused.find((entry) => entry.productId === "p2");
  assert.ok(p2);
  assert.deepEqual(p2?.retrievalSources, ["semantic"]);
});

test("sortFusedCandidates orders by combined normalized score", () => {
  const fused = fuseRetrievalCandidates({
    lexicalHits: [{ ...products[0], score: 10 }],
    semanticHits: [{ productId: "p2", score: 0.95 }],
    lexicalMax: 100,
    semanticMax: 1,
  });
  const sorted = sortFusedCandidates(fused);
  assert.equal(sorted[0]?.productId, "p2");
});

test("unifiedRerankCandidates produces fused and rerank scores", async () => {
  const config = getDefaultAiRankingConfig();
  config.weights = {
    lexicalWeight: 0.6,
    semanticWeight: 0.4,
    personalizationWeight: 0,
  };

  const fused = fuseRetrievalCandidates({
    lexicalHits: [{ ...products[0], score: 100 }],
    semanticHits: [{ productId: "p2", score: 0.8 }],
  });

  const ranked = await unifiedRerankCandidates({
    query: "drill",
    fused,
    products,
    config,
    personalizationScores: new Map(),
    rerankConfig: { enabled: true, provider: "score_fusion", topN: 10, timeoutMs: 100 },
  });

  assert.equal(ranked.length, 2);
  for (const entry of ranked) {
    assert.ok(entry.fusedScore >= 0 && entry.fusedScore <= 1);
    assert.ok(entry.rerankScore >= 0 && entry.rerankScore <= 1);
    assert.ok(entry.retrievalSources.length >= 1);
  }
});

test("unifiedRerankCandidates fail-open when rerank provider disabled", async () => {
  const config = getDefaultAiRankingConfig();
  const fused = fuseRetrievalCandidates({
    lexicalHits: [{ ...products[0], score: 50 }],
    semanticHits: [],
  });

  const ranked = await unifiedRerankCandidates({
    query: "drill",
    fused,
    products,
    config,
    personalizationScores: new Map(),
    rerankConfig: { enabled: false, provider: "off", topN: 10, timeoutMs: 100 },
  });

  assert.equal(ranked[0]?.productId, "p1");
  assert.ok((ranked[0]?.fusedScore ?? 0) <= (ranked[0]?.rerankScore ?? 0));
});
