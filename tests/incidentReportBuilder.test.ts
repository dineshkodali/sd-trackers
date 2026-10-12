import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { SCENARIOS, SITES, EMAIL_TYPES, WARNING_OPTIONS, AUTH_ROWS } from '../src/components/documentBuilder/incident/incidentData';
import {
  BUILDER_KEY,
  applyScenario,
  buildIncidentDocx,
  countPlaceholders,
  defsFor,
  emailBody,
  emailSubject,
  freshState,
  getScenario,
  normalizeState,
  portRefs,
  reportChecks,
  reportFileName,
  resolveReport,
  sanitizeState,
  suggestTitle,
  toFieldValues,
  type BuilderState,
} from '../src/components/documentBuilder/incident/incidentEngine';
import { normalizeIncidentData, computeIncidentPages } from '../src/components/documentBuilder/documentFlowEngine';
import { generatePdf } from '../server/routes/documentBuilderPdf';
import { generateDocx } from '../server/routes/documentBuilderDocx';

const TEMPLATE = fs.readFileSync(path.join(process.cwd(), 'public', 'templates', 'incident', 'Incident_Report_Master.docx'));

function filledState(id: string): BuilderState {
  const st = freshState();
  applyScenario(st, id);
  st.core.propertyChoice = '519';
  st.core.propertyId = '519 (Brit Hotel)';
  st.core.reporter = 'Jane Doe (HO)';
  st.core.date = '2026-10-12';
  const defs = defsFor(getScenario(id));
  for (const k of Object.keys(defs)) {
    const d = defs[k];
    if (d.type === 'time') st.values[k] = '14:30';
    else if (d.type === 'date') st.values[k] = '2026-10-10';
    else if (d.type === 'select') st.values[k] = d.options![0][0];
    else if (k === 'su') st.values[k] = 'John Smith (CIU/123456)';
    else if (k === 'su2') st.values[k] = 'Jane Roe (MST/654321)';
    else st.values[k] = `value-${k}`;
  }
  return normalizeState(st);
}

describe('Incident Report Builder — data', () => {
  test('all 19 scenarios, 15 sites, 5 warning options and 4 authority rows are present', () => {
    assert.equal(SCENARIOS.length, 19);
    assert.equal(SITES.length, 15);
    assert.deepEqual(WARNING_OPTIONS, ['N/A', 'Requesting', 'Please issue', 'Yes', 'No']);
    assert.deepEqual(AUTH_ROWS.map(a => a.label), ['Safeguarding Informed?', 'Police Involved?', 'Ambulance Involved?', 'Fire Service Involved?']);
    assert.deepEqual(EMAIL_TYPES.map(e => e[0]), ['standard', 'warning', 'review', 'updated', 'hpn']);
    assert.equal(new Set(SCENARIOS.map(s => s.id)).size, SCENARIOS.length, 'scenario ids are unique');
  });
});

describe('Incident Report Builder — wording engine', () => {
  test('a fresh report is all red placeholders, never an unresolved {token}', () => {
    for (const scn of SCENARIOS) {
      const st = normalizeState(applyScenario(freshState(), scn.id));
      const r = resolveReport(st);
      const all = [r.lead, ...r.bullets, ...r.actions].join('\n');
      assert.ok(!/\{\w+(\|\w+)?\}/.test(all), `${scn.id}: unresolved token in "${all}"`);
      assert.ok(countPlaceholders(r) >= 3, `${scn.id}: expected placeholders on an empty report`);
    }
  });

  test('filled reports contain no placeholders in the scenario text', () => {
    for (const scn of SCENARIOS.filter(s => s.id !== 'blank')) {
      const r = resolveReport(filledState(scn.id));
      const text = [r.lead, ...r.bullets, ...r.actions].join('\n');
      assert.ok(!/\[[^\]\n]*\]/.test(text), `${scn.id}: leftover placeholder in "${text}"`);
    }
  });

  test('fire alarm covered (SU present) produces the agreed wording', () => {
    const st = filledState('fire_present');
    st.values.material = 'socks';
    st.values.checkType = 'welfare';
    st.values.ho = ''; // blank -> uses the Person Reporting name
    const r = resolveReport(st);
    assert.equal(r.lead, 'Fire alarm covered with socks');
    assert.equal(
      r.bullets[0],
      'At 14:30 hrs, during routine welfare checks, Housing Officer Jane Doe found the fire alarm covered with socks in the room of SU John Smith (CIU/123456). (Please see attached photo on the email for reference).'
    );
    assert.deepEqual(r.actions, ['Removed the socks from the fire alarm.', 'Fire Safety rules explained.', 'Verbal warning was issued to the SU.']);
    assert.equal(r.warningIssued, 'Requesting');
    assert.equal(r.offenders, 'John Smith (CIU/123456)');
    assert.equal(r.date, '12/10/2026');
  });

  test('HO name falls back to the person reporting; dates and times are formatted', () => {
    const st = filledState('ftt_absent');
    st.values.ho = '';
    const r = resolveReport(st);
    assert.match(r.bullets[1], /^Housing Officer Jane Doe was unable to reach the SU/);
    assert.match(r.bullets[2], /The last recorded signature was on 10\/10\/2026 at 14:30 hrs\./);
  });

  test('missing SU switches the safeguarding line and marks the police as involved', () => {
    const st = filledState('missing');
    assert.equal(resolveReport(st).bullets[5], 'There are no safeguarding markers on the SU.');
    st.values.safeguarding = 'present';
    st.values.markerDetails = 'CSE concern';
    const r = resolveReport(st);
    assert.equal(r.bullets[5], 'The SU has the following safeguarding marker(s) on record: CSE concern.');
    assert.equal(r.auth[1].inv, 'Yes');
  });

  test('medical emergency defaults: offenders N/A and ambulance involved', () => {
    const st = normalizeState(applyScenario(freshState(), 'ambulance'));
    const r = resolveReport(st);
    assert.equal(r.offenders, 'N/A');
    assert.equal(r.auth[2].inv, 'Yes');
  });

  test('an edited line is kept; "restore" semantic (edited=false) returns the standard wording', () => {
    const st = filledState('cig_present');
    st.drafts.cig_present.bullets[1].text = 'My own words.';
    st.drafts.cig_present.bullets[1].edited = true;
    assert.equal(resolveReport(st).bullets[1], 'My own words.');
    st.drafts.cig_present.bullets[1].edited = false;
    assert.match(resolveReport(st).bullets[1], /^HO reiterated the housing rules/);
  });

  test('offenders follow the SU fields until the user types their own', () => {
    const st = filledState('altercation');
    assert.equal(st.core.offenders, 'John Smith (CIU/123456)\nJane Roe (MST/654321)');
    st.core.offenders = 'Someone Else (CIU/999999)';
    st.core.offendersEdited = true;
    normalizeState(st);
    assert.equal(st.core.offenders, 'Someone Else (CIU/999999)');
  });
});

describe('Incident Report Builder — email, checks and file name', () => {
  test('email type is chosen automatically from the warning letter and review box', () => {
    const st = filledState('fire_present'); // warning = Requesting
    assert.match(emailSubject(resolveReport(st), st), /^WARNING LETTER Incident Report – Fire alarm covered – John Smith \(CIU\/123456\) – 12\/10\/2026 – Brit Hotel$/);
    st.review = true;
    assert.match(emailSubject(resolveReport(st), st), /^\(For Review\) Incident Report/);
    assert.match(emailBody(resolveReport(st), st), /^Hi,\n/);
    st.review = false;
    st.emailType = 'hpn';
    assert.match(emailSubject(resolveReport(st), st), /^HPN Incident Report/);
    st.emailType = 'updated';
    assert.match(emailBody(resolveReport(st), st), /replaces the version sent previously/);
  });

  test('checks flag missing port refs, future dates, warning letter recipients and draft scenarios', () => {
    const st = filledState('visitor');
    st.values.su = 'John Smith';
    st.core.date = '2999-01-01';
    st.drafts.visitor.warning.issued = 'Requesting';
    st.drafts.visitor.warning.whom = 'John';
    const texts = reportChecks(st, resolveReport(st)).map(c => c.text).join('\n');
    assert.match(texts, /SU name has no port reference/);
    assert.match(texts, /date of incident is in the future/);
    assert.match(texts, /should list the port reference number/);
    assert.match(texts, /draft wording that has not been agreed yet/);
  });

  test('file name is IR_<date>_<property>_<incident>_<port ref>.docx', () => {
    const st = filledState('fire_present');
    assert.equal(reportFileName(resolveReport(st)), 'IR_2026-10-12_519_fire-alarm-covered-su-present_CIU-123456.docx');
  });

  test('port reference extraction', () => {
    assert.deepEqual(portRefs('John (CIU/123456) and Jane (mst/654321), again CIU/123456'), ['CIU/123456', 'MST/654321']);
  });

  test('red placeholders never count as port references (no example ref in the file name)', () => {
    const st = normalizeState(applyScenario(freshState(), 'fire_present')); // nothing filled in
    const r = resolveReport(st);
    assert.deepEqual(portRefs(r.offenders), []);
    assert.equal(reportFileName(r), 'IR_undated_fire-alarm-covered-su-present.docx');
  });
});

describe('Incident Report Builder — Word template', () => {
  test('fills every marker of the real Clearsprings template', async () => {
    const st = filledState('fire_present');
    const out = (await buildIncidentDocx(resolveReport(st), TEMPLATE, 'uint8array')) as Uint8Array;
    const zip = await JSZip.loadAsync(out);
    const xml = await zip.file('word/document.xml')!.async('string');
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(xml), 'no template markers left');
    assert.ok(xml.includes('Fire alarm covered with'));
    assert.ok(xml.includes('519 (Brit Hotel)'));
    assert.ok(xml.includes('w:numId w:val="26"') || xml.includes('<w:numId w:val="26"/>'), 'description bullets use the template list');
    const core = await zip.file('docProps/core.xml')!.async('string');
    assert.ok(!core.includes('George Barber'), 'template author is not carried into reports');
  });

  test('placeholders are written bold red, XML-special characters are escaped', async () => {
    const st = normalizeState(applyScenario(freshState(), 'blank'));
    st.drafts.blank.bullets[0] = { ref: null, text: 'Tom & Jerry <test> "quoted" [Insert Thing]', edited: true };
    const out = (await buildIncidentDocx(resolveReport(st), TEMPLATE, 'uint8array')) as Uint8Array;
    const xml = await (await JSZip.loadAsync(out)).file('word/document.xml')!.async('string');
    assert.ok(xml.includes('Tom &amp; Jerry &lt;test&gt; "quoted" '));
    assert.match(xml, /<w:color w:val="EE0000"\/>[^]*?\[Insert Thing\]/);
  });

  test('every scenario builds a valid document', async () => {
    for (const scn of SCENARIOS) {
      const st = filledState(scn.id);
      const out = (await buildIncidentDocx(resolveReport(st), TEMPLATE, 'uint8array')) as Uint8Array;
      assert.ok(out.length > 10000, scn.id);
      const zip = await JSZip.loadAsync(out);
      assert.ok(zip.file('word/document.xml'));
    }
  });
});

describe('Incident Report Builder — saved report mapping', () => {
  test('maps to the standard HO report fields and round-trips the builder state', () => {
    const st = filledState('cig_present');
    st.core.victimsMode = 'write';
    st.core.victims = 'Vic Tim (MST/111111)';
    const v = toFieldValues(st);
    assert.equal(v.propertyId, '519 (Brit Hotel)');
    assert.equal(v.personReporting, 'Jane Doe (HO)');
    assert.equal(v.dateOfIncident, '2026-10-12');
    assert.deepEqual(v.offenders, [{ id: 'p-0', name: 'John Smith', portRef: 'CIU/123456' }]);
    assert.deepEqual(v.victims, [{ id: 'p-0', name: 'Vic Tim', portRef: 'MST/111111' }]);
    assert.deepEqual(v.witnesses, [{ id: 'p-0', name: 'N/A', portRef: '' }]);
    assert.equal(v.incidentLead, 'Evidence of smoking in the room as cigarette butts were found');
    assert.equal(v.incidentDescription.split('\n').length, 2);
    assert.equal(v.warningLetterIssued, 'Please issue');
    assert.equal(v.policeInvolved, 'N/A');
    const back = sanitizeState(JSON.parse(JSON.stringify(v[BUILDER_KEY])));
    assert.ok(back);
    assert.deepEqual(resolveReport(back!), resolveReport(st));
    assert.match(suggestTitle(st), /^Incident Report – Cigarette butts in room – John Smith \(CIU\/123456\)$/);
  });

  test('sanitizeState rejects junk and repairs unknown scenarios', () => {
    assert.equal(sanitizeState(null), null);
    assert.equal(sanitizeState({ nope: 1 }), null);
    const bad = JSON.parse(JSON.stringify(freshState()));
    bad.scenarioId = 'does-not-exist';
    assert.equal(sanitizeState(bad)!.scenarioId, SCENARIOS[0].id);
  });
});

describe('Incident Report — lead line in the existing HTML / PDF / DOCX exports', () => {
  const values = {
    propertyId: '519 (Brit Hotel)',
    personReporting: 'Jane Doe (HO)',
    dateOfIncident: '2026-10-12',
    offenders: [{ id: 'p-0', name: 'John Smith', portRef: 'CIU/123456' }],
    victims: [{ id: 'p-0', name: 'N/A' }],
    witnesses: [{ id: 'p-0', name: 'N/A' }],
    incidentLead: 'Fire alarm covered with socks',
    incidentDescription: 'First bullet\nSecond bullet',
    actionTaken: 'Did a thing',
  };

  test('the flow engine puts the lead on the first description block only', () => {
    const pages = computeIncidentPages(normalizeIncidentData(values));
    const blocks = pages.flatMap(p => p.blocks).filter(b => b.type === 'incident_description');
    assert.equal(blocks[0].data.lead, 'Fire alarm covered with socks');
    assert.deepEqual(blocks[0].data.lines, ['First bullet', 'Second bullet']);
    assert.ok(blocks.slice(1).every(b => !b.data.lead));
  });

  test('records without a lead behave exactly as before', () => {
    const { incidentLead, ...rest } = values;
    const pages = computeIncidentPages(normalizeIncidentData(rest));
    const block = pages.flatMap(p => p.blocks).find(b => b.type === 'incident_description')!;
    assert.equal(block.data.lead, undefined);
  });

  test('PDF and DOCX generate with a lead line', async () => {
    const data: any = {
      title: 'Incident Report',
      documentNumber: 'DOC-1',
      site: 'Brit Hotel',
      fieldValues: values,
      templateName: 'Incident Report',
      fieldDefinitions: [{ name: 'propertyId' }],
      layoutConfig: {},
      headerConfig: {},
      footerConfig: {},
      createdByName: 'Jane',
      createdAt: '2026-10-12T00:00:00Z',
    };
    const pdf = await generatePdf(data);
    assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
    const docx = await generateDocx(data);
    const xml = await (await JSZip.loadAsync(docx)).file('word/document.xml')!.async('string');
    assert.ok(xml.includes('Fire alarm covered with socks'));
    // lead-only description (no bullets) still renders
    const leadOnly = await generateDocx({ ...data, fieldValues: { ...values, incidentDescription: '' } });
    const xml2 = await (await JSZip.loadAsync(leadOnly)).file('word/document.xml')!.async('string');
    assert.ok(xml2.includes('Fire alarm covered with socks'));
  });
});
