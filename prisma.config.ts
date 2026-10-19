import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Load .env.local first if it exists, then fallback to .env
dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
