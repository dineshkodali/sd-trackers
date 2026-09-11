import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

/**
 * Applies db/schema.sql - a non-destructive, idempotent script - to the
 * Supabase Postgres database.
 *
 * Supabase's direct host (db.<ref>.supabase.co:5432) is IPv6-only unless the
 * IPv4 add-on is enabled, so on many networks it is unreachable. Every
 * configured connection string is tried in turn; set DATABASE_URL to the
 * "Session pooler" string from the Supabase dashboard (Connect > Session
 * pooler) for an IPv4-reachable endpoint.
 *
 * This function previously reported success whenever the Supabase HTTPS API
 * answered, even though no DDL had run - so a missing table was never
 * surfaced. It now reports exactly what happened.
 */

export interface MigrationResult {
  success: boolean;
  message: string;
  applied: boolean;
  endpoint?: string;
  attempts?: { endpoint: string; error: string }[];
}

// Arbitrary constant key: serialises concurrent migrations from multiple
// server instances booting at the same time.
const MIGRATION_LOCK_KEY = 815_204_117;

function candidateConnectionStrings(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of [
    process.env.SUPABASE_POOLER_URL,
    process.env.DATABASE_URL,
    process.env.DIRECT_URL,
    process.env.SUPABASE_DB_URL,
  ]) {
    const v = (value || '').trim();
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** host:port only - never the credentials. */
function describeEndpoint(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    return `${u.hostname}:${u.port || '5432'}`;
  } catch {
    return '(unparseable connection string)';
  }
}

function explain(err: any): string {
  const code = err?.code ? `${err.code} ` : '';
  const msg = String(err?.message || err);
  if (err?.code === '28P01') return `${code}password authentication failed - update the database password in .env`;
  if (['ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND', 'ENOENT', 'ETIMEDOUT', 'ECONNREFUSED'].includes(err?.code) || /timeout|getaddrinfo/i.test(msg)) {
    return `${code}endpoint unreachable (the direct Supabase host is IPv6-only - use the Session pooler URL)`;
  }
  return `${code}${msg}`.slice(0, 300);
}

export function loadSchemaSql(): string | null {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) return null;
  return fs.readFileSync(schemaPath, 'utf8').replace(/^﻿/, '');
}

export async function runDatabaseMigrations(): Promise<MigrationResult> {
  const candidates = candidateConnectionStrings();
  if (candidates.length === 0) {
    return {
      success: false,
      applied: false,
      message: 'No PostgreSQL connection string configured (set DATABASE_URL to the Supabase Session pooler URL). Schema migration not applied.',
    };
  }

  const sql = loadSchemaSql();
  if (!sql) {
    return { success: false, applied: false, message: 'db/schema.sql not found. Schema migration not applied.' };
  }

  const attempts: { endpoint: string; error: string }[] = [];

  for (const connectionString of candidates) {
    const endpoint = describeEndpoint(connectionString);
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10_000,
      statement_timeout: 120_000,
    });

    try {
      await client.connect();
    } catch (err: any) {
      attempts.push({ endpoint, error: explain(err) });
      try { await client.end(); } catch {}
      continue;
    }

    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
      await client.query(sql);
      await client.query('COMMIT');
      await client.end();
      return {
        success: true,
        applied: true,
        endpoint,
        message: `Database schema applied via ${endpoint}: all tables, columns, triggers, indexes and RLS policies are in place.`,
      };
    } catch (err: any) {
      try { await client.query('ROLLBACK'); } catch {}
      try { await client.end(); } catch {}
      // Connected but the script itself failed: do not try other endpoints,
      // they point at the same database and would fail identically.
      return {
        success: false,
        applied: false,
        endpoint,
        attempts,
        message: `Schema migration rolled back (no changes made): ${explain(err)}`,
      };
    }
  }

  return {
    success: false,
    applied: false,
    attempts,
    message: `Schema migration not applied - no database endpoint accepted the connection: ${attempts
      .map(a => `${a.endpoint} (${a.error})`)
      .join('; ')}`,
  };
}
