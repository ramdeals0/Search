import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanonicalProductText,
  hashCanonicalText,
} from "./canonical-product-text.js";
import {
  buildMockEmbedding,
  cosineSimilarity,
  getEmbeddingCredentialsStatus,
  isEmbeddingsProviderReady,
  normalizeVector,
} from "./embedding-provider.js";
import { normalizeWeights } from "./ai-ranking-config-store.js";

test("buildCanonicalProductText includes title brand and category", () => {
  const text = buildCanonicalProductText({
    id: "p1",
    sku: "SKU-1",
    title: "Cordless Drill Kit",
    brand: "RapidDrive",
    category: "Power Tools",
    subcategory: "Drills",
    description: "20V brushless drill for home projects.",
    price: 129,
    inventory: 10,
    inStock: true,
    attributes: {
      voltage: "20V",
      useCases: ["deck building", "framing"],
      searchCriteria: ["cordless drill", "battery drill"],
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.match(text, /Cordless Drill Kit/);
  assert.match(text, /RapidDrive/);
  assert.match(text, /Power Tools > Drills/);
  assert.match(text, /20V/);
  assert.match(text, /deck building/);
  assert.match(text, /cordless drill/);
});

test("buildCanonicalProductText prioritizes aiSearchBlurb and keywords", () => {
  const text = buildCanonicalProductText({
    id: "p2",
    sku: "SKU-2",
    title: "Wet Dry Shop Vacuum",
    brand: "IronPeak",
    category: "Tools",
    subcategory: "Vacuums",
    description: "Compact utility vacuum.",
    price: 99,
    inventory: 10,
    inStock: true,
    attributes: {
      aiSearchBlurb:
        "Heavy-duty shop vac for garage cleanup, wet spills, and workshop dust collection.",
      keywords: ["shop vac", "wet dry vacuum"],
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.match(text, /Heavy-duty shop vac/);
  assert.match(text, /Keywords: shop vac, wet dry vacuum/);
});

test("hashCanonicalText is stable", () => {
  const hashA = hashCanonicalText("hello world");
  const hashB = hashCanonicalText("hello world");
  assert.equal(hashA, hashB);
});

test("mock embeddings are normalized and comparable", () => {
  const left = buildMockEmbedding("cordless drill", 64);
  const right = buildMockEmbedding("cordless drill kit", 64);
  assert.ok(cosineSimilarity(left, right) > 0.2);
  assert.equal(left.length, 64);
  const norm = Math.sqrt(left.reduce((sum: number, value: number) => sum + value * value, 0));
  assert.ok(Math.abs(norm - 1) < 0.001);
});

test("normalizeWeights sums to one", () => {
  const weights = normalizeWeights({
    lexicalWeight: 2,
    semanticWeight: 1,
    personalizationWeight: 1,
  });
  const total =
    weights.lexicalWeight + weights.semanticWeight + weights.personalizationWeight;
  assert.ok(Math.abs(total - 1) < 0.0001);
});

test("normalizeVector handles zero vector", () => {
  const vector = normalizeVector([0, 0, 0]);
  assert.deepEqual(vector, [0, 0, 0]);
});

test("openrouter embeddings require an API key to be ready", () => {
  const credentials = {
    ...getEmbeddingCredentialsStatus(),
    openrouterConfigured: false,
    embeddingsApiKeyConfigured: false,
  };

  assert.equal(isEmbeddingsProviderReady("mock", credentials), true);
  assert.equal(isEmbeddingsProviderReady("openrouter", credentials), false);
  assert.equal(
    isEmbeddingsProviderReady("openrouter", {
      ...credentials,
      openrouterConfigured: true,
    }),
    true,
  );
});
