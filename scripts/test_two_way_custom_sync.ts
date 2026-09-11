import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { toDatabaseRow, fromDatabaseRow, TABLE_COLUMNS } from '../server/schemaAdapter.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../server/supabase.js';

interface TestCase {
  entity: string;
  table: string;
  envelopeField: string;
  frontendPayload: Record<string, any>;
}

const testCases: TestCase[] = [
  {
    entity: 'referrals',
    table: 'referrals',
    envelopeField: 'notes',
    frontendPayload: {
      site: 'Test Site A',
      suName: 'Jane Referral Doe',
      roomNumber: '101',
      dateReferred: '2026-03-11',
      status: 'Open',
      priority: 'High',
      reason: 'Urgent safeguarding accommodation needed',
      customInspectionScore: 'Grade-A',
      customNotesTag: 'EXP-1092',
      customExtraCounter: 99
    }
  },
  {
    entity: 'vulnerable',
    table: 'vulnerable_residents',
    envelopeField: 'medical_notes',
    frontendPayload: {
      site: 'Test Site B',
      suName: 'John Vulnerable Smith',
      roomNumber: '204',
      vulnerabilityCategory: 'Mental Health',
      riskLevel: 'High',
      description: 'Regular check-ins requested',
      customSupportWorker: 'Officer Sarah Connor',
      customEvacPlanCode: 'EVAC-Z-4'
    }
  },
  {
    entity: 'challenging',
    table: 'challenging_behavior',
    envelopeField: 'actions_taken',
    frontendPayload: {
      site: 'Test Site C',
      name: 'Bob Challenging Resident',
      roomNumber: '305',
      dateOfIncident: '2026-03-10',
      typeOfIssue: 'Verbal Dispute',
      riskToOthers: 'Medium',
      description: 'Dispute over quiet hours',
      customDeescalationTechnique: 'Active listening & separation',
      customResolutionCode: 'RES-OK-77'
    }
  },
  {
    entity: 'maintenance',
    table: 'maintenance_records',
    envelopeField: 'notes',
    frontendPayload: {
      site: 'Test Site D',
      roomOrArea: 'Flat 12 Bathroom',
      defectStatus: 'Pending Contractor',
      priority: 'CAT 1 (24 Hours)',
      description: 'Water leak under washbasin',
      contractor: 'Apex Plumbing Ltd',
      customContractorRef: 'PLUMB-99128',
      customWarrantyPeriod: '12 Months'
    }
  },
  {
    entity: 'spcd',
    table: 'spcd_records',
    envelopeField: 'comments',
    frontendPayload: {
      siteName: 'Test Site E',
      suName: 'Alice SPCD Walker',
      checkType: 'Night Check',
      status: 'Completed',
      declarationDate: '2026-03-11',
      officerName: 'Guard Alex',
      customBiometricScanId: 'BIO-SCAN-883',
      customBadgeColorPref: 'Emerald'
    }
  },
  {
    entity: 'sites',
    table: 'sites',
    envelopeField: 'address',
    frontendPayload: {
      name: 'Oakwood Court',
      pid: 'OAK-001',
      address: '42 Highfield Road',
      city: 'London',
      totalRooms: 35,
      status: 'Active',
      managerName: 'Eleanor Vance',
      customFireMarshal: 'Chief Ray Stantz',
      customCCTVChannelCount: 16
    }
  }
];

async function runRoundTripVerification() {
  console.log('===============================================================');
  console.log('🔍 RUNNING TWO-WAY SCHEMA ADAPTER & PERSISTENCE VERIFICATION');
  console.log('===============================================================\n');

  let adapterPassed = 0;
  let adapterFailed = 0;

  for (const tc of testCases) {
    console.log(`\n--- [TEST] Adapter In-Memory Round-Trip: ${tc.entity} -> ${tc.table} ---`);
    
    // 1. Pack into database row
    const dbRow = toDatabaseRow(tc.table, tc.frontendPayload);
    
    // Check all dbRow keys match valid column schema
    const validCols = TABLE_COLUMNS[tc.table];
    const invalidCols = Object.keys(dbRow).filter(col => !validCols.has(col));
    if (invalidCols.length > 0) {
      console.error(`❌ FAILED: Invalid columns produced for ${tc.table}:`, invalidCols);
      adapterFailed++;
      continue;
    }

    // Check envelope field contains JSON packed custom properties
    const envelopeVal = dbRow[tc.envelopeField];
    if (typeof envelopeVal !== 'string') {
      console.error(`❌ FAILED: Envelope field ${tc.envelopeField} is not a string for ${tc.table}`);
      adapterFailed++;
      continue;
    }

    let parsedEnvelope: any = {};
    try {
      parsedEnvelope = JSON.parse(envelopeVal);
    } catch (e) {
      console.error(`❌ FAILED: Envelope field ${tc.envelopeField} is not valid JSON for ${tc.table}:`, envelopeVal);
      adapterFailed++;
      continue;
    }

    // Find custom keys in payload (keys not in standard schema or mapped standardly)
    const customEntries = Object.entries(tc.frontendPayload).filter(([k]) => k.startsWith('custom'));
    let customKeysPacked = true;
    for (const [k, v] of customEntries) {
      if (parsedEnvelope[k] !== v) {
        console.error(`❌ FAILED: Custom field ${k} was not packed into envelope ${tc.envelopeField}. Expected ${v}, got ${parsedEnvelope[k]}`);
        customKeysPacked = false;
      }
    }
    if (!customKeysPacked) {
      adapterFailed++;
      continue;
    }

    // 2. Unpack back to frontend object
    const recoveredFrontend = fromDatabaseRow(tc.table, dbRow);
    let allRecovered = true;
    for (const [k, v] of customEntries) {
      if (recoveredFrontend[k] !== v) {
        console.error(`❌ FAILED: Custom field ${k} was not recovered in fromDatabaseRow. Expected ${v}, got ${recoveredFrontend[k]}`);
        allRecovered = false;
      }
    }

    if (allRecovered) {
      console.log(`✅ PASSED: ${tc.entity} correctly packed custom fields into [${tc.envelopeField}] and restored them losslessly.`);
      adapterPassed++;
    } else {
      adapterFailed++;
    }
  }

  console.log(`\nAdapter In-Memory Verification Summary: ${adapterPassed}/${testCases.length} passed.`);
  if (adapterFailed > 0) {
    process.exit(1);
  }

  // 3. Live Supabase round trip (if configured)
  console.log('\n===============================================================');
  console.log('📡 CHECKING LIVE SUPABASE CONNECTION FOR DB PERSISTENCE ROUND-TRIP');
  console.log('===============================================================\n');

  if (!isSupabaseConfigured()) {
    console.log('ℹ️ Supabase environment variables not configured in this runtime. Pure schema adapter verified 100%.');
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log('⚠️ Could not obtain Supabase admin client. Skipping live DB write.');
    return;
  }

  console.log('Connected to Supabase. Testing live DB write & read-back with custom fields...');
  let livePassed = 0;
  let liveFailed = 0;

  for (const tc of testCases) {
    console.log(`\n--- [LIVE DB] Testing ${tc.table} ---`);
    const testId = `test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payloadWithId = {
      id: testId,
      ...tc.frontendPayload,
      customLiveSyncToken: `TOKEN-${Date.now()}`
    };

    const rowToInsert = toDatabaseRow(tc.table, payloadWithId);

    // INSERT
    const { data: insertedData, error: insertError } = await supabase
      .from(tc.table)
      .insert(rowToInsert)
      .select()
      .single();

    if (insertError) {
      console.error(`⚠️ Live INSERT error on ${tc.table}:`, insertError.message);
      liveFailed++;
      continue;
    }

    // READ BACK & UNPACK
    const recovered = fromDatabaseRow(tc.table, insertedData);
    if (recovered.customLiveSyncToken === payloadWithId.customLiveSyncToken) {
      console.log(`✅ Live INSERT & READ-BACK SUCCESS: customLiveSyncToken preserved through Supabase for ${tc.table}!`);
      livePassed++;
    } else {
      console.error(`❌ Live verify FAILED: expected ${payloadWithId.customLiveSyncToken}, got ${recovered.customLiveSyncToken}`);
      liveFailed++;
    }

    // CLEANUP
    await supabase.from(tc.table).delete().eq('id', testId);
    console.log(`🧹 Cleaned up test record ${testId}`);
  }

  console.log(`\nLive Supabase Verification Summary: ${livePassed}/${testCases.length} succeeded, ${liveFailed} failed/skipped.`);
}

runRoundTripVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
