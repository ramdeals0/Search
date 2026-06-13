/** Re-export demo search config from the runtime module (single source of truth). */
export {
  buildDemoMerchandisingRules,
  buildSynonymMap,
  DEMO_HERO_QUERIES,
  DEMO_QUERY_CATEGORY_HINTS,
  DEMO_SYNONYM_GROUPS,
  DEMO_TYPO_CORRECTIONS,
  DEMO_ZERO_RESULT_FALLBACKS,
  getDemoRuleCounts,
} from "../../src/demo-search-config.js";

export type {
  HeroDemoQuery,
  QueryCategoryHint,
  SynonymGroup,
} from "../../src/demo-search-config.js";
