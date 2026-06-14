import { createHash, randomBytes } from "node:crypto";
import type {
  ApiKeyDto,
  CreateApiKeyRequestDto,
  CreateApiKeyResponseDto,
  RotateApiKeyResponseDto,
} from "@retailer-search/shared-types";
import { prisma } from "../db.js";

const DEFAULT_SCOPES = ["search:read", "browse:read", "events:write"];
const DEVELOPER_SCOPES = ["search:read", "browse:read", "events:write"];

export interface ValidatedApiKey {
  id: string;
  tenantId: string;
  scopes: string[];
  rateLimitPerMinute?: number;
}

function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

function toValidated(row: {
  id: string;
  tenantId: string;
  scopes: string[];
  rateLimitPerMinute: number | null;
}): ValidatedApiKey {
  return {
    id: row.id,
    tenantId: row.tenantId,
    scopes: row.scopes,
    rateLimitPerMinute: row.rateLimitPerMinute ?? undefined,
  };
}

function toDto(row: {
  id: string;
  name: string;
  keyPrefix: string;
  tenantId: string;
  ownerUserId: string | null;
  scopes: string[];
  enabled: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    tenantId: row.tenantId,
    ownerUserId: row.ownerUserId ?? undefined,
    scopes: row.scopes,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt?.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createApiKey(
  request: CreateApiKeyRequestDto,
  ownerUserId?: string,
): Promise<CreateApiKeyResponseDto> {
  const secret = `rsp_${randomBytes(24).toString("hex")}`;
  const keyPrefix = secret.slice(0, 12);
  const row = await prisma.apiKey.create({
    data: {
      name: request.name.trim(),
      keyHash: hashApiKey(secret),
      keyPrefix,
      tenantId: request.tenantId?.trim() || "default",
      ownerUserId: ownerUserId ?? null,
      scopes: request.scopes?.length ? request.scopes : DEFAULT_SCOPES,
      rateLimitPerMinute: request.rateLimitPerMinute,
      expiresAt: request.expiresAt ? new Date(request.expiresAt) : null,
    },
  });

  return {
    apiKey: toDto(row),
    secret,
  };
}

export async function createDeveloperApiKey(
  ownerUserId: string,
  request: CreateApiKeyRequestDto,
): Promise<CreateApiKeyResponseDto> {
  return createApiKey(
    {
      ...request,
      tenantId: request.tenantId?.trim() || "default",
      scopes: request.scopes?.length ? request.scopes : DEVELOPER_SCOPES,
    },
    ownerUserId,
  );
}

export async function listApiKeys(): Promise<ApiKeyDto[]> {
  const rows = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function listApiKeysForOwner(ownerUserId: string): Promise<ApiKeyDto[]> {
  const rows = await prisma.apiKey.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDto);
}

export async function revokeApiKey(id: string): Promise<ApiKeyDto | null> {
  try {
    const row = await prisma.apiKey.update({
      where: { id },
      data: { enabled: false },
    });
    return toDto(row);
  } catch {
    return null;
  }
}

export async function revokeOwnedApiKey(
  id: string,
  ownerUserId: string,
): Promise<ApiKeyDto | null> {
  const existing = await prisma.apiKey.findFirst({
    where: { id, ownerUserId },
  });
  if (!existing) {
    return null;
  }
  return revokeApiKey(id);
}

export async function rotateApiKey(
  id: string,
  ownerUserId?: string,
): Promise<RotateApiKeyResponseDto | null> {
  const existing = await prisma.apiKey.findFirst({
    where: ownerUserId ? { id, ownerUserId } : { id },
  });
  if (!existing || !existing.enabled) {
    return null;
  }

  const secret = `rsp_${randomBytes(24).toString("hex")}`;
  const keyPrefix = secret.slice(0, 12);
  const row = await prisma.apiKey.update({
    where: { id },
    data: {
      keyHash: hashApiKey(secret),
      keyPrefix,
      updatedAt: new Date(),
    },
  });

  return {
    apiKey: toDto(row),
    secret,
  };
}

export async function validateApiKey(
  secret: string,
): Promise<ValidatedApiKey | null> {
  const trimmed = secret.trim();
  if (!trimmed) {
    return null;
  }

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(trimmed) },
  });

  if (!row || !row.enabled) {
    return null;
  }

  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  void prisma.apiKey
    .update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  return toValidated(row);
}

export function isApiKeyRequired(): boolean {
  return process.env.SEARCH_API_KEY_REQUIRED === "true";
}

export function hasScope(
  context: ValidatedApiKey | undefined,
  scope: string,
): boolean {
  if (!context) {
    return !isApiKeyRequired();
  }
  return context.scopes.includes(scope);
}
