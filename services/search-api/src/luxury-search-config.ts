import type { MerchandisingRule } from "@retailer-search/shared-types";

export const LUXURY_CATALOG_ID = "luxury-clothing";

export const LUXURY_SYNONYM_GROUPS: Array<{ terms: [string, string] }> = [
  { terms: ["handbag", "purse"] },
  { terms: ["sneakers", "trainers"] },
  { terms: ["loafers", "dress shoes"] },
  { terms: ["cashmere sweater", "cashmere knit"] },
  { terms: ["evening gown", "formal dress"] },
  { terms: ["trench coat", "raincoat"] },
  { terms: ["silk scarf", "headscarf"] },
  { terms: ["designer jeans", "premium denim"] },
  { terms: ["two piece suit", "business suit"] },
  { terms: ["leather jacket", "biker jacket"] },
  { terms: ["swiss watch", "luxury watch"] },
  { terms: ["gold necklace", "pendant necklace"] },
  { terms: ["sunglasses", "designer eyewear"] },
  { terms: ["clutch bag", "evening bag"] },
  { terms: ["wool coat", "overcoat"] },
];

export function buildLuxurySynonymMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of LUXURY_SYNONYM_GROUPS) {
    const [left, right] = group.terms;
    map[left] = right;
    map[right] = left;
  }
  return map;
}

export const LUXURY_RULE_ID_PREFIX = "rule-lux-";

export function isLuxuryMerchandisingRule(rule: { id: string }): boolean {
  return rule.id.startsWith(LUXURY_RULE_ID_PREFIX);
}

export function buildLuxuryMerchandisingRules(): MerchandisingRule[] {
  return [];
}

export function stripLuxuryMerchandisingRules(rules: MerchandisingRule[]): MerchandisingRule[] {
  return rules.filter((rule) => !isLuxuryMerchandisingRule(rule));
}

export function getLuxuryRuleCounts(): Record<string, number> {
  const rules = buildLuxuryMerchandisingRules();
  const synonyms = buildLuxurySynonymMap();
  return {
    luxuryMerchandisingRules: rules.length,
    luxurySynonyms: Object.keys(synonyms).length,
    luxuryPinRules: rules.filter((rule) => rule.action === "pin").length,
    luxuryBoostRules: rules.filter((rule) => rule.action === "boost").length,
    luxuryBuryRules: rules.filter((rule) => rule.action === "bury").length,
  };
}
