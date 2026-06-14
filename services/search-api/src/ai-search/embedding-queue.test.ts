import assert from "node:assert/strict";
import test from "node:test";
import {
  getEmbeddingWorkerRuntimeConfig,
  getRerankRuntimeConfig,
  getVectorSearchRuntimeConfig,
  vectorDistanceOperator,
  vectorScoreSql,
} from "./vector-config.js";

test("vector config defaults to HNSW cosine on Railway-friendly settings", () => {
  const config = getVectorSearchRuntimeConfig();
  assert.equal(config.pgvectorEnabled, true);
  assert.equal(config.distanceMetric, "cosine");
  assert.equal(config.indexType, "hnsw");
  assert.ok(config.queryProbes >= 1);
  assert.ok(config.queryEfSearch >= 1);
});

test("vector distance operator maps cosine to <=>", () => {
  assert.equal(vectorDistanceOperator("cosine"), "<=>");
  assert.match(vectorScoreSql("<=>"), /1 - /);
});

test("embedding worker config exposes poll and retry settings", () => {
  const config = getEmbeddingWorkerRuntimeConfig();
  assert.ok(config.pollMs >= 500);
  assert.ok(config.maxRetries >= 1);
  assert.ok(config.workerId.length > 0);
});

test("rerank config defaults to off unless RERANK_ENABLED", () => {
  const previous = process.env.RERANK_ENABLED;
  delete process.env.RERANK_ENABLED;
  const config = getRerankRuntimeConfig();
  assert.equal(config.enabled, false);
  if (previous !== undefined) {
    process.env.RERANK_ENABLED = previous;
  }
});

test("content hash dedupe skips unchanged canonical text", async () => {
  const { buildCanonicalProductText, hashCanonicalText } = await import(
    "./canonical-product-text.js"
  );
  const text = buildCanonicalProductText({
    id: "p1",
    sku: "SKU-1",
    title: "Hammer",
    brand: "BuildCo",
    category: "Tools",
    subcategory: "Hand",
    description: "Steel claw hammer",
    price: 19,
    inventory: 20,
    inStock: true,
    attributes: { weight: "16oz" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const hashA = hashCanonicalText(text);
  const hashB = hashCanonicalText(text);
  assert.equal(hashA, hashB);
});
