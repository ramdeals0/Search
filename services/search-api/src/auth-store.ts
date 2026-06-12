import { randomBytes } from "node:crypto";
import type { SessionDto, UserDto, UserRole } from "@retailer-search/shared-types";
import { prisma } from "./db.js";

export interface AuthenticatedUserContext {
  user: UserDto;
  standingRole: UserRole;
  effectiveRole: UserRole;
}

export function createAuthenticatedUserContext(
  user: UserDto,
  effectiveRole: UserRole,
): AuthenticatedUserContext {
  return {
    user,
    standingRole: user.role,
    effectiveRole,
  };
}

const SESSION_TTL_MS =
  Number(process.env.SESSION_TTL_HOURS ?? 24) * 60 * 60 * 1000;

interface StoredUser {
  user: UserDto;
  password: string;
}

interface StoredSession {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

const usersById = new Map<string, StoredUser>();
const usersByEmail = new Map<string, StoredUser>();
const sessionsByToken = new Map<string, StoredSession>();

function cloneUser(user: UserDto): UserDto {
  return structuredClone(user);
}

function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function mapUserRow(row: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}): UserDto {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString(),
  };
}

function persistUser(stored: StoredUser): void {
  void prisma.user
    .upsert({
      where: { id: stored.user.id },
      create: {
        id: stored.user.id,
        email: stored.user.email,
        name: stored.user.name,
        role: stored.user.role,
        active: stored.user.active,
        password: stored.password,
        createdAt: new Date(stored.user.createdAt),
        lastLoginAt: stored.user.lastLoginAt
          ? new Date(stored.user.lastLoginAt)
          : null,
      },
      update: {
        email: stored.user.email,
        name: stored.user.name,
        role: stored.user.role,
        active: stored.user.active,
        password: stored.password,
        lastLoginAt: stored.user.lastLoginAt
          ? new Date(stored.user.lastLoginAt)
          : null,
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist user", stored.user.id, error);
    });
}

function persistSession(session: StoredSession): void {
  void prisma.session
    .upsert({
      where: { token: session.token },
      create: {
        token: session.token,
        userId: session.userId,
        createdAt: new Date(session.createdAt),
        expiresAt: new Date(session.expiresAt),
      },
      update: {
        expiresAt: new Date(session.expiresAt),
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist session", session.token, error);
    });
}

function deletePersistedSession(token: string): void {
  void prisma.session
    .delete({ where: { token } })
    .catch(() => undefined);
}

export async function hydrateAuthStore(): Promise<void> {
  usersById.clear();
  usersByEmail.clear();
  sessionsByToken.clear();

  const users = await prisma.user.findMany();
  for (const row of users) {
    const user = mapUserRow(row);
    const stored: StoredUser = {
      user,
      password: row.password,
    };
    usersById.set(user.id, stored);
    usersByEmail.set(user.email.toLowerCase(), stored);
  }

  const sessions = await prisma.session.findMany();
  for (const row of sessions) {
    sessionsByToken.set(row.token, {
      token: row.token,
      userId: row.userId,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    });
  }
}

export function listUsers(): { total: number; users: UserDto[] } {
  return {
    total: usersById.size,
    users: [...usersById.values()].map((entry) => cloneUser(entry.user)),
  };
}

export function findUserByEmail(email: string): UserDto | null {
  const stored = usersByEmail.get(email.trim().toLowerCase());
  if (!stored || !stored.user.active) {
    return null;
  }

  return cloneUser(stored.user);
}

export function validatePassword(user: UserDto, password: string): boolean {
  const stored = usersById.get(user.id);
  if (!stored || !stored.user.active) {
    return false;
  }

  return stored.password === password;
}

export function createSession(user: UserDto): SessionDto {
  const stored = usersById.get(user.id);
  if (!stored) {
    throw new Error("User not found");
  }

  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);
  const token = createSessionToken();

  stored.user.lastLoginAt = createdAt.toISOString();
  persistUser(stored);

  const session: StoredSession = {
    token,
    userId: user.id,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  sessionsByToken.set(token, session);
  persistSession(session);

  return {
    token,
    user: cloneUser(stored.user),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function getSessionByToken(token: string): SessionDto | null {
  const session = sessionsByToken.get(token);
  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    sessionsByToken.delete(token);
    deletePersistedSession(token);
    return null;
  }

  const stored = usersById.get(session.userId);
  if (!stored || !stored.user.active) {
    sessionsByToken.delete(token);
    deletePersistedSession(token);
    return null;
  }

  return {
    token: session.token,
    user: cloneUser(stored.user),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export function deleteSession(token: string): boolean {
  const deleted = sessionsByToken.delete(token);
  if (deleted) {
    deletePersistedSession(token);
  }
  return deleted;
}

export function getUserById(userId: string): UserDto | null {
  const stored = usersById.get(userId);
  if (!stored) {
    return null;
  }

  return cloneUser(stored.user);
}

export function updateUserRole(userId: string, nextRole: UserRole): UserDto | null {
  const stored = usersById.get(userId);
  if (!stored) {
    return null;
  }

  stored.user.role = nextRole;
  persistUser(stored);
  return cloneUser(stored.user);
}

export function disableUser(userId: string): UserDto | null {
  const stored = usersById.get(userId);
  if (!stored) {
    return null;
  }

  stored.user.active = false;
  persistUser(stored);

  for (const [token, session] of sessionsByToken.entries()) {
    if (session.userId === userId) {
      sessionsByToken.delete(token);
      deletePersistedSession(token);
    }
  }

  return cloneUser(stored.user);
}

export function getCurrentUserFromAuthHeader(headerValue?: string): UserDto | null {
  if (!headerValue?.startsWith("Bearer ")) {
    return null;
  }

  const token = headerValue.slice("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  const session = getSessionByToken(token);
  return session?.user ?? null;
}

/** Prefer authenticated user id for rate limiting; falls back to null when anonymous. */
export function getRateLimitUserKeyFromAuthHeader(headerValue?: string): string | null {
  const user = getCurrentUserFromAuthHeader(headerValue);
  return user ? `user:${user.id}` : null;
}

export function registerSeededUser(user: UserDto, password: string): void {
  const stored: StoredUser = { user, password };
  usersById.set(user.id, stored);
  usersByEmail.set(user.email.toLowerCase(), stored);
}

export function userCount(): number {
  return usersById.size;
}

export function hasAdminUser(): boolean {
  return [...usersById.values()].some(
    (entry) => entry.user.role === "admin" && entry.user.active,
  );
}

export function createBootstrapAdminUser(input: {
  name: string;
  email: string;
  password: string;
}): UserDto {
  if (hasAdminUser()) {
    throw new Error("An admin user already exists");
  }

  const email = input.email.trim().toLowerCase();
  if (usersByEmail.has(email)) {
    throw new Error("A user with this email already exists");
  }

  const user: UserDto = {
    id: `user-bootstrap-admin-${Date.now()}`,
    email,
    name: input.name.trim(),
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
  };

  const stored: StoredUser = {
    user,
    password: input.password,
  };

  usersById.set(user.id, stored);
  usersByEmail.set(email, stored);
  persistUser(stored);

  return cloneUser(user);
}

export function isLoginAllowedDuringSetup(user: UserDto): boolean {
  return user.role === "admin";
}
