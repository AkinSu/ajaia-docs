import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  const pool = new Pool({
    connectionString: url,
    // Serverless invocations are short-lived and concurrent, so each instance
    // keeps at most a couple of connections and hands them back quickly.
    // In production the URL points at Neon's pooled (-pooler) endpoint, which
    // multiplexes these through PgBouncer so Postgres never runs out of slots.
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Neon requires TLS; a local Docker Postgres does not offer it.
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  });

  // A pool error must not take the process down.
  pool.on("error", (error) => console.error("Postgres pool error", error));

  return drizzle(pool, { schema });
}

let cached: Db | undefined;

/**
 * Lazily constructed so `next build` succeeds without DATABASE_URL set.
 * The standard TCP driver is used rather than a Neon-specific one so the exact
 * same code runs against local Postgres and against Neon in production.
 */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = createDb(url);
  }
  return cached;
}
