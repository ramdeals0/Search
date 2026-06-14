import { z } from "zod";

export const rerankSchema = z.object({
  rankedProductIds: z.array(z.string().min(1).max(120)).min(1).max(50),
});

export type RerankSchema = z.infer<typeof rerankSchema>;
