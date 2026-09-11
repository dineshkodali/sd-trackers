/**
 * Apply db/schema.sql (non-destructive, idempotent) and seed reference data.
 *
 *   npm run db:migrate
 *
 * Uses DATABASE_URL / DIRECT_URL / SUPABASE_DB_URL / SUPABASE_POOLER_URL from
 * .env. On networks without IPv6 the direct Supabase host is unreachable; use
 * the Session pooler string from Supabase > Connect > Session pooler.
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { runDatabaseMigrations } = await import('../server/migrate.ts');
const { seedReferenceData } = await import('../server/seed.ts');
const { invalidateLiveSchema } = await import('../server/liveSchema.ts');

const migration = await runDatabaseMigrations();
console.log(`${migration.success ? 'OK  ' : 'FAIL'} migration: ${migration.message}`);
for (const attempt of migration.attempts || []) console.log(`       tried ${attempt.endpoint}: ${attempt.error}`);

invalidateLiveSchema();
const seed = await seedReferenceData();
if (seed.seeded.length) console.log(`OK   seeded: ${seed.seeded.join(', ')}`);
if (seed.skipped.length) console.log(`     skipped: ${seed.skipped.join(', ')}`);
if (seed.errors.length) console.log(`FAIL seed errors: ${seed.errors.join('; ')}`);

process.exitCode = migration.success && seed.errors.length === 0 ? 0 : 1;
