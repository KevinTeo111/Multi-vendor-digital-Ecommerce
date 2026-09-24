/* eslint-disable no-console */
/**
 * Applies prisma/migrations/*.sql with node-postgres and records them in the same
 * `_prisma_migrations` table Prisma uses, so `prisma migrate deploy` and this runner
 * are interchangeable. Exists because Prisma's native schema engine cannot run on
 * every developer machine; production can use either command.
 */
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum"            VARCHAR(64) NOT NULL,
        "finished_at"         TIMESTAMPTZ,
        "migration_name"      VARCHAR(255) NOT NULL,
        "logs"                TEXT,
        "rolled_back_at"      TIMESTAMPTZ,
        "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`);

    const applied = new Map<string, string>();
    const rows = await client.query<{ migration_name: string; checksum: string }>(
      'SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
    );
    for (const r of rows.rows) applied.set(r.migration_name, r.checksum);

    const dirs = readdirSync(MIGRATIONS_DIR)
      .filter((d) => statSync(join(MIGRATIONS_DIR, d)).isDirectory())
      .sort();

    let count = 0;
    for (const name of dirs) {
      const sqlPath = join(MIGRATIONS_DIR, name, 'migration.sql');
      const sql = readFileSync(sqlPath);
      const checksum = createHash('sha256').update(sql).digest('hex');

      const existing = applied.get(name);
      if (existing) {
        if (existing !== checksum) {
          throw new Error(`Migration ${name} was modified after being applied (checksum mismatch)`);
        }
        continue;
      }

      console.log(`Applying ${name} …`);
      await client.query('BEGIN');
      try {
        await client.query(sql.toString('utf8'));
        await client.query(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), 1)`,
          [randomUUID(), checksum, name],
        );
        await client.query('COMMIT');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log(count === 0 ? 'Database is up to date.' : `Applied ${count} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
