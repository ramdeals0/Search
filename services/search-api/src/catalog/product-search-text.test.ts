import assert from "node:assert/strict";
import test from "node:test";
import { buildProductSearchText } from "./product-search-text.js";

test("buildProductSearchText includes description and searchable attributes", () => {
  const text = buildProductSearchText({
    id: "p1",
    sku: "SKU-DRILL-001",
    title: "RidgeLine 20V Drill Kit",
    brand: "RidgeLine Tools",
    category: "Power Tools",
    subcategory: "Cordless Drills",
    description:
      "Brushless cordless drill for deck building and framing. Specifications include voltage 20V, chuck size 1/2 in.",
    price: 179.99,
    inventory: 12,
    inStock: true,
    attributes: {
      voltage: "20V",
      chuckSize: "1/2 in",
      useCases: ["deck building", "framing"],
      searchCriteria: ["cordless drill", "battery drill", "20v"],
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  assert.match(text, /deck building/i);
  assert.match(text, /20V/i);
  assert.match(text, /cordless drill/i);
  assert.match(text, /SKU-DRILL-001/);
});
