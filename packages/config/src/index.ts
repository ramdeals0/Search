import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SEARCH_API_PORT: z.preprocess(
    (_value) => {
      // Railway and other PaaS inject PORT; it must win over SEARCH_API_PORT.
      if (process.env.PORT !== undefined && process.env.PORT !== "") {
        return process.env.PORT;
      }

      const configured = process.env.SEARCH_API_PORT;
      if (configured !== undefined && configured !== "") {
        return configured;
      }

      return 4001;
    },
    z.coerce.number().int().positive().default(4001),
  ),
  SEARCH_API_HOST: z.string().default("0.0.0.0"),
  NEXT_PUBLIC_SEARCH_API_URL: z
    .string()
    .url()
    .default("http://localhost:4001"),
});

function loadEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error(
      "Invalid environment variables:",
      result.error.flatten().fieldErrors,
    );
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type AppEnv = z.infer<typeof envSchema>;
