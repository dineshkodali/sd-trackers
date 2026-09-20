import pg from 'pg';
const { Client } = pg;

const regions = ['eu-west-2', 'eu-west-1', 'eu-central-1', 'us-east-1', 'us-west-1'];

async function testRegion(region: string) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.kxikojvpcyprfbyxsdaa:Focusmode123!@${host}:5432/postgres`;
  console.log(`Trying ${region}...`);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    console.log(`SUCCESS! Region is ${region}!`);
    const res = await client.query('SELECT current_database(), version()');
    console.log('Query result:', res.rows[0]);
    await client.end();
    return region;
  } catch (err: any) {
    console.log(`Failed ${region}: ${err.message}`);
    try { await client.end(); } catch {}
  }
  return null;
}

async function main() {
  for (const r of regions) {
    const success = await testRegion(r);
    if (success) {
      console.log(`*** Found correct pooler region: ${r} ***`);
      break;
    }
  }
}

main().catch(console.error);
