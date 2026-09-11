import { neon } from "@neondatabase/serverless";

/**
 * One shared leads table across the whole portfolio. Sites are distinguished by
 * source_domain — you cannot invoice a broker per lead from an inbox.
 *
 * Parameterised queries only. Never build SQL by string concatenation. (§4.3)
 */

export interface LeadRecord {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly message: string | null;
  readonly sourceDomain: string;
  readonly sourcePage: string;
  readonly sourceTopic: string;
  readonly consentText: string;
  readonly consentVersion: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/**
 * Connection-string variables the Neon and Vercel Postgres integrations set,
 * in the order we would rather use them: pooled before direct. DATABASE_URL is
 * what .env.example documents and what a site should set by hand; the rest are
 * accepted because connecting a database through the Vercel dashboard names it
 * for you, and a working integration under another name should not read as no
 * database at all.
 */
const URL_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

function db() {
  for (const name of URL_VARS) {
    const url = process.env[name];
    if (url) return neon(url);
  }
  throw new Error(`No database connection string. Set one of: ${URL_VARS.join(", ")}.`);
}

/** Idempotent. Run once per environment before the first deploy. */
export async function migrate(): Promise<void> {
  const sql = db();
  await sql`
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
  await sql`CREATE INDEX IF NOT EXISTS leads_domain_created ON leads (source_domain, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS rate_limit (
      bucket     TEXT        PRIMARY KEY,
      count      INTEGER     NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limit (expires_at)`;
}

/** Returns the new lead's id. PII is never logged — log this id instead. (§4.4) */
export async function insertLead(record: LeadRecord): Promise<number> {
  const sql = db();
  const rows = await sql`
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
  return Number((rows[0] as { id: number }).id);
}

/** Retention: purge leads older than 24 months. Run on a schedule. (§4.4) */
export async function purgeExpiredLeads(): Promise<number> {
  const sql = db();
  const rows = await sql`
    DELETE FROM leads WHERE created_at < now() - INTERVAL '24 months' RETURNING id
  `;
  return rows.length;
}
