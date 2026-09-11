/**
 * Creates the leads and rate_limit tables. Idempotent: safe to run again.
 *
 * Run once per environment, from a machine with DATABASE_URL set, before the
 * first real enquiry:
 *
 *   DATABASE_URL="postgres://..." npm run migrate
 *
 * Deliberately a local script and not an API route. A public endpoint that can
 * create tables is a liability for the one minute a year it is useful.
 */
import { migrate } from "@uaeprop/site-kit/leads";

if (!process.env["DATABASE_URL"]) {
  console.error("DATABASE_URL is not set.\n");
  console.error("Copy the pooled connection string from the Neon dashboard and run:");
  console.error('  DATABASE_URL="postgres://..." npm run migrate');
  process.exit(1);
}

try {
  await migrate();
  console.log("Tables are in place. The enquiry form can store submissions.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
