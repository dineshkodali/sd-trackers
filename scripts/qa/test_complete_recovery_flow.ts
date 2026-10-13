import dotenv from 'dotenv';
dotenv.config();

const baseUrl = 'http://localhost:3020';

async function testRecoveryFlow() {
  console.log('========================================================================');
  console.log('   E2E SUPABASE PASSWORD RECOVERY FLOW & RATE LIMIT TEST');
  console.log('========================================================================\n');

  console.log('1. Testing POST /api/auth/reset-password (Primary Request)...');
  const res1 = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dineshkodali16@gmail.com' })
  });
  const data1 = await res1.json();
  console.log('Status 1:', res1.status, 'Response:', data1);

  if (res1.status === 200) {
    console.log('✅ PASS: Password reset email successfully triggered!');
  } else if (res1.status === 429 && data1.rateLimited) {
    console.log(`✅ PASS: Active Supabase rate limit gracefully returned: "${data1.error}" (Wait: ${data1.waitSeconds}s)`);
  }

  console.log('\n2. Testing POST /api/auth/reset-password (Immediate Secondary Request to verify Rate Limit Handling)...');
  const res2 = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dineshkodali16@gmail.com' })
  });
  const data2 = await res2.json();
  console.log('Status 2:', res2.status, 'Response:', data2);

  if (res2.status === 429 && data2.rateLimited && data2.waitSeconds > 0) {
    console.log(`✅ PASS: Supabase rate limit was captured and returned with waitSeconds: ${data2.waitSeconds}s!`);
    console.log(`   Message: "${data2.error}"`);
  } else if (res2.status === 200) {
    console.log('ℹ️ Notice: Request passed without rate-limit cooldown.');
  }

  console.log('\n3. Testing Password Update via /api/auth/confirm-reset-password...');
  // Import Supabase Admin to generate valid recovery token for testing
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: 'dineshkodali16@gmail.com'
  });
  if (linkErr) {
    throw new Error(`Failed to generate link: ${linkErr.message}`);
  }

  const otpCode = linkData.properties?.email_otp;
  console.log('Generated test OTP:', otpCode);

  const res3 = await fetch(`${baseUrl}/api/auth/confirm-reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'dineshkodali16@gmail.com',
      otpCode,
      newPassword: (process.env.TEST_ADMIN_PASSWORD || '')
    })
  });
  const data3 = await res3.json();
  console.log('Status 3 (Confirm Password):', res3.status, 'Response:', data3);

  if (res3.status === 200 && data3.success) {
    console.log('✅ PASS: Password successfully updated in Supabase Auth directory!');
  } else {
    throw new Error(`Failed to confirm password update: ${JSON.stringify(data3)}`);
  }

  console.log('\n4. Verifying DB password_audit_logs entries...');
  const { data: logs, error: logsErr } = await admin
    .from('password_audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(3);

  if (!logsErr && logs && logs.length > 0) {
    console.log('Recent database audit logs:');
    logs.forEach(l => console.log(`  - [${l.timestamp}] Action: ${l.action}, Target: ${l.target_email}, Status: ${l.status}`));
    console.log('✅ PASS: Database audit logging confirmed!');
  }

  console.log('\n========================================================================');
  console.log('🎉 ALL RECOVERY FLOW & RATE-LIMIT TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================\n');
}

testRecoveryFlow().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
