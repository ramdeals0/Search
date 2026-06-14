import type { ApiKeyDto, ISODateString } from "./index.js";

export interface CatalogDto {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description?: string;
  isDefault: boolean;
  active: boolean;
  productCount?: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface CatalogListResponseDto {
  total: number;
  catalogs: CatalogDto[];
}

export interface CreateCatalogRequestDto {
  tenantId?: string;
  slug: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface UpdateCatalogRequestDto {
  name?: string;
  description?: string;
  active?: boolean;
  isDefault?: boolean;
}

export interface AdminBrandingDto {
  instanceName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor?: string;
  sidebarColor?: string;
  updatedAt?: ISODateString;
}

export interface UpdateAdminBrandingRequestDto {
  instanceName?: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  sidebarColor?: string;
}

export type PluginHookName = "preSearch" | "postRank";

export interface PluginDescriptorDto {
  id: string;
  name: string;
  version: string;
  hooks: PluginHookName[];
  enabled: boolean;
}

export interface PluginListResponseDto {
  total: number;
  plugins: PluginDescriptorDto[];
}

export interface RotateApiKeyResponseDto {
  apiKey: ApiKeyDto;
  secret: string;
}

export interface DeveloperApiKeyListResponseDto {
  total: number;
  apiKeys: ApiKeyDto[];
}
