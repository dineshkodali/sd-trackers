/**
 * TEMPLATE 05: Remediation & Bug Regression Verification Template
 * 
 * Use this template whenever fixing an identified defect (e.g. BUG-012, BUG-023):
 *   1. Define exact bug ID, severity, and description
 *   2. Recreate failure condition that previously triggered the defect
 *   3. Assert that the remedy holds true and no regression occurs
 */

import { test, expect } from '../tests/helpers/fixtures';
import { listRecords } from '../tests/helpers/api';

test.describe('Remediation Verification: [BUG-XXX Defect Title]', () => {
  const BUG_ID = 'BUG-REMEDY-TEMPLATE';

  test(`${BUG_ID}: Verify defect condition is resolved and verified in live mode`, async ({ api, tag }) => {
    // 1. Arrange payload matching the failure trigger
    const triggerPayload = {
      site: 'Brit Hotel',
      suName: `${tag} Remediation Test`,
      status: 'Open',
      // Trigger condition (e.g., custom column preservation or special character handling)
      dataFieldWithSpecialChars: `Test & "Quotes" 'Single' <Tags>`,
      customDynamicColumn: 'Expected value after bug fix'
    };

    // 2. Act: Execute operation that previously failed
    const res = await api.post('/api/db/referrals', { data: triggerPayload });
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    expect(body.success).toBe(true);

    // 3. Assert: Verify post-remedy behavior matches expected spec
    const records = await listRecords(api, 'referrals');
    const retrieved = records.find((r: any) => r.suName === triggerPayload.suName);
    
    expect(retrieved).toBeDefined();
    // Regression check: Ensure custom/special fields are preserved
    expect(retrieved.customDynamicColumn).toBe(triggerPayload.customDynamicColumn);
  });
});
