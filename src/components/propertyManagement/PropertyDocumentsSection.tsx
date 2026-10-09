import React, { useState } from 'react';
import { Plus, FileText, Download, Eye, Trash2, Calendar, Edit3, Link2 } from 'lucide-react';
import { PropertyDocument } from '../../types/masterData';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { MasterDocumentModal } from '../common/MasterDocumentModal';
import { useApp } from '../../context/AppContext';
import { openStoredDocument } from '../../utils/openStoredDocument';

interface PropertyDocumentsSectionProps {
  propertyId: string;
  propertyName: string;
  documents: PropertyDocument[];
  onRefresh: () => void;
}

export const PropertyDocumentsSection: React.FC<PropertyDocumentsSectionProps> = ({
  propertyId,
  propertyName,
  documents,
  onRefresh
}) => {
  const { requestConfirmation } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [docToEdit, setDocToEdit] = useState<PropertyDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (docId: string) => {
    if (typeof requestConfirmation !== 'undefined') {
      requestConfirmation({
        title: 'Delete Document',
        message: 'Are you sure you want to delete this document? This action cannot be undone.',
        isDanger: true,
        onConfirm: async () => {
          setDeletingId(docId);
          try {
            await suPropertyDetailsService.deletePropertyDocument(docId);
            onRefresh();
          } catch (err) {
            console.error('Failed to delete document:', err);
          } finally {
            setDeletingId(null);
          }
        }
      });
    } else {
      // Fallback
      setDeletingId(docId);
      try {
        await suPropertyDetailsService.deletePropertyDocument(docId);
        onRefresh();
      } catch (err) {
        console.error('Failed to delete document:', err);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    // Could add toast here
  };
  const handleOpenDoc = (doc: PropertyDocument) => {
    openStoredDocument(doc.fileUrl, doc.documentName);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-xs text-[#242424]">Property Certificates &amp; Documents</h4>
          <p className="text-[11px] text-neutral-500">
            Attached leases, gas safety, electrical, EPC, and insurance documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold text-xs shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Upload Document</span>
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="p-8 text-center bg-[#faf9f8] border border-[#e5e5e5] rounded-xs">
          <FileText className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
          <p className="text-xs font-semibold text-neutral-700">No documents attached yet</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Attach leases, gas safety certificates, EPCs, or building insurance papers.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="mt-3 px-3 py-1 border border-[#8a8886] text-xs font-semibold rounded-xs bg-white hover:bg-[#f3f2f1] cursor-pointer"
          >
            Upload First Document
          </button>
        </div>
      ) : (
        <div className="border border-[#e5e5e5] rounded-xs overflow-hidden bg-white shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#faf9f8] border-b border-[#e5e5e5] text-neutral-600 font-semibold select-none">
                <th className="py-2.5 px-3">Document Title</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Reference / Cert #</th>
                <th className="py-2.5 px-3">Expiry Date</th>
                <th className="py-2.5 px-3">Uploaded</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0]">
              {documents.map(d => {
                const isExpired = d.expiryDate && new Date(d.expiryDate) < new Date();
                return (
                  <tr key={d.id} className="hover:bg-[#fbfbfa] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#0d9488] shrink-0" />
                        <div>
                          <span className="font-semibold text-[#242424] block">{d.documentName}</span>
                          {d.notes && <span className="text-[10px] text-neutral-400">{d.notes}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-[#f3f2f1] text-[#323130] rounded-xs border border-[#e5e5e5]">
                        {d.documentType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-700">
                      {d.referenceNumber || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {d.expiryDate ? (
                        <span className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                          isExpired ? 'text-red-600 font-bold' : 'text-neutral-700'
                        }`}>
                          <Calendar className="w-3 h-3 text-neutral-400" />
                          <span>{new Date(d.expiryDate).toLocaleDateString('en-GB')}</span>
                          {isExpired && <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-sans">EXPIRED</span>}
                        </span>
                      ) : (
                        <span className="text-neutral-400 italic">No expiry</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 text-[11px]">
                      {d.uploadedBy || 'Staff'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {d.fileUrl && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenDoc(d)}
                              className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                              title="View Document"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(d.fileUrl!)}
                              className="p-1 text-[#605e5c] hover:text-[#0078d4] hover:bg-[#e5f3ff] rounded-xs transition-colors cursor-pointer"
                              title="Copy Link to Share"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => { setDocToEdit(d); setIsModalOpen(true); }}
                          className="p-1 text-[#605e5c] hover:text-[#242424] hover:bg-[#edebe9] rounded-xs transition-colors cursor-pointer"
                          title="Edit Document"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          disabled={deletingId === d.id}
                          className="p-1 text-[#a4262c] hover:text-[#d13438] hover:bg-[#fceef1] rounded-xs transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <MasterDocumentModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setDocToEdit(null); }}
        entityType="property"
        entityId={propertyId}
        entityName={propertyName}
        docToEdit={docToEdit}
        onSuccess={onRefresh}
      />
    </div>
  );
};
