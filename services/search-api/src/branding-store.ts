import type {
  AdminBrandingDto,
  UpdateAdminBrandingRequestDto,
} from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

const BRANDING_CONFIG_KEY = "admin.branding";

const DEFAULT_BRANDING: AdminBrandingDto = {
  instanceName: "ForgeOps",
  primaryColor: "#ea580c",
  accentColor: "#0f172a",
  sidebarColor: "#0f172a",
};

function normalizeBranding(value: unknown): AdminBrandingDto {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_BRANDING };
  }

  const record = value as Record<string, unknown>;
  return {
    instanceName:
      typeof record.instanceName === "string" && record.instanceName.trim()
        ? record.instanceName.trim()
        : DEFAULT_BRANDING.instanceName,
    logoUrl:
      typeof record.logoUrl === "string" && record.logoUrl.trim()
        ? record.logoUrl.trim()
        : undefined,
    primaryColor:
      typeof record.primaryColor === "string" && record.primaryColor.trim()
        ? record.primaryColor.trim()
        : DEFAULT_BRANDING.primaryColor,
    accentColor:
      typeof record.accentColor === "string" && record.accentColor.trim()
        ? record.accentColor.trim()
        : DEFAULT_BRANDING.accentColor,
    sidebarColor:
      typeof record.sidebarColor === "string" && record.sidebarColor.trim()
        ? record.sidebarColor.trim()
        : DEFAULT_BRANDING.sidebarColor,
    updatedAt:
      typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

export async function getAdminBranding(): Promise<AdminBrandingDto> {
  const row = await prisma.systemConfig.findUnique({
    where: { key: BRANDING_CONFIG_KEY },
  });
  return normalizeBranding(row?.value);
}

export async function updateAdminBranding(
  request: UpdateAdminBrandingRequestDto,
): Promise<AdminBrandingDto> {
  const current = await getAdminBranding();
  const next: AdminBrandingDto = {
    instanceName: request.instanceName?.trim() || current.instanceName,
    logoUrl:
      request.logoUrl === undefined
        ? current.logoUrl
        : request.logoUrl.trim() || undefined,
    primaryColor: request.primaryColor?.trim() || current.primaryColor,
    accentColor: request.accentColor?.trim() || current.accentColor,
    sidebarColor: request.sidebarColor?.trim() || current.sidebarColor,
    updatedAt: new Date().toISOString(),
  };

  await prisma.systemConfig.upsert({
    where: { key: BRANDING_CONFIG_KEY },
    create: { key: BRANDING_CONFIG_KEY, value: next as unknown as Prisma.InputJsonValue },
    update: { value: next as unknown as Prisma.InputJsonValue },
  });

  return next;
}

export { DEFAULT_BRANDING };
