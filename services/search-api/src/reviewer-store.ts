import type {
  ApprovalPolicyDto,
  CreateReviewerRequestDto,
  ReviewerDto,
  ReviewerListResponseDto,
  ReviewerRole,
  UpdateApprovalPolicyRequestDto,
} from "@retailer-search/shared-types";

const reviewers: ReviewerDto[] = [
  {
    id: "local-requester",
    name: "Local Requester",
    role: "requester",
    active: true,
  },
  {
    id: "local-reviewer",
    name: "Local Reviewer",
    role: "reviewer",
    active: true,
  },
  {
    id: "local-approver",
    name: "Local Approver",
    role: "approver",
    active: true,
  },
  {
    id: "local-release-manager",
    name: "Local Release Manager",
    role: "release_manager",
    active: true,
  },
];

let approvalPolicy: ApprovalPolicyDto = {
  requireSecondApprover: true,
  requireDifferentActorForApproval: true,
  requireDifferentActorForExecution: true,
  allowedApproverRoles: ["reviewer", "approver", "release_manager"],
  allowedExecutorRoles: ["release_manager"],
};

let reviewerIdCounter = 1;

function cloneReviewer(reviewer: ReviewerDto): ReviewerDto {
  return structuredClone(reviewer);
}

function createReviewerId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const base = slug || `reviewer-${reviewerIdCounter}`;
  reviewerIdCounter += 1;

  let candidate = base;
  let counter = 1;
  while (reviewers.some((reviewer) => reviewer.id === candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }

  return candidate;
}

export function listReviewers(): ReviewerListResponseDto {
  return {
    total: reviewers.length,
    reviewers: reviewers.map(cloneReviewer),
  };
}

export function createReviewer(input: CreateReviewerRequestDto): ReviewerDto {
  const reviewer: ReviewerDto = {
    id: createReviewerId(input.name),
    name: input.name.trim(),
    role: input.role,
    active: true,
  };

  reviewers.push(reviewer);
  return cloneReviewer(reviewer);
}

export function getReviewerById(id: string): ReviewerDto | undefined {
  const reviewer = reviewers.find((entry) => entry.id === id);
  return reviewer ? cloneReviewer(reviewer) : undefined;
}

export function setReviewerActive(
  id: string,
  active: boolean,
): ReviewerDto | null {
  const reviewer = reviewers.find((entry) => entry.id === id);
  if (!reviewer) {
    return null;
  }

  reviewer.active = active;
  return cloneReviewer(reviewer);
}

export function getApprovalPolicy(): ApprovalPolicyDto {
  return structuredClone(approvalPolicy);
}

export function updateApprovalPolicy(
  input: UpdateApprovalPolicyRequestDto,
): ApprovalPolicyDto {
  approvalPolicy = {
    requireSecondApprover:
      input.requireSecondApprover ?? approvalPolicy.requireSecondApprover,
    requireDifferentActorForApproval:
      input.requireDifferentActorForApproval ??
      approvalPolicy.requireDifferentActorForApproval,
    requireDifferentActorForExecution:
      input.requireDifferentActorForExecution ??
      approvalPolicy.requireDifferentActorForExecution,
    allowedApproverRoles:
      input.allowedApproverRoles ?? approvalPolicy.allowedApproverRoles,
    allowedExecutorRoles:
      input.allowedExecutorRoles ?? approvalPolicy.allowedExecutorRoles,
  };

  return getApprovalPolicy();
}

export function resolveReviewerActor(
  actorId?: string,
  actorRole?: ReviewerRole,
): { actorId: string; actorLabel: string; role: ReviewerRole } | null {
  if (actorId) {
    const reviewer = getReviewerById(actorId);
    if (!reviewer || !reviewer.active) {
      return null;
    }

    return {
      actorId: reviewer.id,
      actorLabel: reviewer.name,
      role: reviewer.role,
    };
  }

  if (actorRole) {
    const reviewer = reviewers.find(
      (entry) => entry.active && entry.role === actorRole,
    );
    if (!reviewer) {
      return null;
    }

    return {
      actorId: reviewer.id,
      actorLabel: reviewer.name,
      role: reviewer.role,
    };
  }

  const fallback = getReviewerById("local-approver");
  if (!fallback) {
    return null;
  }

  return {
    actorId: fallback.id,
    actorLabel: fallback.name,
    role: fallback.role,
  };
}

export function resolveRequesterActor(
  actorId?: string,
): { actorId: string; actorLabel: string; role: ReviewerRole } | null {
  if (actorId) {
    const reviewer = getReviewerById(actorId);
    if (!reviewer || !reviewer.active) {
      return null;
    }

    return {
      actorId: reviewer.id,
      actorLabel: reviewer.name,
      role: reviewer.role,
    };
  }

  const fallback = getReviewerById("local-requester");
  if (!fallback) {
    return null;
  }

  return {
    actorId: fallback.id,
    actorLabel: fallback.name,
    role: fallback.role,
  };
}
