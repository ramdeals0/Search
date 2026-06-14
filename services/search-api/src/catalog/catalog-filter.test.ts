import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductDocument } from "@retailer-search/shared-types";
import { filterProductCatalogByCatalogId } from "../catalog-store.js";

function product(id: string, catalogId?: string): ProductDocument {
  return {
    id,
    sku: id,
    title: id,
    brand: "Brand",
    category: "Category",
    subcategory: "Sub",
    description: "desc",
    price: 10,
    inventory: 1,
    inStock: true,
    attributes: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    catalogId,
  };
}

describe("filterProductCatalogByCatalogId", () => {
  it("returns default-catalog products for the default storefront", () => {
    const products = [
      product("prod-1", "default"),
      product("prod-2"),
      product("lux-1", "luxury-clothing"),
    ];

    const scoped = filterProductCatalogByCatalogId(products, "default");
    assert.deepEqual(
      scoped.map((entry) => entry.id),
      ["prod-1", "prod-2"],
    );
  });

  it("returns only luxury products for the luxury storefront", () => {
    const products = [
      product("prod-1", "default"),
      product("lux-1", "luxury-clothing"),
      product("lux-2", "luxury-clothing"),
    ];

    const scoped = filterProductCatalogByCatalogId(products, "luxury-clothing");
    assert.deepEqual(
      scoped.map((entry) => entry.id),
      ["lux-1", "lux-2"],
    );
  });
});
