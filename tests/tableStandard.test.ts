import test from 'node:test';
import assert from 'node:assert/strict';
import { serialNo, serviceUserFirst } from '../src/components/common/TrackerLayout.tsx';

test('serial numbers continue across pages and restart with the filtered list', () => {
  assert.equal(serialNo(0, 1, 10), 1);
  assert.equal(serialNo(9, 1, 10), 10);
  assert.equal(serialNo(0, 3, 10), 21);
  assert.equal(serialNo(4, 2, 25), 30);
  assert.equal(serialNo(0, 0, 10), 1);            // a bad page number never gives 0 or a negative
});

test('the Service User column moves to the front and the rest keep their order', () => {
  const cols = [{ key: 'date' }, { key: 'siteName' }, { key: 'suName' }, { key: 'status' }];
  assert.deepEqual(serviceUserFirst(cols).map(c => c.key), ['suName', 'date', 'siteName', 'status']);
});

test('a table already starting with the Service User, or with none, is left alone', () => {
  const a = [{ key: 'suName' }, { key: 'date' }];
  const b = [{ key: 'date' }, { key: 'status' }];
  assert.equal(serviceUserFirst(a), a);
  assert.equal(serviceUserFirst(b), b);
});
