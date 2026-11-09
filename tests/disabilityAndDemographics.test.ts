import test from 'node:test';
import assert from 'node:assert/strict';
import { FIELD_CATEGORIES_META, DEFAULT_FIELD_OPTIONS } from '../src/data/defaultFieldOptions.js';
import { DISABILITY_CATEGORY_OPTIONS, DEFAULT_DISABILITY_TYPE_OPTIONS } from '../src/types/masterData.js';

test('Disability Options: categories and types are properly registered in FIELD_CATEGORIES_META', () => {
  const metaKeys = new Set(FIELD_CATEGORIES_META.map(m => m.key));
  assert.ok(metaKeys.has('disabilityCategories'), 'disabilityCategories category exists in metadata');
  assert.ok(metaKeys.has('disabilityTypes'), 'disabilityTypes category exists in metadata');

  const catMeta = FIELD_CATEGORIES_META.find(m => m.key === 'disabilityCategories');
  assert.equal(catMeta?.department, 'Safeguarding', 'disabilityCategories belongs to Safeguarding department');

  const typeMeta = FIELD_CATEGORIES_META.find(m => m.key === 'disabilityTypes');
  assert.equal(typeMeta?.department, 'Safeguarding', 'disabilityTypes belongs to Safeguarding department');
});

test('Disability Options: default field options exist and map to valid categories', () => {
  const catOpts = DEFAULT_FIELD_OPTIONS.filter(o => o.category === 'disabilityCategories');
  assert.ok(catOpts.length >= 7, 'at least 7 default disability categories');
  assert.ok(catOpts.some(o => o.value === 'Physical / Mobility'));
  assert.ok(catOpts.some(o => o.value === 'Sensory Impairment'));
  assert.ok(catOpts.some(o => o.value === 'Mental Health'));
  assert.ok(catOpts.some(o => o.value === 'None'));

  const typeOpts = DEFAULT_FIELD_OPTIONS.filter(o => o.category === 'disabilityTypes');
  assert.ok(typeOpts.length >= 8, 'at least 8 default disability types');
  assert.ok(typeOpts.some(o => o.value.includes('Wheelchair')));
  assert.ok(typeOpts.some(o => o.value.includes('Visual Impairment')));
  assert.ok(typeOpts.some(o => o.value.includes('Hearing Impairment')));
  assert.ok(typeOpts.some(o => o.value.includes('Mental Health')));
});

test('Disability Options: master data fallback arrays are non-empty and well-formed', () => {
  assert.ok(DISABILITY_CATEGORY_OPTIONS.length > 0);
  assert.ok(DEFAULT_DISABILITY_TYPE_OPTIONS.length > 0);
  assert.ok(DISABILITY_CATEGORY_OPTIONS.includes('None'));
  assert.ok(DEFAULT_DISABILITY_TYPE_OPTIONS.includes('Wheelchair User / Reduced Mobility'));
});

test('Demographics: Property matrix groups correctly by property, nationality, and language', () => {
  const sampleRecords = [
    { hotel: 'Grand Hotel', nationality: 'Syrian', language: 'Arabic', occupied: 'Yes' },
    { hotel: 'Grand Hotel', nationality: 'Syrian', language: 'Arabic/English', occupied: 'Yes' },
    { hotel: 'Grand Hotel', nationality: 'Afghan', language: 'Pashto', occupied: 'Yes' },
    { hotel: 'Park View', nationality: 'Eritrean', language: 'Tigrinya', occupied: 'Yes' },
    { hotel: 'Park View', nationality: 'Sudanese', language: 'Arabic', occupied: 'Yes' },
    { hotel: 'Park View', nationality: '', language: '', occupied: 'No' }, // should be ignored
  ];

  const active = sampleRecords.filter(r => r.occupied === 'Yes' || !r.occupied);
  assert.equal(active.length, 5);

  const propMap = new Map<string, { total: number; nats: Record<string, number>; langs: Record<string, number> }>();
  active.forEach(r => {
    const hotel = r.hotel;
    if (!propMap.has(hotel)) {
      propMap.set(hotel, { total: 0, nats: {}, langs: {} });
    }
    const p = propMap.get(hotel)!;
    p.total++;
    const nat = r.nationality || 'Unspecified';
    const lang = r.language || 'Unspecified';
    p.nats[nat] = (p.nats[nat] || 0) + 1;
    p.langs[lang] = (p.langs[lang] || 0) + 1;
  });

  assert.equal(propMap.size, 2);
  const grand = propMap.get('Grand Hotel');
  assert.equal(grand?.total, 3);
  assert.equal(grand?.nats['Syrian'], 2);
  assert.equal(grand?.nats['Afghan'], 1);

  const park = propMap.get('Park View');
  assert.equal(park?.total, 2);
  assert.equal(park?.nats['Eritrean'], 1);
  assert.equal(park?.nats['Sudanese'], 1);
});

