import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof createDb>;

function createDb(url: string) {
  // The HTTP driver issues one stateless request per query, so serverless
  // invocations never hold a Postgres connection open.
  return drizzle(neon(url), { schema });
}

let cached: Db | undefined;

/**
 * Lazily constructed so that `next build` succeeds without DATABASE_URL set
 * (the first hello-world deploy had no database yet).
 */
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    cached = createDb(url);
  }
  return cached;
}
