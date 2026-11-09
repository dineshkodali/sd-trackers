/**
 * Service User Report History & Super Admin Archive Management Tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { FIELD_SPECS, toDatabaseRow, fromDatabaseRow, TABLE_COLUMNS } from '../server/schemaAdapter.js';
import { KNOWN_TABLES } from '../server/liveSchema.js';
import { trackReportHistoryDirect } from '../server/routes/reportHistory.js';

test('Report History: schema mapping and liveSchema registration', () => {
  assert.ok(FIELD_SPECS['service_user_report_history'], 'service_user_report_history must be registered in FIELD_SPECS');
  assert.ok(KNOWN_TABLES.includes('service_user_report_history'), 'service_user_report_history must be in KNOWN_TABLES');

  // Verify bidirectional mapping
  const appData = {
    id: 'rep-hist-001',
    reportId: 'ho-rec-100',
    suId: 'su-test-uuid',
    suName: 'Test Resident',
    suReference: 'PORT/123456',
    site: 'Site Alpha',
    reportName: 'Incident Safeguarding Report',
    reportType: 'Incident Report',
    reportCategory: 'Safeguarding & Incidents',
    fileFormat: 'docx',
    fileName: 'Incident_Safeguarding_Report.docx',
    fileSize: 4096,
    fileUrl: '/api/report-history/rep-hist-001/download',
    storageBucket: 'report-files',
    storagePath: 'service_users/su-test-uuid/reports/Incident_Safeguarding_Report.docx',
    status: 'Generated',
    generatedById: 'usr-staff-1',
    generatedByName: 'Jane Staff',
    generatedByRole: 'Staff',
    generatedAt: '2026-11-09T12:00:00.000Z',
    downloadCount: 0,
    downloadHistory: [],
    isArchived: false,
    metadata: { key: 'value' },
  };

  const dbRow = toDatabaseRow('service_user_report_history', appData);
  assert.equal(dbRow.id, 'rep-hist-001');
  assert.equal(dbRow.su_id, 'su-test-uuid');
  assert.equal(dbRow.su_name, 'Test Resident');
  assert.equal(dbRow.report_name, 'Incident Safeguarding Report');
  assert.equal(dbRow.file_format, 'docx');
  assert.equal(Number(dbRow.download_count), 0);

  const roundTripped = fromDatabaseRow('service_user_report_history', {
    ...dbRow,
    created_at: '2026-11-09T12:00:00.000Z',
    updated_at: '2026-11-09T12:00:00.000Z'
  });
  assert.equal(roundTripped.suId, 'su-test-uuid');
  assert.equal(roundTripped.suName, 'Test Resident');
  assert.equal(roundTripped.reportName, 'Incident Safeguarding Report');
  assert.equal(roundTripped.fileFormat, 'docx');
});

test('Report History: trackReportHistoryDirect creates record and stores file buffer permanently', async () => {
  const testSuId = 'su-test-' + Date.now();
  const testReportId = 'rep-' + Date.now();
  const testBuffer = Buffer.from('TEST REPORT FILE CONTENT ' + Date.now());

  const record = await trackReportHistoryDirect({
    reportId: testReportId,
    suId: testSuId,
    suName: 'Hayat Adan',
    suReference: 'MST/9412827',
    site: 'Hotel Alpha',
    reportName: 'AASC Compliance Monthly Inspection',
    reportType: 'HO Report',
    reportCategory: 'Operations',
    fileFormat: 'docx',
    fileName: 'AASC_Inspection.docx',
    buffer: testBuffer,
    status: 'Generated',
    author: {
      id: 'usr-admin-1',
      name: 'Stack Master',
      role: 'Super Admin',
      email: 'admin@sdcdms.co.uk'
    },
    metadata: { inspectionType: 'Routine' }
  });

  assert.ok(record.id, 'Must generate unique history ID');
  assert.equal(record.su_id, testSuId);
  assert.equal(record.su_name, 'Hayat Adan');
  assert.equal(record.file_format, 'docx');
  assert.equal(record.file_size, testBuffer.length);
  assert.ok(record.storage_path, 'Must assign storage path');

  // Verify file written to disk
  const reportsDir = path.join(process.cwd(), 'server', 'data', 'reports', 'files', testSuId);
  assert.ok(fs.existsSync(reportsDir), 'Directory for SU report files must exist');
  const files = fs.readdirSync(reportsDir);
  const foundFile = files.find(f => f.startsWith(record.id));
  assert.ok(foundFile, 'Stored report file must exist on disk');
  const diskContent = fs.readFileSync(path.join(reportsDir, foundFile));
  assert.equal(diskContent.toString(), testBuffer.toString(), 'Stored file content must match original buffer');

  // Clean up test file
  fs.unlinkSync(path.join(reportsDir, foundFile));
});

test('Report History: downloading report updates downloadCount and appends to downloadHistory', async () => {
  const testSuId = 'su-test-dl-' + Date.now();
  const testReportId = 'rep-dl-' + Date.now();
  const initial = await trackReportHistoryDirect({
    reportId: testReportId,
    suId: testSuId,
    suName: 'Salam Babakir',
    suReference: 'BEQ/5314292',
    site: 'Hotel Beta',
    reportName: 'Discharge Summary & Welfare Handover',
    reportType: 'HO Report',
    reportCategory: 'Welfare & Support',
    fileFormat: 'pdf',
    fileName: 'Discharge_Summary.pdf',
    status: 'Generated',
    author: {
      id: 'usr-staff-10',
      name: 'Sarah Staff',
      role: 'Staff',
      email: 'sarah@sdcdms.co.uk'
    }
  });

  assert.equal(initial.download_count, 0);

  // Simulate download event via trackReportHistoryDirect with Downloaded status
  const downloaded = await trackReportHistoryDirect({
    reportId: testReportId,
    suId: testSuId,
    suName: 'Salam Babakir',
    suReference: 'BEQ/5314292',
    site: 'Hotel Beta',
    reportName: 'Discharge Summary & Welfare Handover',
    reportType: 'HO Report',
    reportCategory: 'Welfare & Support',
    fileFormat: 'pdf',
    fileName: 'Discharge_Summary.pdf',
    status: 'Downloaded',
    author: {
      id: 'usr-admin-1',
      name: 'Stack Master',
      role: 'Super Admin',
      email: 'admin@sdcdms.co.uk'
    }
  });

  assert.equal(downloaded.download_count, 1, 'Download count should increment');
  assert.ok(downloaded.last_downloaded_at, 'Last downloaded timestamp must be set');
  assert.ok(Array.isArray(downloaded.download_history), 'Download history must be an array');
  assert.equal(downloaded.download_history.length, 1);
  assert.equal(downloaded.download_history[0].userName, 'Stack Master');
});
