import { z } from "zod";

export const queryUnderstandingSchema = z.object({
  intent: z.string().min(1).max(200),
  rewrittenQuery: z.string().min(1).max(200),
  searchTerms: z.array(z.string().min(1).max(80)).min(1).max(8),
  categoryHint: z.string().min(1).max(80).optional().nullable(),
  brandHint: z.string().min(1).max(80).optional().nullable(),
  synonyms: z.array(z.string().min(1).max(80)).max(8).optional(),
  confidence: z.number().min(0).max(1),
});

export type QueryUnderstandingSchema = z.infer<typeof queryUnderstandingSchema>;

export const zeroResultsRewriteSchema = z.object({
  rewrites: z.array(z.string().min(1).max(200)).min(1).max(3),
});

export type ZeroResultsRewriteSchema = z.infer<typeof zeroResultsRewriteSchema>;
