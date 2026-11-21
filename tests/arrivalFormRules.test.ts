import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeArrival, arrivalFieldError, arrivalFormErrors, cleanLine, cleanLines, type ArrivalFormData } from '../src/utils/arrivalFormRules.ts';
import { planProfileSync } from '../src/utils/arrivalProfileSync.ts';
import { NEW_ARRIVALS_TABLE_COLUMNS } from '../src/data/defaultTableSchemas.ts';

const TODAY = '2026-11-21';
const ok = (o: ArrivalFormData): ArrivalFormData => ({ portReference: 'MST/9412027', name: 'Hayat Adan', checkInDate: TODAY, hotel: 'Clacton Pier Avenue', ...o });
const err = (k: keyof ArrivalFormData, v: unknown, form: ArrivalFormData = {}) => arrivalFieldError(k, v, form, TODAY);

test('cleaning removes control characters, angle brackets and extra spaces, and caps length', () => {
  assert.equal(cleanLine('  Hayat   \u0000Adan <b>  ', 100), 'Hayat Adan b');
  assert.equal(cleanLine('a​b', 10), 'ab');
  assert.equal(cleanLine('x'.repeat(500), 20).length, 20);
  assert.equal(cleanLines('  one  \r\n\r\n <two> \nthree', 100), 'one\ntwo\nthree');
});

test('sanitising normalises known formats and leaves absent fields alone', () => {
  const s = sanitizeArrival({ portReference: ' mst/9412027 ', email: ' Name@Example.COM ', aspenCard: 'ab 12', nhsNumber: '9434765919', gpRegistered: 'maybe', availableToBook: 'Yes' } as ArrivalFormData);
  assert.equal(s.portReference, 'MST/9412027');
  assert.equal(s.email, 'name@example.com');
  assert.equal(s.aspenCard, 'AB 12');
  assert.equal(s.nhsNumber, '943 476 5919');
  assert.equal(s.gpRegistered, '');                 // only Yes / No survive
  assert.equal(s.availableToBook, 'Yes');
  assert.ok(!('name' in s));
});

test('a complete, valid form has no errors', () => {
  assert.deepEqual(arrivalFormErrors(ok({
    dob: '1999-04-02', country: 'Somalia', language: 'Somali', contactNumber: '+44 7123 456789', email: 'a@b.co', room: '101', aspenCard: 'AB-1234',
    disabilityCategory: 'Physical / Mobility', disabilityType: 'Wheelchair User / Reduced Mobility',
    gpRegistered: 'Yes', gpPractice: 'Ranworth Surgery', pharmacy: 'Boots', nhsNumber: '943 476 5919', suComments: 'Needs interpreter', dietaryRequirements: 'Halal\nNut allergy', availableToBook: 'No'
  }), TODAY), {});
});

test('required fields', () => {
  const e = arrivalFormErrors({}, TODAY);
  assert.ok(e.portReference && e.name && e.checkInDate && e.hotel);
  assert.equal(Object.keys(e).length, 4);
});

test('port reference, name, phone, email, aspen card formats', () => {
  assert.ok(err('portReference', 'AB'));
  assert.ok(err('portReference', '<script>'));
  assert.equal(err('portReference', 'kiu/8813326'), null);
  assert.ok(err('name', 'R2D2'));
  assert.ok(err('name', 'A'));
  assert.equal(err('name', "Marie-Claire O'Neil Jr."), null);
  assert.equal(err('name', 'Ahmed Müller'), null);                 // non-English letters are fine
  assert.ok(err('contactNumber', '12345'));
  assert.ok(err('contactNumber', 'call me'));
  assert.equal(err('contactNumber', '(020) 7946 0958'), null);
  assert.ok(err('email', 'not-an-email'));
  assert.ok(err('email', 'a@b'));
  assert.equal(err('email', 'a.b+c@example.co.uk'), null);
  assert.ok(err('aspenCard', '!!!'));
  assert.ok(err('country', 'Som4lia'));
});

test('dates: birth date and check-in date', () => {
  assert.ok(err('dob', '2027-01-01'));                  // future
  assert.ok(err('dob', '1800-01-01'));                  // implausible
  assert.ok(err('dob', '2026-02-31'));                  // not a real date
  assert.equal(err('dob', ''), null);
  assert.ok(err('checkInDate', ''));
  assert.ok(err('checkInDate', '2026-12-25'));          // more than 14 days ahead
  assert.equal(err('checkInDate', '2026-12-05'), null);
  assert.ok(err('checkInDate', '1999-01-01'));
});

test('GP registered, GP and pharmacy must agree and must not be the same entry', () => {
  assert.ok(err('gpPractice', '', { gpRegistered: 'Yes' }));                        // registered but no GP
  assert.ok(err('gpPractice', 'Ranworth Surgery', { gpRegistered: 'No' }));         // GP although "No"
  assert.ok(err('gpPractice', 'Ranworth Surgery', {}));                             // GP without saying registered
  assert.equal(err('gpPractice', 'Ranworth Surgery', { gpRegistered: 'Yes' }), null);
  assert.equal(err('gpPractice', '', { gpRegistered: 'No' }), null);
  assert.ok(err('pharmacy', ' ranworth  surgery ', { gpPractice: 'Ranworth Surgery', gpRegistered: 'Yes' }));   // same entry as the GP
  assert.equal(err('pharmacy', 'Boots', { gpPractice: 'Ranworth Surgery', gpRegistered: 'Yes' }), null);
  assert.equal(err('pharmacy', 'Boots', { gpRegistered: 'No' }), null);              // a pharmacy does not need a GP
});

test('NHS number is optional but must be valid when given', () => {
  assert.equal(err('nhsNumber', ''), null);
  assert.ok(err('nhsNumber', '943 476 5918'));
  assert.equal(err('nhsNumber', '943 476 5919'), null);
});

test('disability: type is required for a category, and not allowed for None', () => {
  assert.ok(err('disabilityType', '', { disabilityCategory: 'Mental Health' }));
  assert.ok(err('disabilityType', 'Epilepsy / Seizure Disorder', { disabilityCategory: 'None' }));
  assert.equal(err('disabilityType', '', { disabilityCategory: 'None' }), null);
  assert.equal(err('disabilityType', '', {}), null);
  assert.equal(err('disabilityType', 'Epilepsy / Seizure Disorder', { disabilityCategory: 'Chronic Medical Condition' }), null);
  assert.ok(err('disabilityType', '<img src=x>', { disabilityCategory: 'Other' }));               // markup is rejected
});

test('notes and dietary limits', () => {
  assert.ok(err('suComments', 'x\n'.repeat(1500)));
  assert.ok(err('dietaryRequirements', Array.from({ length: 21 }, (_, i) => `item ${i}`).join('\n')));
  assert.ok(err('dietaryRequirements', 'y'.repeat(301)));
  assert.equal(err('dietaryRequirements', 'Halal\n\n  \nNo pork'), null);
});

test('the form lists the fields in working order, with disability and the profile-only fields kept out of the table', () => {
  const keys = NEW_ARRIVALS_TABLE_COLUMNS.map(c => String(c.key));
  assert.deepEqual(keys, ['portReference', 'name', 'dob', 'country', 'language', 'contactNumber', 'email', 'checkInDate', 'hotel', 'room', 'aspenCard', 'status',
    'disabilityCategory', 'disabilityType', 'gpRegistered', 'gpPractice', 'pharmacy', 'nhsNumber', 'suComments', 'dietaryRequirements', 'availableToBook']);
  const hidden = NEW_ARRIVALS_TABLE_COLUMNS.filter(c => c.visibleInTable === false).map(c => String(c.key));
  assert.deepEqual(hidden, keys.slice(12));
  const gp = NEW_ARRIVALS_TABLE_COLUMNS.find(c => c.key === 'gpPractice')!;
  const ph = NEW_ARRIVALS_TABLE_COLUMNS.find(c => c.key === 'pharmacy')!;
  assert.notEqual(gp.optionCategory, ph.optionCategory);     // two separate lists, as on the GP Registrations page
  assert.equal(ph.optionCategory, 'gpPharmacies');
  assert.equal(NEW_ARRIVALS_TABLE_COLUMNS.every(c => !(c.key === 'nhsNumber') || c.visibleInView === false), true);
});

test('disability fills a blank profile, never replaces a recorded one, and None changes nothing', () => {
  const base = { safeguarding: '', dietary: [], suGpPractice: '', gp: null };
  assert.deepEqual(planProfileSync({ ...base, suDisabilityCategory: 'None', suDisabilityType: '' }, { disabilityCategory: 'Mental Health', disabilityType: 'Severe Mental Health / Complex PTSD' }).suDisability,
    { write: true, fields: { disabilityCategory: 'Mental Health', disabilityType: 'Severe Mental Health / Complex PTSD' } });
  const kept = planProfileSync({ ...base, suDisabilityCategory: 'Physical / Mobility', suDisabilityType: 'Wheelchair User / Reduced Mobility' }, { disabilityCategory: 'Mental Health', disabilityType: 'Other' });
  assert.equal(kept.suDisability.write, false);
  assert.equal(kept.keptExisting.length, 2);
  assert.equal(planProfileSync({ ...base, suDisabilityCategory: 'Physical / Mobility' }, { disabilityCategory: 'None', disabilityType: '' }).suDisability.write, false);
  assert.equal(planProfileSync({ ...base, suDisabilityCategory: 'Mental Health' }, { disabilityCategory: 'Mental Health', disabilityType: '' }).keptExisting.length, 0);
});
