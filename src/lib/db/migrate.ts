import { Client } from 'pg'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

export async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log('[migrations] DATABASE_URL not set — skipping auto-migrations')
    return
  }

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    console.log('[migrations] Connected to database')

    // Create tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT now()
      )
    `)

    // Read migration files sorted by name
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort()

    if (files.length === 0) {
      console.log('[migrations] No migration files found')
      return
    }

    // Get already-applied migrations
    const { rows } = await client.query('SELECT name FROM _migrations')
    const applied = new Set(rows.map((r: { name: string }) => r.name))

    const pending = files.filter((f) => !applied.has(f))

    if (pending.length === 0) {
      console.log(`[migrations] All ${files.length} migrations already applied`)
      return
    }

    for (const file of pending) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8')
      try {
        await client.query('BEGIN')
        await client.query(sql)
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        console.log(`[migrations] Applied: ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`[migrations] Failed to apply ${file}:`, err)
        // Continue with next migration — don't block startup
      }
    }

    console.log(`[migrations] Done — ${pending.length} applied, ${applied.size} already up-to-date`)
  } catch (err) {
    console.error('[migrations] Connection error:', err)
    // Never block server startup
  } finally {
    await client.end().catch(() => {})
  }
}
