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

export default async function handler(request: Request): Promise<Response> {
  const dbUrl = process.env["DATABASE_URL"];

  /** Reachability and whether the table the handler writes to exists. */
  let database: "not_configured" | "unreachable" | "no_table" | "ready" = "not_configured";
  if (dbUrl) {
    try {
      const sql = neon(dbUrl);
      const rows = (await sql`SELECT to_regclass('public.leads') IS NOT NULL AS present`) as {
        present: boolean;
      }[];
      database = rows[0]?.present ? "ready" : "no_table";
    } catch {
      database = "unreachable";
    }
  }

  const email = Boolean(process.env["RESEND_API_KEY"] && process.env["LEAD_FROM_EMAIL"] && process.env["LEAD_TO_EMAIL"]);

  const body = {
    ok: database === "ready",
    /* The lead is stored first and emailed second, so storage alone is enough
       to stop losing enquiries. Email is a convenience on top. */
    database,
    emailNotifications: email ? "configured" : "not_configured",
    turnstile: "disabled",
    checkedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: body.ok ? 200 : 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
