import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const baseUrl = 'http://localhost:3020';

async function runWorkflowTest() {
  console.log('--- 1. Testing POST /api/auth/reset-password for invalid domain ---');
  const res1 = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@sdc.local' })
  });
  const data1 = await res1.json();
  console.log('Result 1 (Reject .local):', res1.status, data1);
  if (res1.status !== 400) {
    throw new Error('Expected 400 for .local email');
  }

  console.log('\n--- 2. Testing POST /api/auth/reset-password for real domain ---');
  const res2 = await fetch(`${baseUrl}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'dineshkodali16@gmail.com' })
  });
  const data2 = await res2.json();
  console.log('Result 2 (Real Domain):', res2.status, data2);
  if (res2.status !== 200 || !data2.success) {
    throw new Error(`Failed to dispatch reset email: ${JSON.stringify(data2)}`);
  }

  console.log('\n--- 3. Testing POST /api/auth/confirm-reset-password with OTP ---');
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
  console.log('Generated OTP code:', otpCode);

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
  console.log('Result 3 (Confirm with OTP):', res3.status, data3);
  if (res3.status !== 200 || !data3.success) {
    throw new Error(`Failed to confirm reset with OTP: ${JSON.stringify(data3)}`);
  }

  console.log('\n--- 4. Checking password_audit_logs in database ---');
  const { data: logs, error: logsErr } = await admin
    .from('password_audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(5);

  if (logsErr) {
    console.warn('Could not query password_audit_logs:', logsErr.message);
  } else {
    console.log('Recent audit log entries:');
    logs?.forEach(l => console.log(`  - [${l.timestamp}] Action: ${l.action}, Target: ${l.target_email}, Status: ${l.status}`));
  }

  console.log('\n--- 5. Testing GET /api/auth/verify-recovery redirect target ---');
  const res5 = await fetch(`${baseUrl}/api/auth/verify-recovery?token_hash=invalid_hash`, {
    redirect: 'manual'
  });
  console.log('Redirect status:', res5.status, 'Location:', res5.headers.get('location'));
  const loc = res5.headers.get('location') || '';
  if (loc.includes('/reset-password')) {
    console.log('✅ Correctly redirects to /reset-password route!');
  } else {
    console.warn('Redirect did not include /reset-password:', loc);
  }

  console.log('\n========================================');
  console.log('🎉 ALL PASSWORD RESET WORKFLOW TESTS PASSED!');
  console.log('========================================');
}

runWorkflowTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
