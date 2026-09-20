import pg from 'pg';
const { Client } = pg;

const regions = [
  'eu-north-1',
  'eu-west-3',
  'ca-central-1',
  'us-east-2',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1'
];

async function testRegion(region: string) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.kxikojvpcyprfbyxsdaa:Focusmode123!@${host}:5432/postgres`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 4000,
  });
  try {
    await client.connect();
    console.log(`SUCCESS! Region is ${region}!`);
    const res = await client.query('SELECT current_database(), version()');
    console.log('Query result:', res.rows[0]);
    await client.end();
    return region;
  } catch (err: any) {
    if (!err.message.includes('not found')) {
      console.log(`Response from ${region}: ${err.message}`);
    }
    try { await client.end(); } catch {}
  }
  return null;
}

async function main() {
  for (const r of regions) {
    const success = await testRegion(r);
    if (success) {
      console.log(`*** Found correct pooler region: ${r} ***`);
      process.exit(0);
    }
  }
  console.log('None of the regions matched directly.');
}

main().catch(console.error);
