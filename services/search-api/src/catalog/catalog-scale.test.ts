import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CATALOG_PRODUCTS,
  CATALOG_IN_MEMORY_THRESHOLD,
  shouldUseDatabaseCatalogMode,
  readTargetProductCount,
} from "./catalog-scale-config.js";

test("MAX_CATALOG_PRODUCTS supports 80 million", () => {
  assert.equal(MAX_CATALOG_PRODUCTS, 80_000_000);
});

test("shouldUseDatabaseCatalogMode switches above in-memory threshold", () => {
  assert.equal(shouldUseDatabaseCatalogMode(CATALOG_IN_MEMORY_THRESHOLD), false);
  assert.equal(shouldUseDatabaseCatalogMode(CATALOG_IN_MEMORY_THRESHOLD + 1), true);
  assert.equal(shouldUseDatabaseCatalogMode(80_000_000), true);
});

test("readTargetProductCount defaults to 35k when unset", () => {
  const previous = process.env.TARGET_PRODUCT_COUNT;
  const previousSeed = process.env.SEED_PRODUCT_COUNT;
  delete process.env.TARGET_PRODUCT_COUNT;
  delete process.env.SEED_PRODUCT_COUNT;
  assert.equal(readTargetProductCount(), 35_000);
  if (previous === undefined) {
    delete process.env.TARGET_PRODUCT_COUNT;
  } else {
    process.env.TARGET_PRODUCT_COUNT = previous;
  }
  if (previousSeed === undefined) {
    delete process.env.SEED_PRODUCT_COUNT;
  } else {
    process.env.SEED_PRODUCT_COUNT = previousSeed;
  }
});

test("readTargetProductCount caps at MAX_CATALOG_PRODUCTS", () => {
  const previous = process.env.TARGET_PRODUCT_COUNT;
  process.env.TARGET_PRODUCT_COUNT = "999999999";
  assert.equal(readTargetProductCount(), MAX_CATALOG_PRODUCTS);
  if (previous === undefined) {
    delete process.env.TARGET_PRODUCT_COUNT;
  } else {
    process.env.TARGET_PRODUCT_COUNT = previous;
  }
});
