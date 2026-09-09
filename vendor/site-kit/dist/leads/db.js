import { neon } from "@neondatabase/serverless";
function db() {
    const url = process.env["DATABASE_URL"];
    if (!url)
        throw new Error("DATABASE_URL is not configured.");
    return neon(url);
}
/** Idempotent. Run once per environment before the first deploy. */
export async function migrate() {
    const sql = db();
    await sql `
    CREATE TABLE IF NOT EXISTS leads (
      id              BIGSERIAL PRIMARY KEY,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      name            TEXT        NOT NULL,
      email           TEXT        NOT NULL,
      phone           TEXT        NOT NULL,
      message         TEXT,
      source_domain   TEXT        NOT NULL,
      source_page     TEXT        NOT NULL,
      source_topic    TEXT        NOT NULL,
      consent_text    TEXT        NOT NULL,
      consent_version TEXT        NOT NULL,
      ip_address      INET,
      user_agent      TEXT,
      delivered_at    TIMESTAMPTZ,
      broker_ref      TEXT
    )
  `;
    await sql `CREATE INDEX IF NOT EXISTS leads_domain_created ON leads (source_domain, created_at DESC)`;
    await sql `CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at)`;
    await sql `
    CREATE TABLE IF NOT EXISTS rate_limit (
      bucket     TEXT        PRIMARY KEY,
      count      INTEGER     NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
    await sql `CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limit (expires_at)`;
}
/** Returns the new lead's id. PII is never logged — log this id instead. (§4.4) */
export async function insertLead(record) {
    const sql = db();
    const rows = await sql `
    INSERT INTO leads (
      name, email, phone, message,
      source_domain, source_page, source_topic,
      consent_text, consent_version, ip_address, user_agent
    ) VALUES (
      ${record.name}, ${record.email}, ${record.phone}, ${record.message},
      ${record.sourceDomain}, ${record.sourcePage}, ${record.sourceTopic},
      ${record.consentText}, ${record.consentVersion},
      ${record.ipAddress}, ${record.userAgent}
    )
    RETURNING id
  `;
    return Number(rows[0].id);
}
/** Retention: purge leads older than 24 months. Run on a schedule. (§4.4) */
export async function purgeExpiredLeads() {
    const sql = db();
    const rows = await sql `
    DELETE FROM leads WHERE created_at < now() - INTERVAL '24 months' RETURNING id
  `;
    return rows.length;
}
//# sourceMappingURL=db.js.map