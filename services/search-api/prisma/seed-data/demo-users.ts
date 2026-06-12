import type { UserRole } from "@prisma/client";

export const DEMO_PASSWORD = "demo123";

export interface DemoUserSeed {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const DEMO_USERS: DemoUserSeed[] = [
  {
    id: "user-merchandiser",
    email: "merchandiser@example.com",
    name: "Alex Morgan",
    role: "merchandiser",
  },
  {
    id: "user-reviewer",
    email: "reviewer@example.com",
    name: "Jordan Lee",
    role: "reviewer",
  },
  {
    id: "user-approver",
    email: "approver@example.com",
    name: "Taylor Brooks",
    role: "approver",
  },
  {
    id: "user-release-manager",
    email: "releasemanager@example.com",
    name: "Casey Rivera",
    role: "release_manager",
  },
  {
    id: "user-admin",
    email: "admin@example.com",
    name: "Morgan Patel",
    role: "admin",
  },
];

export function getDemoUserByRole(role: UserRole): DemoUserSeed {
  const user = DEMO_USERS.find((entry) => entry.role === role);
  if (!user) {
    throw new Error(`Missing demo user for role ${role}`);
  }
  return user;
}

export function getDemoUserById(id: string): DemoUserSeed | undefined {
  return DEMO_USERS.find((entry) => entry.id === id);
}
