import type {
  CreateSavedViewRequestDto,
  SavedViewDto,
  SavedViewListResponseDto,
  UpdateSavedViewRequestDto,
  WorkspacePresetDto,
  WorkspaceRole,
  WorkspaceStateDto,
} from "@retailer-search/shared-types";

const AVAILABLE_ROLES: WorkspaceRole[] = [
  "merchandiser",
  "reviewer",
  "approver",
  "release_manager",
  "admin",
];

const WORKSPACE_PRESETS: WorkspacePresetDto[] = [
  {
    role: "merchandiser",
    title: "Merchandiser workspace",
    description:
      "Focus on search analytics, suggestions, rules, query preview, and experiments.",
    visibleSections: [
      "analytics",
      "suggestions",
      "rules",
      "query-preview",
      "experiments",
      "query-sets",
    ],
    defaultFilters: { environment: "staging", section: "analytics" },
  },
  {
    role: "reviewer",
    title: "Reviewer workspace",
    description:
      "Focus on approvals, collaboration, exceptions, and SLA visibility.",
    visibleSections: [
      "approvals",
      "exceptions",
      "delegation",
      "approval-sla",
      "notifications",
    ],
    defaultFilters: { section: "approvals", status: "pending" },
  },
  {
    role: "approver",
    title: "Approver workspace",
    description:
      "Focus on pending approvals, SLA tracking, inbox, and risk notes.",
    visibleSections: [
      "approvals",
      "approval-sla",
      "notifications",
      "exceptions",
      "delegation",
    ],
    defaultFilters: { section: "approvals", status: "pending" },
  },
  {
    role: "release_manager",
    title: "Release manager workspace",
    description:
      "Focus on environments, promotions, snapshots, rollback, and live config.",
    visibleSections: [
      "environment",
      "promotions",
      "approvals",
      "snapshots",
      "active-config",
    ],
    defaultFilters: { environment: "live", section: "promotions" },
  },
  {
    role: "admin",
    title: "Admin workspace",
    description: "Full visibility across all merchandising and release tools.",
    visibleSections: [
      "environment",
      "analytics",
      "suggestions",
      "query-preview",
      "rules",
      "snapshots",
      "query-sets",
      "experiments",
      "workflow-guide",
      "experiment-run",
      "scorecard",
      "decision",
      "reviewers",
      "approval-policy",
      "delegation",
      "exceptions",
      "approval-sla",
      "notifications",
      "approvals",
      "promotions",
      "audit-log",
    ],
    defaultFilters: { section: "analytics" },
  },
];

const savedViews: SavedViewDto[] = [
  {
    id: "view-default-approver-overdue",
    name: "Overdue approvals",
    role: "approver",
    description: "Pending approvals that need immediate attention.",
    filters: { section: "approvals", status: "pending", sla: "overdue" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: "view-default-merchandiser-staging",
    name: "Staging merchandising",
    role: "merchandiser",
    description: "Staging analytics and rule tuning.",
    filters: { section: "analytics", environment: "staging" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
  {
    id: "view-default-release-live",
    name: "Live release queue",
    role: "release_manager",
    description: "Live promotions and execute-ready approvals.",
    filters: { section: "promotions", environment: "live" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
  },
];

let savedViewIdCounter = 1;

function cloneSavedView(view: SavedViewDto): SavedViewDto {
  return structuredClone(view);
}

function touchSavedView(view: SavedViewDto): void {
  view.updatedAt = new Date().toISOString();
}

function createSavedViewId(): string {
  const id = `view-${Date.now()}-${savedViewIdCounter}`;
  savedViewIdCounter += 1;
  return id;
}

export function listWorkspacePresets(): WorkspacePresetDto[] {
  return WORKSPACE_PRESETS.map((preset) => structuredClone(preset));
}

export function getWorkspacePreset(
  role: WorkspaceRole,
): WorkspacePresetDto | undefined {
  const preset = WORKSPACE_PRESETS.find((entry) => entry.role === role);
  return preset ? structuredClone(preset) : undefined;
}

export function listSavedViews(role?: WorkspaceRole): SavedViewListResponseDto {
  const filtered = role
    ? savedViews.filter((view) => view.role === role)
    : [...savedViews];

  return {
    total: filtered.length,
    savedViews: filtered.map(cloneSavedView),
  };
}

export function getSavedViewById(id: string): SavedViewDto | undefined {
  const view = savedViews.find((entry) => entry.id === id);
  return view ? cloneSavedView(view) : undefined;
}

function clearDefaultForRole(role: WorkspaceRole, exceptId?: string): void {
  for (const view of savedViews) {
    if (view.role === role && view.id !== exceptId) {
      view.isDefault = false;
    }
  }
}

export function createSavedView(
  input: CreateSavedViewRequestDto,
): SavedViewDto {
  const now = new Date().toISOString();
  const view: SavedViewDto = {
    id: createSavedViewId(),
    name: input.name.trim(),
    role: input.role,
    description: input.description?.trim() || undefined,
    filters: structuredClone(input.filters),
    createdAt: now,
    updatedAt: now,
    isDefault: input.isDefault ?? false,
  };

  if (view.isDefault) {
    clearDefaultForRole(view.role, view.id);
  }

  savedViews.unshift(view);
  return cloneSavedView(view);
}

export function updateSavedView(
  id: string,
  input: UpdateSavedViewRequestDto,
): SavedViewDto | null {
  const view = savedViews.find((entry) => entry.id === id);
  if (!view) {
    return null;
  }

  if (input.name !== undefined) {
    view.name = input.name.trim();
  }

  if (input.description !== undefined) {
    view.description = input.description.trim() || undefined;
  }

  if (input.filters !== undefined) {
    view.filters = structuredClone(input.filters);
  }

  if (input.isDefault !== undefined) {
    view.isDefault = input.isDefault;
    if (view.isDefault) {
      clearDefaultForRole(view.role, view.id);
    }
  }

  touchSavedView(view);
  return cloneSavedView(view);
}

export function setDefaultSavedView(
  role: WorkspaceRole,
  id: string,
): SavedViewDto | null {
  const view = savedViews.find((entry) => entry.id === id && entry.role === role);
  if (!view) {
    return null;
  }

  clearDefaultForRole(role, id);
  view.isDefault = true;
  touchSavedView(view);
  return cloneSavedView(view);
}

export function getWorkspaceState(
  activeRole: WorkspaceRole = "merchandiser",
): WorkspaceStateDto {
  return {
    activeRole,
    availableRoles: [...AVAILABLE_ROLES],
    presets: listWorkspacePresets(),
    savedViews: listSavedViews().savedViews,
  };
}
