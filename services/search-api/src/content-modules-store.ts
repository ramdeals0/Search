import type {
  EnvironmentKey,
  SearchContentModuleDto,
  SearchContentModuleHitDto,
} from "@retailer-search/shared-types";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
const prismaClient = prisma as any;

const modules: SearchContentModuleDto[] = [];
let persistenceEnabled = false;

function normalizeText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function matchesQuery(conditionQuery: string | undefined, query: string): boolean {
  if (!conditionQuery) {
    return true;
  }
  return query.toLowerCase().includes(conditionQuery.toLowerCase());
}

function mapModuleRow(row: {
  id: string;
  name: string;
  active: boolean;
  environment: string;
  moduleType: string;
  priority: number;
  condition: unknown;
  content: unknown;
}): SearchContentModuleDto {
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    environment: row.environment as EnvironmentKey,
    moduleType: row.moduleType as SearchContentModuleDto["moduleType"],
    priority: row.priority,
    condition: row.condition as SearchContentModuleDto["condition"],
    content: row.content as SearchContentModuleDto["content"],
  };
}

export async function hydrateContentModulesStore(): Promise<void> {
  try {
    const rows = await prismaClient.searchContentModule.findMany({
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    });
    modules.length = 0;
    for (const row of rows) {
      modules.push(mapModuleRow(row));
    }
    persistenceEnabled = true;
  } catch {
    persistenceEnabled = false;
  }
}

export async function listContentModules(
  environment?: EnvironmentKey,
): Promise<SearchContentModuleDto[]> {
  const filtered = environment
    ? modules.filter((module) => module.environment === environment)
    : modules;
  return filtered
    .slice()
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    .map((module) => structuredClone(module));
}

export async function createContentModule(
  input: Omit<SearchContentModuleDto, "id">,
): Promise<SearchContentModuleDto> {
  const memoryId = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created: SearchContentModuleDto = {
    id: memoryId,
    name: input.name.trim(),
    active: input.active,
    environment: input.environment,
    moduleType: input.moduleType,
    priority: input.priority,
    condition: {
      query: normalizeText(input.condition.query),
      brand: normalizeText(input.condition.brand),
      category: normalizeText(input.condition.category),
    },
    content: {
      title: normalizeText(input.content.title),
      body: normalizeText(input.content.body),
      href: normalizeText(input.content.href),
      category: normalizeText(input.content.category),
    },
  };

  modules.push(created);

  if (persistenceEnabled) {
    try {
      const row = await prismaClient.searchContentModule.create({
        data: {
          name: created.name,
          active: created.active,
          environment: created.environment,
          moduleType: created.moduleType,
          priority: created.priority,
          condition: created.condition as unknown as Prisma.InputJsonValue,
          content: created.content as unknown as Prisma.InputJsonValue,
        },
      });
      created.id = row.id;
      const idx = modules.findIndex((module) => module.id === memoryId);
      if (idx >= 0) {
        modules[idx] = structuredClone(created);
      }
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(created);
}

export async function updateContentModule(
  id: string,
  input: Partial<Omit<SearchContentModuleDto, "id">>,
): Promise<SearchContentModuleDto | undefined> {
  const module = modules.find((item) => item.id === id);
  if (!module) {
    return undefined;
  }

  if (input.name !== undefined) {
    module.name = input.name.trim();
  }
  if (input.active !== undefined) {
    module.active = input.active;
  }
  if (input.environment !== undefined) {
    module.environment = input.environment;
  }
  if (input.moduleType !== undefined) {
    module.moduleType = input.moduleType;
  }
  if (input.priority !== undefined) {
    module.priority = input.priority;
  }
  if (input.condition !== undefined) {
    module.condition = {
      query: normalizeText(input.condition.query),
      brand: normalizeText(input.condition.brand),
      category: normalizeText(input.condition.category),
    };
  }
  if (input.content !== undefined) {
    module.content = {
      title: normalizeText(input.content.title),
      body: normalizeText(input.content.body),
      href: normalizeText(input.content.href),
      category: normalizeText(input.content.category),
    };
  }

  if (persistenceEnabled) {
    try {
      await prismaClient.searchContentModule.update({
        where: { id },
        data: {
          name: module.name,
          active: module.active,
          environment: module.environment,
          moduleType: module.moduleType,
          priority: module.priority,
          condition: module.condition as unknown as Prisma.InputJsonValue,
          content: module.content as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }

  return structuredClone(module);
}

export async function deleteContentModule(id: string): Promise<boolean> {
  const idx = modules.findIndex((module) => module.id === id);
  if (idx === -1) {
    return false;
  }
  modules.splice(idx, 1);

  if (persistenceEnabled) {
    try {
      await prismaClient.searchContentModule.delete({ where: { id } });
    } catch {
      // Keep in-memory fallback behavior.
    }
  }
  return true;
}

export async function matchModulesForQuery(
  query: string,
  environment: EnvironmentKey,
): Promise<SearchContentModuleHitDto[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return modules
    .filter((module) => module.active)
    .filter((module) => module.environment === environment)
    .filter((module) => matchesQuery(module.condition.query, normalizedQuery))
    .sort((a, b) => b.priority - a.priority)
    .map((module) => ({
      id: module.id,
      moduleType: module.moduleType,
      title: module.content.title,
      body: module.content.body,
      href: module.content.href,
      category: module.content.category,
    }));
}
