import type { DocumentRecord } from '../types';
import type { ServiceUserMaster, ServiceUserDocument, PropertyMaster, PropertyDocument } from '../types/masterData';

export type DocumentLinkType = 'service_user' | 'property' | 'general';

const norm = (s?: string | null) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The stored file of a repository document (first attachment, else the legacy link field). */
export function repositoryDocumentLink(d: Partial<DocumentRecord>): string {
  const first = Array.isArray(d.attachments) && d.attachments.length > 0 ? d.attachments[0] : null;
  return first?.dataUrl || first?.url || d.fileUrl || d.attachmentUrl || '';
}

/**
 * Documents uploaded in the Compliance & Document Repository that belong to a Service User.
 * They are linked by the resident's id; older uploads (no link) are matched by Port Ref.
 */
export function repositoryDocsForServiceUser(docs: DocumentRecord[], su: ServiceUserMaster): ServiceUserDocument[] {
  const fullName = norm(`${su.firstName} ${su.lastName}`);
  const ref = norm(su.externalReference);
  return (docs || [])
    .filter(d => {
      if (d.linkType === 'service_user') return d.suId === su.id;
      if (d.linkType === 'property') return false;
      if (ref && norm(d.refNumber) === ref) return true;
      return !norm(d.refNumber) && !!fullName && norm(d.suName) === fullName;
    })
    .map(d => ({
      id: `repo-${d.id}`,
      suId: su.id,
      documentType: d.category || 'Document',
      documentName: d.documentTitle || 'Untitled document',
      referenceNumber: d.refNumber || '',
      verificationStatus: 'Verified' as const,
      fileUrl: repositoryDocumentLink(d),
      uploadedBy: d.uploadedBy,
      notes: d.notes,
      createdAt: d.createdAt || d.uploadDate || d.uploadedDate,
      source: 'repository' as const
    }));
}

/** Documents uploaded in the repository against a property. */
export function repositoryDocsForProperty(docs: DocumentRecord[], property: PropertyMaster): PropertyDocument[] {
  return (docs || [])
    .filter(d => d.linkType === 'property' && d.propertyId === property.id)
    .map(d => ({
      id: `repo-${d.id}`,
      propertyId: property.id,
      documentType: d.category || 'Document',
      documentName: d.documentTitle || 'Untitled document',
      referenceNumber: d.refNumber || '',
      fileUrl: repositoryDocumentLink(d),
      verificationStatus: 'Verified' as const,
      uploadedBy: d.uploadedBy,
      notes: d.notes,
      createdAt: d.createdAt || d.uploadDate || d.uploadedDate,
      source: 'repository' as const
    }));
}

/** File size (KB) and format of the first attachment, so the register shows the real file, not a placeholder. */
export function describeFirstAttachment(attachments: any[] | undefined): { fileSizeKb?: number; fileFormat?: string } {
  const a = Array.isArray(attachments) && attachments.length > 0 ? attachments[0] : null;
  if (!a) return {};
  const ext = String(a.name || '').split('.').pop()?.toLowerCase() || '';
  const byExt: Record<string, string> = { pdf: 'PDF', doc: 'DOCX', docx: 'DOCX', xls: 'XLSX', xlsx: 'XLSX', jpg: 'JPG', jpeg: 'JPG', png: 'PNG' };
  return {
    fileSizeKb: a.size ? Math.max(1, Math.round(Number(a.size) / 1024)) : undefined,
    fileFormat: byExt[ext] || (ext ? ext.toUpperCase() : undefined)
  };
}
