import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pino } from 'pino';
import { pool } from './pool.js';

const log = pino({ transport: { target: 'pino-pretty' } });
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      log.warn({ migrationsDir }, 'Migrations directory not found, skipping');
      return;
    }
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    // If _migrations is empty but the main table already exists (init.sql ran),
    // mark all migrations up to the last one without task_embedding as pre-applied.
    const { rows: tracked } = await client.query('SELECT name FROM _migrations');
    if (tracked.length === 0) {
      const { rows: tableExists } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'meeseeks'`,
      );
      if (tableExists.length > 0) {
        // Seed all migrations that don't add new columns as already-applied
        const { rows: cols } = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'learned_strategies'`,
        );
        const colNames = cols.map((c: { column_name: string }) => c.column_name);
        for (const file of files) {
          // Skip seeding migrations whose columns don't yet exist (let them run)
          const needsVector = file.includes('pgvector') || file.includes('006');
          if (needsVector && !colNames.includes('task_embedding')) continue;
          await client.query('INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
          log.info({ file }, 'Seeded migration as pre-applied (schema already exists)');
        }
      }
    }

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT name FROM _migrations WHERE name = $1',
        [file],
      );
      if (rows.length > 0) {
        log.info({ file }, 'Migration already applied, skipping');
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      log.info({ file }, 'Applying migration...');
      await client.query('SAVEPOINT migration_start');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('RELEASE SAVEPOINT migration_start');
        log.info({ file }, 'Migration applied');
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT migration_start');
        log.error({ file, err }, 'Migration failed — rolled back');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
