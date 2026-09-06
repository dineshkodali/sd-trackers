import React, { useState, useRef } from 'react';
import { 
  Paperclip, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Download, 
  Trash2, 
  Eye, 
  X, 
  File, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { RecordAttachment } from '../../types';
import { useApp } from '../../context/AppContext';

interface AttachmentsSectionProps {
  attachments?: RecordAttachment[];
  onChange?: (attachments: RecordAttachment[]) => void;
  readOnly?: boolean;
  title?: string;
  entityName?: string;
}

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  attachments = [],
  onChange,
  readOnly = false,
  title = 'Proof & Document Attachments',
  entityName = 'Record'
}) => {
  const { currentUserRole, currentUserName, canManageFiles, requestConfirmation } = useApp();
  const [previewFile, setPreviewFile] = useState<RecordAttachment | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File permissions: Admins (Super Admin, Admin) and Regional Managers have full CRUD.
  // Others can view and download.
  const hasFullCrud = canManageFiles();
  const canUpload = !readOnly && hasFullCrud && !!onChange;
  const canDelete = !readOnly && hasFullCrud && !!onChange;

  const handleProcessFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !onChange) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const newAttachment: RecordAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: reader.result as string,
          uploadedBy: currentUserName || currentUserRole,
          uploadedAt: new Date().toISOString()
        };
        onChange([...attachments, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!canUpload) return;
    handleProcessFiles(e.dataTransfer.files);
  };

  const handleDownload = (att: RecordAttachment) => {
    if (!att.dataUrl) return;
    const link = document.createElement('a');
    link.href = att.dataUrl;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (attId: string, attName: string) => {
    if (!canDelete || !onChange) return;
    requestConfirmation({
      title: 'Remove Attachment',
      message: `Are you sure you want to delete the file "${attName}" from this ${entityName}? This action cannot be undone.`,
      confirmLabel: 'Delete File',
      isDanger: true,
      onConfirm: () => {
        onChange(attachments.filter(a => a.id !== attId));
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isImage = (type: string, name: string) => {
    return type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
  };

  return (
    <div className="space-y-3 bg-white border border-[#e1dfdd] rounded-xs p-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-[#edebe9] pb-2.5">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#0d9488]" />
          <h4 className="text-xs font-semibold text-[#242424]">{title}</h4>
          <span className="text-[10px] bg-[#f3f8fd] text-[#0f766e] font-bold px-1.5 py-0.5 rounded">
            {attachments.length} {attachments.length === 1 ? 'file' : 'files'}
          </span>
        </div>
        <div className="text-[11px] text-[#605e5c]">
          {hasFullCrud ? (
            <span className="text-emerald-700 font-medium">Full File Management (Admins & RMs)</span>
          ) : (
            <span className="text-neutral-500">View & Download Permitted</span>
          )}
        </div>
      </div>

      {/* Upload Zone (if user has permission to upload) */}
      {canUpload && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xs p-3 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-[#0d9488] bg-[#f3f8fd]' : 'border-[#c8c6c4] hover:border-[#0d9488] bg-[#faf9f8]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handleProcessFiles(e.target.files)}
          />
          <div className="flex flex-col items-center justify-center gap-1">
            <UploadCloud className="w-5 h-5 text-[#0d9488]" />
            <div className="text-xs font-medium text-[#242424]">
              Click or drag & drop proof documents, incident photos, or assessments
            </div>
            <div className="text-[10px] text-neutral-400">
              Supports images (PNG, JPG), PDF dossiers, Word, Excel, and scan files
            </div>
          </div>
        </div>
      )}

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <div className="text-center py-4 text-xs text-neutral-400 italic">
          No files or proofs attached to this record yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {attachments.map(att => {
            const isImg = isImage(att.type, att.name);
            return (
              <div
                key={att.id}
                className="flex items-center justify-between p-2.5 bg-[#faf9f8] border border-[#edebe9] rounded-xs hover:border-[#8a8886] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {isImg ? (
                    <div className="w-8 h-8 rounded shrink-0 overflow-hidden bg-neutral-200 border border-neutral-300 flex items-center justify-center">
                      {att.dataUrl ? (
                        <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-neutral-500" />
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded shrink-0 bg-[#f0fdfa] text-[#0f766e] flex items-center justify-center border border-[#99f6e4]">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#242424] truncate" title={att.name}>
                      {att.name}
                    </p>
                    <p className="text-[10px] text-[#605e5c]">
                      {formatFileSize(att.size)} • {att.uploadedBy} • {att.uploadedAt.slice(0, 10)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {/* View on Same Page */}
                  <button
                    type="button"
                    onClick={() => setPreviewFile(att)}
                    className="p-1.5 text-[#0d9488] hover:bg-[#edebe9] rounded"
                    title="View Document on this page"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Download */}
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    className="p-1.5 text-neutral-600 hover:bg-[#edebe9] rounded"
                    title="Download File"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete (Admins & RMs only) */}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(att.id, att.name)}
                      className="p-1.5 text-[#a4262c] hover:bg-red-50 rounded"
                      title="Delete File"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INLINE DOCUMENT PREVIEW MODAL (ON SAME PAGE) */}
      {previewFile && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-xs border border-[#e1dfdd] shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-[#e1dfdd] bg-[#f8f9fa] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#0d9488]" />
                <h3 className="text-sm font-semibold text-[#242424] truncate">
                  Document Preview: {previewFile.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(previewFile)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] min-h-[300px]">
              {isImage(previewFile.type, previewFile.name) ? (
                <div className="max-w-full max-h-[500px] overflow-hidden rounded border border-neutral-300 bg-white p-2 shadow-sm">
                  <img
                    src={previewFile.dataUrl}
                    alt={previewFile.name}
                    className="max-h-[460px] w-auto max-w-full object-contain mx-auto"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : previewFile.type.includes('pdf') || previewFile.name.endsWith('.pdf') ? (
                <div className="w-full h-[450px] bg-white rounded border border-[#edebe9] flex flex-col items-center justify-center p-6 text-center shadow-xs">
                  <FileText className="w-16 h-16 text-[#0d9488] mb-3" />
                  <h4 className="text-base font-semibold text-[#242424] mb-1">{previewFile.name}</h4>
                  <p className="text-xs text-[#605e5c] mb-4">
                    PDF Document ({formatFileSize(previewFile.size)}) • Uploaded by {previewFile.uploadedBy} on {previewFile.uploadedAt.slice(0, 10)}
                  </p>
                  <iframe
                    src={previewFile.dataUrl}
                    title={previewFile.name}
                    className="w-full flex-1 rounded border border-neutral-200 mb-3"
                  />
                  <button
                    onClick={() => handleDownload(previewFile)}
                    className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF Document</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-xs border border-[#edebe9] max-w-md text-center shadow-xs">
                  <File className="w-12 h-12 text-[#0d9488] mx-auto mb-3" />
                  <h4 className="text-sm font-semibold text-[#242424] mb-1">{previewFile.name}</h4>
                  <p className="text-xs text-[#605e5c] mb-4">
                    File format: {previewFile.type} ({formatFileSize(previewFile.size)})
                  </p>
                  <button
                    onClick={() => handleDownload(previewFile)}
                    className="px-4 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xs text-xs font-semibold shadow-xs flex items-center gap-1.5 mx-auto"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File to View</span>
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-2.5 border-t border-[#edebe9] bg-white flex items-center justify-between text-[11px] text-[#605e5c]">
              <div>
                Attached to: <strong className="text-[#242424]">{entityName}</strong> • {formatFileSize(previewFile.size)}
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-3 py-1 bg-[#edebe9] hover:bg-[#e1dfdd] text-[#323130] font-semibold rounded-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
