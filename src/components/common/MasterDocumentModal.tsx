import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Eye, Download } from 'lucide-react';
import { suPropertyDetailsService } from '../../services/suPropertyDetailsService';
import { useApp } from '../../context/AppContext';

interface MasterDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'serviceUser' | 'property';
  entityId: string;
  entityName: string;
  docToEdit?: any; // PropertyDocument | ServiceUserDocument
  onSuccess: () => void;
}

const SU_DOC_TYPES = [
  'ARC Card / Identification',
  'Proof of Address',
  'Medical / Health Assessment',
  'Occupancy Agreement',
  'Home Office / Port Papers',
  'Safeguarding Record',
  'Incident Report',
  'Other Document'
];

const PROPERTY_DOC_TYPES = [
  'Tenancy / Lease Agreement',
  'Gas Safety Certificate (CP12)',
  'EICR Electrical Safety',
  'EPC Energy Performance Certificate',
  'Fire Risk Assessment (FRA)',
  'Building Insurance',
  'Floor Plan & Layout',
  'HMO Council Licence',
  'Other Certificate'
];

export const MasterDocumentModal: React.FC<MasterDocumentModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
  docToEdit,
  onSuccess
}) => {
  const { currentUserName, currentUserRole } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docTypes = entityType === 'serviceUser' ? SU_DOC_TYPES : PROPERTY_DOC_TYPES;
  const [docType, setDocType] = useState(docTypes[0]);
  const [docName, setDocName] = useState('');
  const [refNumber, setRefNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Attached file state
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      if (docToEdit) {
        setDocType(docToEdit.documentType || docTypes[0]);
        setDocName(docToEdit.documentName || '');
        setRefNumber(docToEdit.referenceNumber || '');
        setIssueDate(docToEdit.issueDate?.split('T')[0] || '');
        setExpiryDate(docToEdit.expiryDate?.split('T')[0] || '');
        setNotes(docToEdit.notes || '');
        setFileName(docToEdit.documentName || '');
        setFileDataUrl(docToEdit.fileUrl || '');
        setFileSize(null);
      } else {
        setDocType(docTypes[0]);
        setDocName('');
        setRefNumber('');
        setIssueDate(new Date().toISOString().split('T')[0]);
        setExpiryDate('');
        setNotes('');
        setFileName('');
        setFileDataUrl('');
        setFileSize(null);
      }
      setErrorMsg('');
    }
  }, [isOpen, docToEdit, docTypes]);

  if (!isOpen) return null;

  const handleProcessFile = (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('File exceeds 20MB limit. Please upload a smaller file.');
      return;
    }
    setErrorMsg('');
    setFileName(file.name);
    setFileSize(file.size);
    if (!docName.trim()) {
      setDocName(file.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) {
      setErrorMsg('Document name is required.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      if (entityType === 'serviceUser') {
        const payload = {
          suId: entityId,
          documentType: docType,
          documentName: docName.trim(),
          referenceNumber: refNumber.trim() || undefined,
          fileUrl: fileDataUrl || undefined,
          issueDate: issueDate || undefined,
          expiryDate: expiryDate || undefined,
          verificationStatus: 'Verified' as const,
          uploadedBy: currentUserName || currentUserRole || 'Staff Member',
          notes: notes.trim() || undefined
        };
        const res = docToEdit 
          ? await suPropertyDetailsService.updateSUDocument(docToEdit.id, payload)
          : await suPropertyDetailsService.addSUDocument(payload);

        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to save document.');
        }
      } else {
        const payload = {
          propertyId: entityId,
          documentType: docType,
          documentName: docName.trim(),
          referenceNumber: refNumber.trim() || undefined,
          fileUrl: fileDataUrl || undefined,
          issueDate: issueDate || undefined,
          expiryDate: expiryDate || undefined,
          verificationStatus: 'Verified' as const,
          uploadedBy: currentUserName || currentUserRole || 'Staff Member',
          notes: notes.trim() || undefined
        };
        const res = docToEdit
          ? await suPropertyDetailsService.updatePropertyDocument(docToEdit.id, payload)
          : await suPropertyDetailsService.savePropertyDocument(payload);

        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to save property document.');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred uploading the document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-xs border border-[#e5e5e5] shadow-2xl w-full max-w-lg overflow-hidden text-xs flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#e5e5e5] bg-[#faf9f8] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-sm text-[#242424] flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#0d9488]" />
              <span>{docToEdit ? 'Edit Document' : 'Attach & Upload Document'}</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              {docToEdit ? `Editing file for ${entityName}` : `Attaching file for ${entityName}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-[#edebe9] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          {errorMsg && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* File Upload Dropzone */}
          <div>
            <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
              Select or Drop File to Attach
            </label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={e => {
                if (e.target.files && e.target.files[0]) handleProcessFile(e.target.files[0]);
              }}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.csv,.txt"
              className="hidden"
            />
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 border-2 border-dashed rounded-xs text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[#0d9488] bg-teal-50/50'
                  : fileName
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : 'border-[#e5e5e5] bg-[#fbfbfa] hover:border-[#0d9488] hover:bg-white'
              }`}
            >
              {fileName ? (
                <div className="flex items-center justify-between px-2 text-left">
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-[#242424] truncate">{fileName}</p>
                      <p className="text-[10px] text-neutral-400">{fileSize ? formatBytes(fileSize) : ''}</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-semibold px-2 py-0.5 rounded bg-emerald-100">
                    Ready
                  </span>
                </div>
              ) : (
                <div className="space-y-1 py-1">
                  <UploadCloud className="w-7 h-7 mx-auto text-neutral-400" />
                  <p className="text-xs font-semibold text-neutral-700">Click to browse or drag file here</p>
                  <p className="text-[10px] text-neutral-400">PDF, DOC, DOCX, JPG, PNG up to 20MB</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Document Category *
              </label>
              <select
                value={docType}
                onChange={e => setDocType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
              >
                {docTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                Reference / Certificate No.
              </label>
              <input
                type="text"
                placeholder="e.g. CP12-98402, ARC-12345"
                value={refNumber}
                onChange={e => setRefNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs font-mono focus:border-[#0d9488] outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
              Document Title / Label *
            </label>
            <input
              type="text"
              placeholder="e.g. Gas Safety Inspection 2026"
              value={docName}
              onChange={e => setDocName(e.target.value)}
              required
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-700 mb-1">Notes / Verification Remarks</label>
            <textarea
              rows={2}
              placeholder="Any inspection remarks or notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-[#e5e5e5] rounded-xs text-xs focus:border-[#0d9488] outline-hidden"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#f0f0f0] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-[#8a8886] text-[#323130] bg-white hover:bg-[#f3f2f1] rounded-xs font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : docToEdit ? 'Save Changes' : 'Upload & Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
