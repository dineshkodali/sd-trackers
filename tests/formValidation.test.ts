import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFields, isValidIsoDate, isSafeUrl, hasErrors } from '../src/utils/formValidation.ts';

test('required fields: empty, blank and empty lists fail; real values pass', () => {
  const rules = { name: [{ kind: 'required' as const }], tags: [{ kind: 'required' as const }] };
  assert.deepEqual(Object.keys(validateFields({ name: '  ', tags: [] }, rules)).sort(), ['name', 'tags']);
  assert.equal(hasErrors(validateFields({ name: "O'Brien-Smith", tags: ['a'] }, rules)), false);
});

test('dates must be real calendar dates, and can be limited to today or earlier', () => {
  assert.equal(isValidIsoDate('2026-02-28'), true);
  assert.equal(isValidIsoDate('2026-02-30'), false);
  assert.equal(isValidIsoDate('13/11/2026'), false);
  const r = { dob: [{ kind: 'date' as const, notFuture: true, today: '2026-11-13' }] };
  assert.equal(validateFields({ dob: '1991-03-14' }, r).dob, undefined);
  assert.ok(validateFields({ dob: '2027-01-01' }, r).dob);
  assert.ok(validateFields({ dob: '2026-02-30' }, r).dob);
  assert.equal(validateFields({ dob: '' }, r).dob, undefined);            // optional unless also required
  assert.equal(validateFields({ dob: '1991-03-14T00:00:00Z' }, r).dob, undefined);   // a timestamp is read by its date part
});

test('numbers: type, range and whole-number checks', () => {
  const r = { n: [{ kind: 'number' as const, min: 1, max: 5, integer: true }] };
  assert.equal(validateFields({ n: '3' }, r).n, undefined);
  assert.ok(validateFields({ n: 'abc' }, r).n);
  assert.ok(validateFields({ n: 0 }, r).n);
  assert.ok(validateFields({ n: 6 }, r).n);
  assert.ok(validateFields({ n: 2.5 }, r).n);
});

test('choice and length limits', () => {
  const r = { status: [{ kind: 'oneOf' as const, values: ['Open', 'Closed'] as const }], note: [{ kind: 'maxLength' as const, max: 5 }] };
  assert.ok(validateFields({ status: 'Maybe' }, r).status);
  assert.equal(validateFields({ status: 'Open' }, r).status, undefined);
  assert.ok(validateFields({ note: 'too long' }, r).note);
});

test('only http and https web addresses are accepted', () => {
  assert.equal(isSafeUrl('https://example.org/a?b=1'), true);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('data:text/html,<b>x</b>'), false);
  assert.equal(isSafeUrl('not a url'), false);
});

test('the first failing rule for a field is the one reported', () => {
  const r = { x: [{ kind: 'required' as const, message: 'Need x' }, { kind: 'number' as const }] };
  assert.equal(validateFields({ x: '' }, r).x, 'Need x');
  assert.equal(validateFields({ x: 'q' }, r).x, 'Enter a number');
});
