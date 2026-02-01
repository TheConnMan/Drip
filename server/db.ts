import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const DEFAULT_LOCAL_DB = "postgresql://postgres:postgres@localhost:5432/drip";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_LOCAL_DB,
});

export const db = drizzle(pool, { schema });
