import type { EnvironmentKey, ISODateString, TopQueryDto } from "./index.js";

export interface DiscoveryTrendingResponseDto {
  generatedAt: ISODateString;
  windowDays: number;
  queries: TopQueryDto[];
}

export interface DiscoveryRecentQueryDto {
  query: string;
  searchedAt: ISODateString;
}

export interface DiscoveryRecentResponseDto {
  sessionId: string;
  queries: DiscoveryRecentQueryDto[];
}

export type SearchContentModuleType = "banner" | "category_rail" | "message";

export interface SearchContentModuleDto {
  id: string;
  name: string;
  active: boolean;
  environment: EnvironmentKey;
  moduleType: SearchContentModuleType;
  priority: number;
  condition: {
    query?: string;
    brand?: string;
    category?: string;
  };
  content: {
    title?: string;
    body?: string;
    href?: string;
    category?: string;
  };
}

export interface SearchContentModuleListResponseDto {
  total: number;
  modules: SearchContentModuleDto[];
}

export interface AdminProductListResponseDto {
  total: number;
  products: Array<{
    id: string;
    sku: string;
    title: string;
    brand: string;
    category: string;
    subcategory: string;
    price: number;
    inStock: boolean;
  }>;
}

export interface UpdateAdminProductRequestDto {
  title?: string;
  description?: string;
  price?: number;
  inventory?: number;
  inStock?: boolean;
}

export interface CatalogCsvImportResultDto {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface RuleConflictItemDto {
  query: string;
  ruleId: string;
  ruleName: string;
  action: string;
  priority: number;
  overlapReason: string;
}

export interface RuleConflictReportDto {
  query: string;
  environment: EnvironmentKey;
  conflicts: RuleConflictItemDto[];
}

export type CommerceEventType = "add_to_cart" | "purchase";

export interface RecordCommerceEventRequestDto {
  type: CommerceEventType;
  query?: string;
  productId?: string;
  amountCents?: number;
}

export interface RevenueMetricsDto {
  windowDays: number;
  purchaseCount: number;
  addToCartCount: number;
  revenueCents: number;
  revenuePerSearch: number;
  searchesInWindow: number;
}

export interface OnlineExperimentStatusDto {
  experimentId: string;
  name: string;
  onlineEnabled: boolean;
  assignedArm: "baseline" | "candidate" | null;
  trafficPercent: number;
}

export interface SearchContentModuleHitDto {
  id: string;
  moduleType: SearchContentModuleType;
  title?: string;
  body?: string;
  href?: string;
  category?: string;
}
