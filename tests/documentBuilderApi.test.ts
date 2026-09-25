/**
 * End-to-End Test Suite for Report Generator Database Persistence & API Reflection
 *
 * Verifies:
 * 1. Template catalog retrieval (GET /api/document-builder/templates)
 * 2. Database saving & reflection (POST & GET /api/document-builder/records)
 * 3. Draft updating & field persistence (PUT /api/document-builder/records/:id)
 * 4. Document export stream generation (POST /api/document-builder/records/:id/generate/:format)
 * 5. Super Admin master template updates (PUT /api/document-builder/templates/:id)
 * 6. RBAC security enforcement (non-admin blocked from modifying master templates)
 * 7. Record deletion & cleanup (DELETE /api/document-builder/records/:id)
 */

import assert from 'assert';

const BASE_URL = 'http://localhost:3020/api/document-builder';

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING REPORT GENERATOR DB & API PERSISTENCE TEST SUITE');
  console.log('================================================================');

  // Test 1: Templates Retrieval
  console.log('Test 1: Fetch templates catalog...');
  const tRes = await fetch(`${BASE_URL}/templates`);
  const tData = await tRes.json();
  assert.strictEqual(tRes.status, 200, 'Expected 200 OK for templates');
  assert.strictEqual(tData.success, true, 'Expected success: true');
  assert.ok(Array.isArray(tData.data) && tData.data.length > 0, 'Expected non-empty templates array');
  const incidentTmpl = tData.data.find((t: any) => t.id === 'tmpl-incident-report');
  assert.ok(incidentTmpl, 'Incident Report template must exist in catalog');
  console.log(`-> PASS: Found ${tData.data.length} templates (including "${incidentTmpl.name}")`);

  // Test 2: Save New Report Draft to Database
  console.log('\nTest 2: Save new report draft to database via POST /records...');
  const newReport = {
    templateId: 'tmpl-incident-report',
    templateVersionId: 'tver-incident-v1',
    site: '741- Clacton Pier Avenue',
    title: 'Incident Report — E2E Test Verification',
    fieldValues: {
      propertyId: '741- Clacton Pier Avenue',
      personReporting: 'E2E Testing Agent',
      dateOfIncident: '2026-09-25',
      offenders: 'None',
      victims: 'SU Test Resident',
      witnesses: 'Staff Witness',
      incidentDescription: 'Full database persistence verification test for report generation.',
      actionTaken: 'Immediate report logged and saved.',
      warningLetterIssued: 'No',
      safeguardingInformed: 'Yes',
      safeguardingWho: 'Local Authority Safeguarding Lead',
      policeInvolved: 'No',
      ambulanceInvolved: 'No',
      fireServiceInvolved: 'No',
    },
    status: 'draft',
  };

  const createRes = await fetch(`${BASE_URL}/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Staff',
      'x-user-name': 'Test Staff Member',
      'x-user-email': 'staff@sdcdms.co.uk',
      'x-user-site': '741- Clacton Pier Avenue',
    },
    body: JSON.stringify(newReport),
  });

  const createData = await createRes.json();
  assert.strictEqual(createRes.status, 200, 'Expected 200 OK for record creation');
  assert.strictEqual(createData.success, true, 'Expected success: true');
  assert.ok(createData.data?.id, 'Expected returned record ID');
  const savedRecordId = createData.data.id;
  console.log(`-> PASS: Successfully saved report draft with ID: ${savedRecordId} and DocNo: ${createData.data.documentNumber}`);

  // Test 3: Verify Persistence & Reflection in GET /records
  console.log('\nTest 3: Verify report reflection back in GET /records...');
  const listRes = await fetch(`${BASE_URL}/records`, {
    headers: { 'x-user-role': 'Staff', 'x-user-site': '741- Clacton Pier Avenue' },
  });
  const listData = await listRes.json();
  assert.strictEqual(listRes.status, 200, 'Expected 200 OK for records list');
  const found = listData.data?.find((r: any) => r.id === savedRecordId);
  assert.ok(found, 'Saved report must be returned in records list');
  assert.strictEqual(found.title, newReport.title, 'Title must match saved draft');
  assert.strictEqual(found.site, newReport.site, 'Site must match saved draft');
  console.log(`-> PASS: Report reflection confirmed. Found in database records list.`);

  // Test 4: Update Report Draft via PUT /records/:id
  console.log('\nTest 4: Update report draft via PUT /records/:id...');
  const updatedTitle = 'Incident Report — E2E Test Verification (Updated)';
  const updateRes = await fetch(`${BASE_URL}/records/${savedRecordId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Staff',
      'x-user-id': 'usr-staff',
      'x-user-site': '741- Clacton Pier Avenue',
    },
    body: JSON.stringify({
      title: updatedTitle,
      status: 'final',
      fieldValues: {
        ...newReport.fieldValues,
        actionTaken: 'Final actions completed and reviewed.',
      },
    }),
  });
  const updateData = await updateRes.json();
  assert.strictEqual(updateRes.status, 200, 'Expected 200 OK for record update');
  assert.strictEqual(updateData.success, true, 'Expected success: true');
  assert.strictEqual(updateData.data?.status, 'final', 'Status must be updated to final');
  assert.strictEqual(updateData.data?.title, updatedTitle, 'Title must be updated');
  console.log(`-> PASS: Successfully updated report to status: final with updated title.`);

  // Test 5: Generate and Download DOCX & PDF
  console.log('\nTest 5: Export official DOCX and PDF from saved record...');
  const docxRes = await fetch(`${BASE_URL}/records/${savedRecordId}/generate/docx`, { method: 'POST' });
  assert.strictEqual(docxRes.status, 200, 'Expected 200 OK for DOCX generation');
  assert.ok(docxRes.headers.get('content-type')?.includes('wordprocessingml'), 'Content-Type must be DOCX');
  const docxBuffer = await docxRes.arrayBuffer();
  assert.ok(docxBuffer.byteLength > 1000, `DOCX buffer must be non-empty (got ${docxBuffer.byteLength} bytes)`);

  const pdfRes = await fetch(`${BASE_URL}/records/${savedRecordId}/generate/pdf`, { method: 'POST' });
  assert.strictEqual(pdfRes.status, 200, 'Expected 200 OK for PDF generation');
  assert.ok(pdfRes.headers.get('content-type')?.includes('application/pdf'), 'Content-Type must be PDF');
  const pdfBuffer = await pdfRes.arrayBuffer();
  assert.ok(pdfBuffer.byteLength > 1000, `PDF buffer must be non-empty (got ${pdfBuffer.byteLength} bytes)`);
  console.log(`-> PASS: Generated DOCX (${docxBuffer.byteLength} bytes) and PDF (${pdfBuffer.byteLength} bytes).`);

  // Test 6: Super Admin updates master template
  console.log('\nTest 6: Super Admin updates master template form...');
  const templateUpdateRes = await fetch(`${BASE_URL}/templates/tmpl-incident-report`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Super Admin',
      'x-user-name': 'Stack Master',
    },
    body: JSON.stringify({
      template: {
        description: 'Official UKVI & Clearsprings compliant incident report form with full factual disclosure, authority notifications, and evidence tracking (Super Admin Verified).',
      },
    }),
  });
  const templateUpdateData = await templateUpdateRes.json();
  assert.strictEqual(templateUpdateRes.status, 200, 'Expected 200 OK for Super Admin template update');
  assert.strictEqual(templateUpdateData.success, true, 'Expected success: true');
  console.log(`-> PASS: Super Admin successfully updated master template in database.`);

  // Test 7: RBAC Guard — Non-admin is blocked from updating master template
  console.log('\nTest 7: Verify RBAC security: regular staff blocked from updating master template...');
  const forbiddenRes = await fetch(`${BASE_URL}/templates/tmpl-incident-report`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'Staff',
      'x-user-name': 'Regular Staff',
    },
    body: JSON.stringify({
      template: { description: 'Hacked description' },
    }),
  });
  assert.strictEqual(forbiddenRes.status, 403, 'Expected 403 Forbidden for non-admin template update');
  console.log(`-> PASS: RBAC successfully rejected non-admin modification with 403 Forbidden.`);

  // Test 8: Clean up test record
  console.log('\nTest 8: Cleanup test record via DELETE /records/:id...');
  const deleteRes = await fetch(`${BASE_URL}/records/${savedRecordId}`, {
    method: 'DELETE',
    headers: { 'x-user-role': 'Super Admin' },
  });
  const deleteData = await deleteRes.json();
  assert.strictEqual(deleteRes.status, 200, 'Expected 200 OK for record deletion');
  assert.strictEqual(deleteData.success, true, 'Expected success: true');
  console.log(`-> PASS: Successfully cleaned up test report record.`);

  console.log('\n================================================================');
  console.log('ALL REPORT GENERATOR DB & API TESTS COMPLETED AND PASSED 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
