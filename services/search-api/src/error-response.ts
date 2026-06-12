import type { ApiErrorCode, ApiErrorResponseDto } from "@retailer-search/shared-types";

function buildError(
  code: ApiErrorCode,
  message: string,
  requestId?: string,
  details?: Record<string, unknown>,
): ApiErrorResponseDto {
  return {
    success: false,
    code,
    message,
    ...(details ? { details } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

export function badRequest(
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponseDto {
  return buildError("validation_error", message, requestId, details);
}

export function validationError(
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponseDto {
  return buildError("validation_error", message, requestId, details);
}

export function unauthenticated(
  message = "Authentication required",
  requestId?: string,
): ApiErrorResponseDto {
  return buildError("unauthenticated", message, requestId);
}

export function forbidden(
  message = "You do not have permission to perform this action",
  requestId?: string,
  details?: Record<string, unknown>,
): ApiErrorResponseDto {
  return buildError("forbidden", message, requestId, details);
}

export function notFound(
  message = "Resource not found",
  requestId?: string,
): ApiErrorResponseDto {
  return buildError("not_found", message, requestId);
}

export function conflict(
  message: string,
  requestId?: string,
  details?: Record<string, unknown>,
): ApiErrorResponseDto {
  return buildError("conflict", message, requestId, details);
}

export function rateLimited(
  message = "Too many requests. Please try again later.",
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponseDto {
  return buildError("rate_limited", message, requestId, details);
}

export function internalError(
  message = "An unexpected error occurred",
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponseDto {
  return buildError("internal_error", message, requestId, details);
}
