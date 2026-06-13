import type {
  CatalogAnalyticsInsightsDto,
  HealthResponseDto,
} from "@retailer-search/shared-types";
import { getSearchApiUrl } from "../../lib/search-api-url";
import { AdminPageHeader } from "../admin-page-header";
import { ProductsWorkspace } from "../../products-workspace";

const EMPTY_INSIGHTS: CatalogAnalyticsInsightsDto = {
  topProducts: [],
  topBrands: [],
  topQueries: [],
  topCategories: [],
};

async function fetchCatalogInsights(): Promise<CatalogAnalyticsInsightsDto> {
  const response = await fetch(
    `${getSearchApiUrl()}/api/v1/admin/analytics/catalog-insights`,
    { cache: "no-store" },
  );

  if (!response.ok) {
    return EMPTY_INSIGHTS;
  }

  return (await response.json()) as CatalogAnalyticsInsightsDto;
}

async function fetchCatalogHealth(): Promise<{
  productCount: number;
  catalogSource: "database" | "generated-json" | "empty";
}> {
  const response = await fetch(`${getSearchApiUrl()}/health`, { cache: "no-store" });
  if (!response.ok) {
    return { productCount: 0, catalogSource: "empty" };
  }

  const payload = (await response.json()) as HealthResponseDto;

  return {
    productCount: payload.database?.productCount ?? 0,
    catalogSource: payload.database?.catalogSource ?? "empty",
  };
}

export default async function AdminProductsPage() {
  const [insights, catalogHealth] = await Promise.all([
    fetchCatalogInsights(),
    fetchCatalogHealth(),
  ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        description="Search the catalog, inspect ranking results, and review the most searched products, brands, queries, and categories."
      />

      <ProductsWorkspace
        insights={insights}
        productCount={catalogHealth.productCount}
        catalogSource={catalogHealth.catalogSource}
      />
    </>
  );
}
