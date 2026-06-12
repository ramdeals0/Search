import type {
  BootstrapNextStep,
  BootstrapStateDto,
  BootstrapStatus,
  ConfigureBootstrapPlatformRequestDto,
  ConfigureBootstrapSecurityRequestDto,
  CreateBootstrapAdminRequestDto,
  SessionDto,
  UserDto,
} from "@retailer-search/shared-types";
import type { BootstrapStatusEnum, Prisma } from "@prisma/client";
import {
  createBootstrapAdminUser,
  createSession,
  getUserById,
  hasAdminUser,
} from "./auth-store.js";
import { recordAuditLog } from "./audit-trail-store.js";
import { prisma } from "./db.js";

const BOOTSTRAP_ID = "default";

const SECURITY_CONFIG_KEY = "bootstrap.security";
const PLATFORM_CONFIG_KEY = "bootstrap.platform";

let cachedState: BootstrapStateDto | null = null;

function isSetupEnabled(): boolean {
  return process.env.ALLOW_SETUP !== "false";
}

function mapStatusFromDb(status: BootstrapStatusEnum): BootstrapStatus {
  return status as BootstrapStatus;
}

function computeNextStep(status: BootstrapStatus): BootstrapNextStep {
  switch (status) {
    case "not_started":
      return "welcome";
    case "admin_created":
      return "security";
    case "security_configured":
      return "platform";
    case "platform_configured":
      return "review";
    case "completed":
      return "done";
  }
}

function mapRowToDto(row: {
  status: BootstrapStatusEnum;
  initializedAt: Date | null;
  initializedByUserId: string | null;
  initializedByEmail: string | null;
  instanceName: string | null;
  firstAdminEmail: string | null;
  securityDefaultsApplied: boolean;
  governanceDefaultsApplied: boolean;
}): BootstrapStateDto {
  const status = mapStatusFromDb(row.status);
  const setupRequired = isSetupEnabled() && status !== "completed";

  return {
    status,
    setupRequired,
    initializedAt: row.initializedAt?.toISOString(),
    initializedByUserId: row.initializedByUserId ?? undefined,
    initializedByEmail: row.initializedByEmail ?? undefined,
    instanceName: row.instanceName ?? undefined,
    firstAdminEmail: row.firstAdminEmail ?? undefined,
    securityDefaultsApplied: row.securityDefaultsApplied,
    governanceDefaultsApplied: row.governanceDefaultsApplied,
    nextStep: computeNextStep(status),
  };
}

async function loadBootstrapRow() {
  return prisma.bootstrapState.findUnique({ where: { id: BOOTSTRAP_ID } });
}

async function refreshCache(): Promise<BootstrapStateDto> {
  const row = await loadBootstrapRow();
  if (!row) {
    cachedState = {
      status: "not_started",
      setupRequired: isSetupEnabled(),
      securityDefaultsApplied: false,
      governanceDefaultsApplied: false,
      nextStep: "welcome",
    };
    return cachedState;
  }

  cachedState = mapRowToDto(row);
  return cachedState;
}

export async function hydrateBootstrapStore(): Promise<void> {
  await refreshCache();
}

export function isSetupRequired(): boolean {
  if (!isSetupEnabled()) {
    return false;
  }

  if (!cachedState) {
    return true;
  }

  return cachedState.setupRequired;
}

export async function getBootstrapState(): Promise<BootstrapStateDto> {
  if (cachedState) {
    return structuredClone(cachedState);
  }

  return refreshCache();
}

export async function ensureBootstrapState(): Promise<BootstrapStateDto> {
  const existing = await loadBootstrapRow();
  if (existing) {
    cachedState = mapRowToDto(existing);
    return structuredClone(cachedState);
  }

  const row = await prisma.bootstrapState.create({
    data: {
      id: BOOTSTRAP_ID,
      status: "not_started",
    },
  });

  cachedState = mapRowToDto(row);
  return structuredClone(cachedState);
}

async function assertSetupIncomplete(): Promise<BootstrapStateDto> {
  const state = await ensureBootstrapState();
  if (!isSetupEnabled()) {
    throw new Error("Setup is disabled for this instance");
  }
  if (state.status === "completed") {
    throw new Error("Initial setup has already been completed");
  }
  return state;
}

async function upsertSystemConfig(
  key: string,
  value: Record<string, unknown>,
): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });
}

export async function createBootstrapAdmin(
  input: CreateBootstrapAdminRequestDto,
): Promise<{ user: UserDto; session: SessionDto }> {
  const state = await assertSetupIncomplete();

  if (state.status !== "not_started") {
    throw new Error("First admin can only be created at the beginning of setup");
  }

  if (hasAdminUser()) {
    throw new Error("An admin user already exists. Reset the database to run setup again.");
  }

  if (input.password !== input.confirmPassword) {
    throw new Error("Password and confirmation do not match");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const user = createBootstrapAdminUser({
    name: input.name,
    email: input.email,
    password: input.password,
  });

  const session = createSession(user);

  const row = await prisma.bootstrapState.update({
    where: { id: BOOTSTRAP_ID },
    data: {
      status: "admin_created",
      firstAdminEmail: user.email,
    },
  });

  cachedState = mapRowToDto(row);

  recordAuditLog({
    actionType: "bootstrap_admin_created",
    entityType: "bootstrap",
    entityId: BOOTSTRAP_ID,
    entityLabel: user.email,
    actorId: user.id,
    actorLabel: user.email,
    outcome: "success",
    summary: `Bootstrap admin created for ${user.email}`,
  });

  return { user, session };
}

export async function configureBootstrapSecurity(
  input: ConfigureBootstrapSecurityRequestDto,
): Promise<BootstrapStateDto> {
  const state = await assertSetupIncomplete();

  if (state.status !== "admin_created") {
    throw new Error("Configure security after creating the first admin account");
  }

  await upsertSystemConfig(SECURITY_CONFIG_KEY, { ...input });

  const row = await prisma.bootstrapState.update({
    where: { id: BOOTSTRAP_ID },
    data: {
      status: "security_configured",
      securityDefaultsApplied: true,
    },
  });

  cachedState = mapRowToDto(row);

  recordAuditLog({
    actionType: "bootstrap_security_configured",
    entityType: "bootstrap",
    entityId: BOOTSTRAP_ID,
    outcome: "success",
    summary: "Bootstrap security defaults configured",
    metadata: { ...input },
  });

  return structuredClone(cachedState);
}

export async function configureBootstrapPlatform(
  input: ConfigureBootstrapPlatformRequestDto,
): Promise<BootstrapStateDto> {
  const state = await assertSetupIncomplete();

  if (state.status !== "security_configured") {
    throw new Error("Configure platform defaults after security settings");
  }

  await upsertSystemConfig(PLATFORM_CONFIG_KEY, { ...input });

  const row = await prisma.bootstrapState.update({
    where: { id: BOOTSTRAP_ID },
    data: {
      status: "platform_configured",
      instanceName: input.instanceName,
      governanceDefaultsApplied: true,
    },
  });

  cachedState = mapRowToDto(row);

  recordAuditLog({
    actionType: "bootstrap_platform_configured",
    entityType: "bootstrap",
    entityId: BOOTSTRAP_ID,
    outcome: "success",
    summary: `Bootstrap platform defaults configured for ${input.instanceName}`,
    metadata: { instanceName: input.instanceName },
  });

  return structuredClone(cachedState);
}

export async function completeBootstrap(
  actor: UserDto,
): Promise<BootstrapStateDto> {
  const state = await assertSetupIncomplete();

  if (state.status !== "platform_configured") {
    throw new Error("Complete setup only after platform defaults are configured");
  }

  if (actor.role !== "admin") {
    throw new Error("Only an admin user can complete initial setup");
  }

  const initializedAt = new Date();
  const row = await prisma.bootstrapState.update({
    where: { id: BOOTSTRAP_ID },
    data: {
      status: "completed",
      initializedAt,
      initializedByUserId: actor.id,
      initializedByEmail: actor.email,
    },
  });

  cachedState = mapRowToDto(row);

  recordAuditLog({
    actionType: "bootstrap_completed",
    entityType: "bootstrap",
    entityId: BOOTSTRAP_ID,
    actorId: actor.id,
    actorLabel: actor.email,
    outcome: "success",
    summary: `Initial setup completed by ${actor.email}`,
  });

  return structuredClone(cachedState);
}

export async function getSystemConfig<T extends Record<string, unknown>>(
  key: string,
): Promise<T | null> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  if (!row) {
    return null;
  }

  return row.value as T;
}

export function resolveBootstrapActor(userId: string): UserDto | null {
  return getUserById(userId);
}
