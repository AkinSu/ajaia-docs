import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local development reads .env.local; on Vercel the variables are already set.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
