import { z } from "zod";

const RULE_NAME_PATTERN = /^[\p{L}\p{N}\s._\-()&'/]+$/u;
const MERCH_LABEL_PATTERN = /^[\p{L}\p{N}\s._\-/&]+$/u;
const SEARCH_QUERY_PATTERN = /^[^\r\n<>]+$/;
const PRODUCT_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function containsHtmlMarkup(value: string): boolean {
  return /<[^>]*>/u.test(value) || /<\/?[a-zA-Z!/]/u.test(value);
}

export function containsUnsafeControlCharacters(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

function isSafePlainText(
  value: string,
  options: {
    maxLength: number;
    allowedPattern?: RegExp;
    allowEmpty?: boolean;
  },
): boolean {
  if (options.allowEmpty && value.length === 0) {
    return true;
  }
  if (value.length > options.maxLength) {
    return false;
  }
  if (containsHtmlMarkup(value) || containsUnsafeControlCharacters(value)) {
    return false;
  }
  if (options.allowedPattern && !options.allowedPattern.test(value)) {
    return false;
  }
  return true;
}

function safeTextRefine(
  options: {
    maxLength: number;
    allowedPattern?: RegExp;
    allowEmpty?: boolean;
  },
) {
  return (value: string) => {
    if (isSafePlainText(value, options)) {
      return true;
    }
    if (containsHtmlMarkup(value)) {
      return false;
    }
    return false;
  };
}

function safeTextMessage(label: string): string {
  return `${label} must not contain HTML tags or invalid characters`;
}

export const safeRuleNameSchema = z
  .string()
  .trim()
  .min(1, "Rule name is required")
  .max(120, "Rule name must be at most 120 characters")
  .refine(
    safeTextRefine({
      maxLength: 120,
      allowedPattern: RULE_NAME_PATTERN,
    }),
    { message: safeTextMessage("Rule name") },
  );

export const safeOptionalMerchandisingLabelSchema = z
  .string()
  .trim()
  .max(80, "Label must be at most 80 characters")
  .refine(
    safeTextRefine({
      maxLength: 80,
      allowedPattern: MERCH_LABEL_PATTERN,
      allowEmpty: true,
    }),
    { message: safeTextMessage("Label") },
  )
  .optional();

export const safeSearchQuerySchema = z
  .string()
  .trim()
  .min(1, "Query is required")
  .max(200, "Query must be at most 200 characters")
  .refine(
    safeTextRefine({
      maxLength: 200,
      allowedPattern: SEARCH_QUERY_PATTERN,
    }),
    { message: safeTextMessage("Query") },
  );

export const safeSearchQueryInputSchema = z
  .string()
  .trim()
  .max(200, "Query must be at most 200 characters")
  .refine(
    safeTextRefine({
      maxLength: 200,
      allowedPattern: SEARCH_QUERY_PATTERN,
      allowEmpty: true,
    }),
    { message: safeTextMessage("Query") },
  );

export const safeOptionalSearchQuerySchema = safeSearchQuerySchema.optional();

export const safeDisplayTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(200, "Text must be at most 200 characters")
  .refine((value) => !containsHtmlMarkup(value), {
    message: "Text must not contain HTML tags",
  })
  .refine((value) => !containsUnsafeControlCharacters(value), {
    message: "Text contains invalid control characters",
  });

export const safeJustificationSchema = z
  .string()
  .trim()
  .min(8, "Justification must be at least 8 characters")
  .max(2000, "Justification must be at most 2000 characters")
  .refine((value) => !containsHtmlMarkup(value), {
    message: "Justification must not contain HTML tags",
  })
  .refine((value) => !containsUnsafeControlCharacters(value), {
    message: "Justification contains invalid control characters",
  });

export const safeProductIdSchema = z
  .string()
  .trim()
  .min(1, "Product ID is required")
  .max(64, "Product ID must be at most 64 characters")
  .regex(
    PRODUCT_ID_PATTERN,
    "Product ID may only contain letters, numbers, dots, underscores, and hyphens",
  );

export function validateRuleName(name: string): { ok: true } | { ok: false; error: string } {
  const parsed = safeRuleNameSchema.safeParse(name);
  if (parsed.success) {
    return { ok: true };
  }
  return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule name" };
}

export function validateSearchQuery(
  query: string,
): { ok: true } | { ok: false; error: string } {
  const parsed = safeSearchQuerySchema.safeParse(query);
  if (parsed.success) {
    return { ok: true };
  }
  return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid query" };
}
