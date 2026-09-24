import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma runs without its native Rust engine: all SQL goes through node-postgres.
 * Shared by the API (PrismaService) and the seed script so both use the same connection settings.
 *
 * Pool settings are tuned for serverless Postgres (Neon): idle connections are evicted before the
 * provider suspends compute and closes them, so the pool never hands out a dead socket.
 */
export function createPrismaAdapter(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  return new PrismaPg({
    connectionString,
    max: 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    // A stalled socket must surface as an error quickly instead of blocking a request for minutes.
    query_timeout: 30_000,
    statement_timeout: 30_000,
  });
}

/** Interactive transactions may span many round trips; the Prisma default of 5 s is too tight for remote databases. */
export const transactionOptions = { maxWait: 10_000, timeout: 30_000 } as const;
