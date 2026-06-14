import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProductDocument } from "@retailer-search/shared-types";
import type { QueryAnalyticsRow } from "./analytics-store.js";
import { generateRuleSuggestions } from "./suggestion-engine.js";
import { addSynonym } from "./synonyms.js";

const sampleProduct: ProductDocument = {
  id: "prod-001",
  sku: "SKU-001",
  title: "Cordless Drill Kit",
  brand: "RidgeLine Tools",
  category: "Power Tools",
  subcategory: "Drills",
  description: "Drill kit",
  price: 99.99,
  inventory: 10,
  inStock: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  attributes: {},
};

function buildParams(rows: QueryAnalyticsRow[]) {
  return {
    queryAnalytics: rows,
    rules: [],
    products: [sampleProduct],
  };
}

describe("generateRuleSuggestions", () => {
  it("omits zero-result synonym suggestions when staging synonym exists", () => {
    const query = "shop vav";
    const rows: QueryAnalyticsRow[] = [
      {
        query,
        displayQuery: query,
        searches: 5,
        clicks: 0,
        ctr: 0,
        zeroResults: 5,
      },
    ];

    const before = generateRuleSuggestions(buildParams(rows));
    assert.ok(
      before.some((suggestion) => suggestion.type === "add_synonym" && suggestion.query === query),
      "expected add_synonym suggestion before synonym is created",
    );

    addSynonym(query, "shop vac");

    const after = generateRuleSuggestions(buildParams(rows));
    assert.equal(
      after.some((suggestion) => suggestion.query === query),
      false,
      "expected no suggestions for query after synonym is created",
    );
  });

  it("omits improve_zero_results and expand_catalog when synonym exists", () => {
    const query = "mystery term";
    const rows: QueryAnalyticsRow[] = [
      {
        query,
        displayQuery: query,
        searches: 4,
        clicks: 0,
        ctr: 0,
        zeroResults: 4,
      },
    ];

    addSynonym(query, "drill");

    const suggestions = generateRuleSuggestions(buildParams(rows));
    assert.equal(suggestions.length, 0);
  });
});
