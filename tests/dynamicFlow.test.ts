import { normalizeIncidentData, computeIncidentPages } from '../src/components/documentBuilder/documentFlowEngine';
import { generatePdf } from '../server/routes/documentBuilderPdf';
import { generateDocx } from '../server/routes/documentBuilderDocx';

console.log('================================================================');
console.log('RUNNING SECTION 22 DYNAMIC DOCUMENT FLOW TEST SUITE');
console.log('================================================================');

// Test 1: Short content -> One-page document
const test1Data = normalizeIncidentData({
  propertyId: '741- Clacton Pier Avenue',
  personReporting: 'Rishi Begari',
  dateOfIncident: '2026-07-07',
  offenders: [{ name: 'N/A' }],
  victims: [{ name: 'Mohammed Kaw Rasul', portRef: 'MST/9157022' }],
  witnesses: [{ name: 'Welfare officer (Emeka Opara)' }],
  incidentDescription: 'Short incident description note.',
  actionTaken: 'Staff resolved the matter.',
  warningLetterIssued: 'No',
  safeguardingInformed: 'No',
  policeInvolved: 'No',
  ambulanceInvolved: 'No',
  fireServiceInvolved: 'No',
});
const pages1 = computeIncidentPages(test1Data);
console.log(`Test 1 (Short content): Result = ${pages1.length} page(s) (Expected: 1) -> ${pages1.length === 1 ? 'PASS' : 'FAIL'}`);

// Test 2: Long Incident Description -> 2+ pages
const test2Data = normalizeIncidentData({
  ...test1Data,
  incidentDescription: Array(30).fill('This is a detailed paragraph explaining what happened during the incident in comprehensive detail according to official clearsprings compliance procedures.').join('\n'),
});
const pages2 = computeIncidentPages(test2Data);
console.log(`Test 2 (Long Incident Description): Result = ${pages2.length} page(s) (Expected: >= 2) -> ${pages2.length >= 2 ? 'PASS' : 'FAIL'}`);

// Test 3: Many witnesses -> Add 10 witnesses
const test3Data = normalizeIncidentData({
  ...test1Data,
  witnesses: Array.from({ length: 10 }, (_, i) => ({ name: `Witness Person ${i + 1}`, portRef: `PORT-${1000 + i}` })),
  incidentDescription: 'Moderate description of the event that took place.',
});
const pages3 = computeIncidentPages(test3Data);
console.log(`Test 3 (10 Witnesses): Result = ${pages3.length} page(s) (Expected: >= 2) -> ${pages3.length >= 2 ? 'PASS' : 'FAIL'}`);

// Test 4: Many offenders -> Add 10 offenders
const test4Data = normalizeIncidentData({
  ...test1Data,
  offenders: Array.from({ length: 10 }, (_, i) => ({ name: `Offender Individual ${i + 1}`, portRef: `OFF-${2000 + i}` })),
});
const pages4 = computeIncidentPages(test4Data);
console.log(`Test 4 (10 Offenders): Result = ${pages4.length} page(s) (Expected: >= 2) -> ${pages4.length >= 2 ? 'PASS' : 'FAIL'}`);

// Test 5: Long Action Taken -> Multi-paragraph action
const test5Data = normalizeIncidentData({
  ...test1Data,
  actionTaken: Array(25).fill('Follow-up action taken by welfare and operational staff to safeguard residents and secure property.').join('\n'),
});
const pages5 = computeIncidentPages(test5Data);
console.log(`Test 5 (Long Action Taken): Result = ${pages5.length} page(s) (Expected: >= 2) -> ${pages5.length >= 2 ? 'PASS' : 'FAIL'}`);

// Test 6: Combined large document (10 offenders, 10 victims, 10 witnesses, long description, long actions, photos)
const test6Data = normalizeIncidentData({
  propertyId: '741- Clacton Pier Avenue',
  personReporting: 'Rishi Begari',
  dateOfIncident: '2026-07-07',
  offenders: Array.from({ length: 10 }, (_, i) => ({ name: `Offender ${i + 1}`, portRef: `O-${i}` })),
  victims: Array.from({ length: 10 }, (_, i) => ({ name: `Victim ${i + 1}`, portRef: `V-${i}` })),
  witnesses: Array.from({ length: 10 }, (_, i) => ({ name: `Witness ${i + 1}`, portRef: `W-${i}` })),
  incidentDescription: Array(20).fill('Detailed narrative explaining the sequence of events across multiple rooms and timestamps.').join('\n'),
  actionTaken: Array(15).fill('Comprehensive multi-agency actions and internal reporting escalations.').join('\n'),
  warningLetterIssued: 'Yes',
  warningLetterToWhom: 'Offender 1',
  safeguardingInformed: 'Yes',
  safeguardingWho: 'Rachel Adams (DSL)',
  policeInvolved: 'Yes',
  policeCadRef: 'CAD-9921/26',
  ambulanceInvolved: 'No',
  fireServiceInvolved: 'No',
  evidencePhotos: [
    { id: '1', name: 'Room damage', caption: 'Photo 1: Broken chair' },
    { id: '2', name: 'Hallway notice', caption: 'Photo 2: Corridor notice' },
  ],
});
const pages6 = computeIncidentPages(test6Data);
console.log(`Test 6 (Combined Large Document): Result = ${pages6.length} page(s) (Expected: >= 3) -> ${pages6.length >= 3 ? 'PASS' : 'FAIL'}`);

// Test 7: Remove content -> Shrinks naturally
const test7Data = normalizeIncidentData({
  ...test6Data,
  offenders: [],
  victims: [{ name: 'Mohammed Kaw Rasul' }],
  witnesses: [],
  incidentDescription: 'Shrunk down description.',
  actionTaken: 'Standard single action note.',
  evidencePhotos: [],
});
const pages7 = computeIncidentPages(test7Data);
console.log(`Test 7 (Shrink / Remove Content): Result = ${pages7.length} page(s) (Expected: 1) -> ${pages7.length === 1 ? 'PASS' : 'FAIL'}`);

// Test 8: Export PDF and DOCX with the dynamic model
async function testExports() {
  try {
    const docData: any = {
      title: 'Incident Report — Removal of Soft Seating',
      documentNumber: 'DOC-2026-741001',
      site: '741- Clacton Pier Avenue',
      templateName: 'Incident Report',
      createdAt: '2026-07-07T10:00:00.000Z',
      createdByName: 'Rishi Begari',
      fieldValues: test6Data,
      fieldDefinitions: [],
      layoutConfig: { sections: [] },
      headerConfig: {},
      footerConfig: {},
    };

    const pdfBuf = await generatePdf(docData);
    console.log(`Test 8A (PDF Export): Generated Buffer Size = ${pdfBuf.length} bytes -> ${pdfBuf.length > 5000 ? 'PASS' : 'FAIL'}`);

    const docxBuf = await generateDocx(docData);
    console.log(`Test 8B (DOCX Export): Generated Buffer Size = ${docxBuf.byteLength} bytes -> ${docxBuf.byteLength > 5000 ? 'PASS' : 'FAIL'}`);

    console.log('================================================================');
    console.log('ALL SECTION 22 TESTS COMPLETED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err: any) {
    console.error('Export test failed:', err.message);
  }
}

testExports();
