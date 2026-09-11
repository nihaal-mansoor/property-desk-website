/**
 * Says whether the enquiry path can actually accept a lead, without sending
 * one. The form is the site's only conversion route, and it failed silently
 * for days: every POST returned FUNCTION_INVOCATION_FAILED, which looks like
 * an ordinary server error from the outside and shows up nowhere unless you
 * go looking. This makes the failure legible in one request.
 *
 * Reports configuration only. No secret, no value, no connection string, and
 * no count of anything, ever: booleans and a reachability check. Safe to leave
 * public and safe to curl from anywhere.
 */
import { neon } from "@neondatabase/serverless";

/** Minimal shape of Node's ServerResponse that this file touches. */
interface NodeRes {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

/**
 * Vercel's Node runtime calls the default export with Node's (req, res), not
 * with a web Request. Returning a Response there sends nothing and the request
 * hangs until the platform gives up, which is precisely how this endpoint
 * failed. Accept either convention rather than assume one.
 */
export default async function handler(a: unknown, b?: NodeRes): Promise<Response | void> {
  const body = await report();
  const status = body.ok ? 200 : 503;
  const text = JSON.stringify(body, null, 2);

  if (typeof Request !== "undefined" && a instanceof Request) {
    return new Response(text, {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const res = b as NodeRes;
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(text);
}

async function report() {
  const dbUrl = process.env["DATABASE_URL"];

  /* Reachability and whether the table the handler writes to exists.
     Bounded, because an unreachable database does not refuse a connection, it
     leaves you waiting: the first version of this check had no timeout and hung
     until the platform killed it, answering nothing at all. A health check that
     can hang is worse than none, because it reports the same silence whether
     the fault is the database or the function. */
  let database: "not_configured" | "timeout" | "unreachable" | "no_table" | "ready" =
    "not_configured";
  if (dbUrl) {
    const TIMEOUT_MS = 5000;
    const probe = (async () => {
      const sql = neon(dbUrl);
      const rows = (await sql`SELECT to_regclass('public.leads') IS NOT NULL AS present`) as {
        present: boolean;
      }[];
      return rows[0]?.present ? ("ready" as const) : ("no_table" as const);
    })();
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), TIMEOUT_MS),
    );
    try {
      database = await Promise.race([probe, timeout]);
    } catch {
      database = "unreachable";
    }
  }

  const email = Boolean(process.env["RESEND_API_KEY"] && process.env["LEAD_FROM_EMAIL"] && process.env["LEAD_TO_EMAIL"]);

  return {
    ok: database === "ready",
    /* The lead is stored first and emailed second, so storage alone is enough
       to stop losing enquiries. Email is a convenience on top. */
    database,
    emailNotifications: email ? "configured" : "not_configured",
    turnstile: "disabled",
    checkedAt: new Date().toISOString(),
  };
}
