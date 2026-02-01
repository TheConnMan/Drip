import { defineConfig } from "drizzle-kit";

const DEFAULT_LOCAL_DB = "postgresql://postgres:postgres@localhost:5432/drip";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || DEFAULT_LOCAL_DB,
  },
});
