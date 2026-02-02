import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const DEFAULT_LOCAL_DB = "postgresql://postgres:postgres@localhost:5432/drip";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || DEFAULT_LOCAL_DB,
});

export const db = drizzle(pool, { schema });

export async function ensureSchemaSync(): Promise<void> {
  const client = await pool.connect();
  try {
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'courses'
      AND column_name = 'icon_generated_at'
    `);

    const existingColumns = columnCheck.rows.map(r => r.column_name);

    if (!existingColumns.includes('icon_generated_at')) {
      console.log('[db] Adding missing column: courses.icon_generated_at');
      try {
        await client.query('ALTER TABLE courses ADD COLUMN IF NOT EXISTS icon_generated_at timestamp');
      } catch (alterError) {
        console.error('[db] Failed to add icon_generated_at column:', alterError);
      }
    }

    // Verify column now exists
    const verifyCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'courses'
      AND column_name = 'icon_generated_at'
    `);
    const verifiedColumns = verifyCheck.rows.map(r => r.column_name);

    if (!verifiedColumns.includes('icon_generated_at')) {
      console.error('[db] CRITICAL: Required column icon_generated_at still missing after migration attempt');
      console.error('[db] The application cannot start. Please manually add the missing column:');
      console.error('[db]   ALTER TABLE courses ADD COLUMN icon_generated_at timestamp;');
      throw new Error('Database schema is missing required column: icon_generated_at. Please run the above SQL command manually.');
    } else if (!existingColumns.includes('icon_generated_at')) {
      console.log('[db] Schema sync complete - all required columns present');
    }
  } catch (error) {
    console.error('[db] Schema sync error:', error);
    throw error; // Re-throw to ensure app doesn't start with broken schema
  } finally {
    client.release();
  }
}
