import assert from "node:assert/strict";
import test from "node:test";
import {
  computeCommercialPriorityBoost,
  computeInventoryScore,
  computeProfitMarginScore,
  resolveProfitMarginPercent,
} from "@retailer-search/search-core";
import type { ProductDocument } from "@retailer-search/shared-types";

const baseProduct: ProductDocument = {
  id: "p1",
  sku: "SKU-1",
  title: "Cordless Drill",
  brand: "RidgeLine Tools",
  category: "Tools",
  subcategory: "Drills",
  description: "20V drill",
  price: 100,
  inventory: 40,
  inStock: true,
  unitCost: 65,
  profitMarginPercent: 35,
  attributes: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("resolveProfitMarginPercent derives margin from unit cost when needed", () => {
  assert.equal(resolveProfitMarginPercent(baseProduct), 35);
  assert.equal(
    resolveProfitMarginPercent({
      ...baseProduct,
      profitMarginPercent: undefined,
      unitCost: undefined,
      attributes: { unitCost: 80 },
    }),
    20,
  );
});

test("commercial scores prioritize in-stock high-margin products", () => {
  assert.equal(computeInventoryScore(baseProduct), 2);
  assert.ok(Math.abs(computeProfitMarginScore(baseProduct) - 4.2) < 0.001);
  assert.ok(computeCommercialPriorityBoost(baseProduct) > 0);

  const outOfStock = { ...baseProduct, inStock: false, inventory: 0 };
  assert.equal(computeInventoryScore(outOfStock), 0);
  assert.equal(computeProfitMarginScore(outOfStock), 0);
  assert.equal(computeCommercialPriorityBoost(outOfStock), 0);
});
