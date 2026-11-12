import test from 'node:test';
import assert from 'node:assert/strict';
import { toDatabaseRow, fromDatabaseRow } from '../server/schemaAdapter.ts';
import { fitWithin } from '../src/utils/imageCompress.ts';

const img = (id: string, by: string, at: string): any => ({
  id, name: `${id}.jpg`, size: 1200, type: 'image/jpeg', dataUrl: `data:image/jpeg;base64,${id}`, uploadedBy: by, uploadedAt: at
});

const record = {
  id: 'm-1', site: 'Brit Hotel', priority: 'CAT 2', description: 'Leak under sink', closeDueDate: '2026-11-12 16:00',
  defectStatus: 'In Process', action: 'Open', raisedBy: 'Sam',
  beforeImages: [img('b1', 'Sam', '2026-11-10T09:05:00.000Z'), img('b2', 'Sam', '2026-11-10T09:06:00.000Z')],
  afterImages: [img('a1', 'Contractor Kim', '2026-11-11T15:40:00.000Z')],
  initialCondition: 'Water pooling, cabinet swollen', completedWorkDetails: 'Replaced trap and seal', finalCondition: 'Dry, no leak under pressure test'
};

test('before and after galleries are saved and read back separately', () => {
  const row = toDatabaseRow('maintenance_records', record, null);
  const back = fromDatabaseRow('maintenance_records', { ...row, created_at: '2026-11-10T09:00:00Z' }) as any;
  assert.deepEqual(back.beforeImages.map((i: any) => i.id), ['b1', 'b2']);
  assert.deepEqual(back.afterImages.map((i: any) => i.id), ['a1']);
  assert.equal(back.beforeImages.some((i: any) => i.id === 'a1'), false);  // never mixed
  assert.equal(back.afterImages.some((i: any) => String(i.id).startsWith('b')), false);
});

test('who uploaded each image and when survives the round trip', () => {
  const back = fromDatabaseRow('maintenance_records', toDatabaseRow('maintenance_records', record, null)) as any;
  assert.equal(back.afterImages[0].uploadedBy, 'Contractor Kim');
  assert.equal(back.afterImages[0].uploadedAt, '2026-11-11T15:40:00.000Z');
  assert.equal(back.beforeImages[1].uploadedBy, 'Sam');
});

test('condition and completed-work text survive, and Complete By is still saved', () => {
  const row = toDatabaseRow('maintenance_records', record, null);
  const back = fromDatabaseRow('maintenance_records', row) as any;
  assert.equal(back.initialCondition, 'Water pooling, cabinet swollen');
  assert.equal(back.completedWorkDetails, 'Replaced trap and seal');
  assert.equal(back.finalCondition, 'Dry, no leak under pressure test');
  assert.equal(back.closeDueDate, '2026-11-12 16:00');
  assert.equal(row.complete_by, '2026-11-12T16:00:00.000Z');
});

test('typed picture columns keep the upload time and never an embedded data URI', () => {
  const row = toDatabaseRow('maintenance_records', record, null);
  assert.equal(row.before_picture_date, '2026-11-10T09:05:00.000Z');
  assert.equal(row.before_picture_url, '');
  const linked = toDatabaseRow('maintenance_records', { ...record, beforeImages: [{ ...img('x', 'Sam', '2026-11-10T09:05:00.000Z'), url: 'https://files.example/x.jpg' }] }, null);
  assert.equal(linked.before_picture_url, 'https://files.example/x.jpg');
});

test('a record with no images reads back with none (not undefined crashes)', () => {
  const row = toDatabaseRow('maintenance_records', { id: 'm-2', site: 'Brit Hotel', description: 'x' }, null);
  const back = fromDatabaseRow('maintenance_records', row) as any;
  assert.equal(Array.isArray(back.beforeImages || []), true);
  assert.equal((back.afterImages || []).length, 0);
});

test('photos are scaled down to fit, never up', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitWithin(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(1600, 1600, 1600), { width: 1600, height: 1600 });
  assert.deepEqual(fitWithin(0, 0, 1600), { width: 1, height: 1 });
});
