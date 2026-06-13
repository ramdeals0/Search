/**
 * @deprecated Products are loaded from Postgres via catalog-store.ts at API startup.
 */
export { getProductCatalog as seedProducts } from "./catalog-store.js";
