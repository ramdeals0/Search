import type {
  CollaborationAnnotationDto,
  CollaborationCommentDto,
  CollaborationTargetType,
  CollaborationThreadDto,
  CommentStatus,
  CreateAnnotationRequestDto,
  CreateCommentRequestDto,
} from "@retailer-search/shared-types";
import { prisma } from "./db.js";

const comments: CollaborationCommentDto[] = [];
const annotations: CollaborationAnnotationDto[] = [];
let commentIdCounter = 1;
let annotationIdCounter = 1;

function createCommentId(): string {
  const id = `cmt-${Date.now()}-${commentIdCounter}`;
  commentIdCounter += 1;
  return id;
}

function createAnnotationId(): string {
  const id = `ann-${Date.now()}-${annotationIdCounter}`;
  annotationIdCounter += 1;
  return id;
}

function cloneComment(comment: CollaborationCommentDto): CollaborationCommentDto {
  return structuredClone(comment);
}

function cloneAnnotation(
  annotation: CollaborationAnnotationDto,
): CollaborationAnnotationDto {
  return structuredClone(annotation);
}

function mapCommentRowToDto(row: {
  id: string;
  targetType: string;
  targetId: string;
  author: unknown;
  message: string;
  createdAt: Date;
  status: string;
  parentCommentId: string | null;
  tags: unknown;
}): CollaborationCommentDto {
  return {
    id: row.id,
    targetType: row.targetType as CollaborationTargetType,
    targetId: row.targetId,
    author: row.author as CollaborationCommentDto["author"],
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    status: row.status as CommentStatus,
    parentCommentId: row.parentCommentId ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
  };
}

function mapAnnotationRowToDto(row: {
  id: string;
  targetType: string;
  targetId: string;
  author: unknown;
  anchorLabel: string;
  note: string;
  createdAt: Date;
  tags: unknown;
}): CollaborationAnnotationDto {
  return {
    id: row.id,
    targetType: row.targetType as CollaborationTargetType,
    targetId: row.targetId,
    author: row.author as CollaborationAnnotationDto["author"],
    anchorLabel: row.anchorLabel,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    tags: (row.tags as string[] | null) ?? undefined,
  };
}

function persistComment(comment: CollaborationCommentDto): void {
  void prisma.collaborationComment
    .upsert({
      where: { id: comment.id },
      create: {
        id: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        author: comment.author,
        message: comment.message,
        createdAt: new Date(comment.createdAt),
        status: comment.status ?? "open",
        parentCommentId: comment.parentCommentId ?? null,
        tags: comment.tags ?? undefined,
      },
      update: {
        message: comment.message,
        status: comment.status ?? "open",
        tags: comment.tags ?? undefined,
        updatedAt: new Date(),
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist collaboration comment", comment.id, error);
    });
}

function persistAnnotation(annotation: CollaborationAnnotationDto): void {
  void prisma.collaborationAnnotation
    .upsert({
      where: { id: annotation.id },
      create: {
        id: annotation.id,
        targetType: annotation.targetType,
        targetId: annotation.targetId,
        author: annotation.author,
        anchorLabel: annotation.anchorLabel,
        note: annotation.note,
        createdAt: new Date(annotation.createdAt),
        tags: annotation.tags ?? undefined,
      },
      update: {
        anchorLabel: annotation.anchorLabel,
        note: annotation.note,
        tags: annotation.tags ?? undefined,
        updatedAt: new Date(),
      },
    })
    .catch((error: unknown) => {
      console.error("Failed to persist collaboration annotation", annotation.id, error);
    });
}

export async function hydrateCollaborationStore(): Promise<void> {
  comments.length = 0;
  annotations.length = 0;

  const commentRows = await prisma.collaborationComment.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of commentRows) {
    comments.push(mapCommentRowToDto(row));
  }

  const annotationRows = await prisma.collaborationAnnotation.findMany({
    orderBy: { createdAt: "desc" },
  });
  for (const row of annotationRows) {
    annotations.push(mapAnnotationRowToDto(row));
  }
}

function matchesTarget(
  entry: { targetType: CollaborationTargetType; targetId: string },
  targetType: CollaborationTargetType,
  targetId: string,
): boolean {
  return entry.targetType === targetType && entry.targetId === targetId;
}

function sortCommentsOldestFirst(
  items: CollaborationCommentDto[],
): CollaborationCommentDto[] {
  return [...items].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function sortAnnotationsNewestFirst(
  items: CollaborationAnnotationDto[],
): CollaborationAnnotationDto[] {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function addComment(
  input: CreateCommentRequestDto,
): { comment: CollaborationCommentDto | null; error?: string } {
  const trimmedMessage = input.message.trim();
  if (!trimmedMessage) {
    return { comment: null, error: "Comment message is required." };
  }

  if (input.parentCommentId) {
    const parent = comments.find((entry) => entry.id === input.parentCommentId);
    if (!parent) {
      return { comment: null, error: "Parent comment not found." };
    }

    if (
      parent.targetType !== input.targetType ||
      parent.targetId !== input.targetId
    ) {
      return {
        comment: null,
        error: "Reply must belong to the same collaboration target.",
      };
    }
  }

  const comment: CollaborationCommentDto = {
    id: createCommentId(),
    targetType: input.targetType,
    targetId: input.targetId,
    author: {
      actorId: input.actorId,
      actorLabel: input.actorLabel,
    },
    message: trimmedMessage,
    createdAt: new Date().toISOString(),
    status: "open",
    parentCommentId: input.parentCommentId,
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
  };

  comments.unshift(comment);
  persistComment(comment);
  return { comment: cloneComment(comment) };
}

export function addAnnotation(
  input: CreateAnnotationRequestDto,
): { annotation: CollaborationAnnotationDto | null; error?: string } {
  const trimmedAnchor = input.anchorLabel.trim();
  const trimmedNote = input.note.trim();

  if (!trimmedAnchor || !trimmedNote) {
    return {
      annotation: null,
      error: "Annotation anchor label and note are required.",
    };
  }

  const annotation: CollaborationAnnotationDto = {
    id: createAnnotationId(),
    targetType: input.targetType,
    targetId: input.targetId,
    author: {
      actorId: input.actorId,
      actorLabel: input.actorLabel,
    },
    anchorLabel: trimmedAnchor,
    note: trimmedNote,
    createdAt: new Date().toISOString(),
    tags: input.tags?.map((tag) => tag.trim()).filter(Boolean),
  };

  annotations.unshift(annotation);
  persistAnnotation(annotation);
  return { annotation: cloneAnnotation(annotation) };
}

export function listComments(
  targetType: CollaborationTargetType,
  targetId: string,
): CollaborationCommentDto[] {
  return sortCommentsOldestFirst(
    comments.filter((entry) => matchesTarget(entry, targetType, targetId)),
  ).map(cloneComment);
}

export function listAnnotations(
  targetType: CollaborationTargetType,
  targetId: string,
): CollaborationAnnotationDto[] {
  return sortAnnotationsNewestFirst(
    annotations.filter((entry) => matchesTarget(entry, targetType, targetId)),
  ).map(cloneAnnotation);
}

export function getCollaborationThread(
  targetType: CollaborationTargetType,
  targetId: string,
): CollaborationThreadDto {
  return {
    targetType,
    targetId,
    comments: listComments(targetType, targetId),
    annotations: listAnnotations(targetType, targetId),
  };
}

export function updateCommentStatus(
  commentId: string,
  status: CommentStatus,
): CollaborationCommentDto | null {
  const comment = comments.find((entry) => entry.id === commentId);
  if (!comment) {
    return null;
  }

  comment.status = status;
  persistComment(comment);
  return cloneComment(comment);
}

export function getCommentById(
  commentId: string,
): CollaborationCommentDto | undefined {
  const comment = comments.find((entry) => entry.id === commentId);
  return comment ? cloneComment(comment) : undefined;
}
