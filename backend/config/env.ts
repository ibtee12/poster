import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  SESSION_SECRET: z.string().default("poster_maker_jwt_session_secret_key_994827163"),
  WATERMARK_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === "true" || val === undefined),
  WATERMARK_TEXT: z.string().default("POSTER MAKER PREVIEW"),
  MODERATION_PROVIDER: z.string().default("none"),
  REMOVE_BG_PROVIDER: z.string().default("none"),
  REMOVE_BG_API_KEY: z.string().optional(),
  REMBG_URL: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  REPLICATE_MODEL: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration. Check server environment variables.");
  }
  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
