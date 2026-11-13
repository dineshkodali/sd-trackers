import test from 'node:test';
import assert from 'node:assert/strict';
import { findWriteIssues, isRecognisedDate, describeIssues } from '../server/writeValidation.ts';

test('dates: ISO, ISO with time and UK format are recognised; impossible days are not', () => {
  for (const ok of ['2026-11-13', '2026-11-13T09:30:00Z', '2026-11-13 09:30', '13/11/2026', '1/2/2026 09:05']) assert.equal(isRecognisedDate(ok), true, ok);
  for (const bad of ['2026-02-30', '31/04/2026', 'yesterday', '2026-13-01', '13-11-2026']) assert.equal(isRecognisedDate(bad), false, bad);
});

test('only date-like fields are checked as dates, and empty values are left alone', () => {
  assert.deepEqual(findWriteIssues({ dob: '1991-03-14', notes: 'tomorrow', suDob: '', followUpDate: '' }), []);
  assert.deepEqual(findWriteIssues({ followUpDate: 'soon' }), [{ field: 'followUpDate', rule: 'date' }]);
});

test('unsafe links are flagged; normal and data-image links are not', () => {
  assert.deepEqual(findWriteIssues({ fileUrl: 'javascript:alert(1)' }), [{ field: 'fileUrl', rule: 'link' }]);
  assert.deepEqual(findWriteIssues({ attachmentUrl: 'data:text/html,<b>x</b>' }), [{ field: 'attachmentUrl', rule: 'link' }]);
  assert.deepEqual(findWriteIssues({ fileUrl: 'https://example.org/a.pdf', photoUrl: 'data:image/png;base64,AAAA' }), []);
});

test('control characters and script tags are flagged, ordinary text is not', () => {
  assert.deepEqual(findWriteIssues({ notes: 'bad\u0000text' }), [{ field: 'notes', rule: 'control-characters' }]);
  assert.deepEqual(findWriteIssues({ notes: 'hi <script>x()</script>' }), [{ field: 'notes', rule: 'script-tag' }]);
  assert.deepEqual(findWriteIssues({ notes: "O'Brien's room: 3 < 5 & 6 > 2\nline two\ttab — “quotes” £10" }), []);
});

test('the user-facing message names fields and never values', () => {
  const msg = describeIssues(findWriteIssues({ notes: 'secret\u0000value', followUpDate: 'soon' }));
  assert.match(msg, /notes/);
  assert.match(msg, /followUpDate/);
  assert.doesNotMatch(msg, /secret/);
});

test('non-record bodies are ignored', () => {
  assert.deepEqual(findWriteIssues(null), []);
  assert.deepEqual(findWriteIssues([1, 2]), []);
});
