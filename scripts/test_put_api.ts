import 'dotenv/config';
import { signAdminToken } from '../server/tokenSigner.js';

async function testPut() {
  const token = signAdminToken({
    sub: 'master-admin-01',
    email: 'admin@sdcommercial.co.uk',
    role: 'Super Admin',
    iss: 'sdtracker-internal',
    exp: Math.floor(Date.now() / 1000) + 3600
  });
  console.log('Generated token for Stack Master');

  // Let's first test GET /api/auth/me
  const meRes = await fetch('http://localhost:3020/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('GET /api/auth/me status:', meRes.status);
  const meJson = await meRes.json();
  console.log('me:', meJson);

  // Now let's test PUT /api/db/publicTransport/pt-1789301745576
  const putRes = await fetch('http://localhost:3020/api/db/publicTransport/pt-1789301745576', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'Cancelled',
      updatedAt: new Date().toISOString()
    })
  });
  console.log('PUT status:', putRes.status);
  const putJson = await putRes.json();
  console.log('PUT result:', putJson);
}

testPut().catch(console.error);
