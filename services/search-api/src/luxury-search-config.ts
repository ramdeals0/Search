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

export function buildLuxuryMerchandisingRules(): MerchandisingRule[] {
  return [
    {
      id: "rule-lux-pin-silk-dress",
      name: "Pin signature silk dress for silk dress searches",
      active: true,
      priority: 130,
      action: "pin",
      condition: { query: "silk dress" },
      productIds: ["lux-prod-hero-001"],
    },
    {
      id: "rule-lux-pin-cashmere-coat",
      name: "Pin cashmere coat hero for cashmere coat searches",
      active: true,
      priority: 128,
      action: "pin",
      condition: { query: "cashmere coat" },
      productIds: ["lux-prod-hero-002"],
    },
    {
      id: "rule-lux-pin-handbag",
      name: "Pin leather handbag for handbag searches",
      active: true,
      priority: 126,
      action: "pin",
      condition: { query: "handbag" },
      productIds: ["lux-prod-hero-003"],
    },
    {
      id: "rule-lux-pin-purse",
      name: "Pin evening clutch for purse synonym searches",
      active: true,
      priority: 125,
      action: "pin",
      condition: { query: "purse" },
      productIds: ["lux-prod-hero-004"],
    },
    {
      id: "rule-lux-boost-gucci-women",
      name: "Boost Gucci womenswear for designer dress searches",
      active: true,
      priority: 120,
      action: "boost",
      condition: { query: "designer dress", category: "Women" },
      brand: "Gucci",
      boostAmount: 32,
    },
    {
      id: "rule-lux-boost-hermes-accessories",
      name: "Boost Hermès accessories for leather searches",
      active: true,
      priority: 118,
      action: "boost",
      condition: { query: "leather", category: "Accessories" },
      brand: "Hermès",
      boostAmount: 30,
    },
    {
      id: "rule-lux-boost-mens-suits",
      name: "Boost tailored suits for suit searches",
      active: true,
      priority: 115,
      action: "boost",
      condition: { query: "suit", category: "Men" },
      boostAmount: 28,
    },
    {
      id: "rule-lux-boost-instock-loafers",
      name: "Boost in-stock loafers for loafer searches",
      active: true,
      priority: 112,
      action: "boost",
      condition: { query: "loafer", inStock: true },
      boostAmount: 26,
    },
    {
      id: "rule-lux-bury-oos-handbags",
      name: "Bury out-of-stock handbags",
      active: true,
      priority: 110,
      action: "bury",
      condition: { query: "handbag", inStock: false },
      buryAmount: 40,
    },
    {
      id: "rule-lux-pin-evening-gown",
      name: "Pin evening gown for formal dress searches",
      active: true,
      priority: 108,
      action: "pin",
      condition: { query: "evening gown" },
      productIds: ["lux-prod-hero-005"],
    },
    {
      id: "rule-lux-boost-cartier-jewelry",
      name: "Boost Cartier for gold necklace searches",
      active: true,
      priority: 105,
      action: "boost",
      condition: { query: "gold necklace", category: "Accessories" },
      brand: "Cartier",
      boostAmount: 34,
    },
    {
      id: "rule-lux-boost-leather-jacket",
      name: "Boost leather jackets in mens outerwear",
      active: true,
      priority: 102,
      action: "boost",
      condition: { query: "leather jacket", category: "Men" },
      boostAmount: 27,
    },
    {
      id: "rule-lux-pin-swiss-watch",
      name: "Pin Swiss watch hero for luxury watch searches",
      active: true,
      priority: 100,
      action: "pin",
      condition: { query: "luxury watch" },
      productIds: ["lux-prod-hero-006"],
    },
    {
      id: "rule-lux-boost-saint-laurent-denim",
      name: "Boost Saint Laurent denim",
      active: true,
      priority: 98,
      action: "boost",
      condition: { query: "designer jeans" },
      brand: "Saint Laurent",
      boostAmount: 24,
    },
    {
      id: "rule-lux-bury-oos-sneakers",
      name: "Bury out-of-stock sneakers",
      active: true,
      priority: 95,
      action: "bury",
      condition: { query: "sneakers", inStock: false },
      buryAmount: 35,
    },
    {
      id: "rule-lux-pin-cashmere-sweater",
      name: "Pin cashmere sweater hero",
      active: true,
      priority: 92,
      action: "pin",
      condition: { query: "cashmere sweater" },
      productIds: ["lux-prod-hero-007"],
    },
    {
      id: "rule-lux-boost-burberry-coat",
      name: "Boost Burberry outerwear for trench coat searches",
      active: true,
      priority: 90,
      action: "boost",
      condition: { query: "trench coat", category: "Women" },
      brand: "Burberry",
      boostAmount: 30,
    },
    {
      id: "rule-lux-pin-designer-sunglasses",
      name: "Pin designer sunglasses hero",
      active: true,
      priority: 88,
      action: "pin",
      condition: { query: "designer eyewear" },
      productIds: ["lux-prod-hero-008"],
    },
  ];
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
