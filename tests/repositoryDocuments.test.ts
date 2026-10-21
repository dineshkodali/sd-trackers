import test from 'node:test';
import assert from 'node:assert/strict';
import { repositoryDocsForServiceUser, repositoryDocsForProperty, describeFirstAttachment } from '../src/utils/repositoryDocuments.ts';

const su: any = { id: 'su1', firstName: 'Ann', lastName: 'Lee', externalReference: 'P1' };
const doc = (o: any): any => ({ id: 'd', documentTitle: 't', category: 'Risk Assessment', attachments: [{ id: 'a', name: 'x.pdf', dataUrl: 'data:x', size: 2048 }], ...o });

test('a document linked to a resident shows on that resident only', () => {
  const docs = [doc({ id: '1', linkType: 'service_user', suId: 'su1' }), doc({ id: '2', linkType: 'service_user', suId: 'su2', refNumber: 'P1' })];
  assert.deepEqual(repositoryDocsForServiceUser(docs, su).map(d => d.id), ['repo-1']);
});

test('older uploads are matched by Port Ref, a property document never shows on a resident', () => {
  const docs = [doc({ id: '1', refNumber: 'P1' }), doc({ id: '2', linkType: 'property', propertyId: 'p1', refNumber: 'P1' })];
  assert.deepEqual(repositoryDocsForServiceUser(docs, su).map(d => d.id), ['repo-1']);
});

test('property documents are matched by property id', () => {
  const docs = [doc({ id: '1', linkType: 'property', propertyId: 'p1' }), doc({ id: '2', linkType: 'property', propertyId: 'p2' }), doc({ id: '3', linkType: 'service_user', suId: 'su1' })];
  assert.deepEqual(repositoryDocsForProperty(docs, { id: 'p1' } as any).map(d => d.id), ['repo-1']);
});

test('the real file size and format are read from the attachment', () => {
  assert.deepEqual(describeFirstAttachment([{ name: 'Plan.DOCX', size: 4096 }]), { fileSizeKb: 4, fileFormat: 'DOCX' });
  assert.deepEqual(describeFirstAttachment([]), {});
});
