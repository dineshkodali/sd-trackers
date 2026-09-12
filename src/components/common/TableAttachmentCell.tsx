import React, { useState } from 'react';
import { Paperclip, Copy, Check, ExternalLink, Download, FileText, Image as ImageIcon, FileSpreadsheet, Files } from 'lucide-react';
import { RecordAttachment } from '../../types';

interface TableAttachmentCellProps {
  attachments?: RecordAttachment[] | any;
  attachmentUrl?: string | null;
  fileUrl?: string | null;
  recordTitle?: string;
}

export const TableAttachmentCell: React.FC<TableAttachmentCellProps> = ({
  attachments,
  attachmentUrl,
  fileUrl,
  recordTitle
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Normalize attachments list
  const isExplicitArray = Array.isArray(attachments);
  let items: RecordAttachment[] = [];
  if (isExplicitArray && attachments.length > 0) {
    items = attachments;
  } else if (typeof attachments === 'string' && attachments.trim().startsWith('[')) {
    try {
      items = JSON.parse(attachments);
    } catch {
      items = [];
    }
  }

  // Only check standalone attachmentUrl / fileUrl if attachments array was NOT explicitly provided (e.g. legacy table row)
  // and ensure it is a valid http(s) link (never a stale data: URI or 'null'/'undefined')
  const fallbackUrl = attachmentUrl || fileUrl;
  const isValidHttp = typeof fallbackUrl === 'string' && fallbackUrl.trim() && (fallbackUrl.startsWith('http://') || fallbackUrl.startsWith('https://')) && !fallbackUrl.includes('null') && !fallbackUrl.includes('undefined');
  if (!isExplicitArray && items.length === 0 && isValidHttp) {
    items = [{
      id: 'att-fallback',
      name: recordTitle ? `${recordTitle} Document` : 'Attached File',
      size: 0,
      type: fallbackUrl.endsWith('.pdf') ? 'application/pdf' : (fallbackUrl.startsWith('data:image') ? 'image/png' : 'application/octet-stream'),
      dataUrl: fallbackUrl,
      url: fallbackUrl,
      uploadedBy: 'Officer',
      uploadedAt: new Date().toISOString()
    }];
  }

  if (!items || items.length === 0) {
    return <span className="text-neutral-400 italic">—</span>;
  }

  const handleCopyLink = async (e: React.MouseEvent, att: RecordAttachment) => {
    e.stopPropagation();
    e.preventDefault();
    const link = att.url || att.dataUrl;
    if (!link) return;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(att.id || 'primary');
      setTimeout(() => setCopiedId(null), 2200);
    } catch {
      // Fallback manual copy
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(att.id || 'primary');
      setTimeout(() => setCopiedId(null), 2200);
    }
  };

  const handleOpenOrDownload = (e: React.MouseEvent, att: RecordAttachment) => {
    e.stopPropagation();
    const link = att.url || att.dataUrl;
    if (!link) return;

    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      // Data URL download or preview
      const a = document.createElement('a');
      a.href = link;
      a.download = att.name || 'attachment';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const isSingle = items.length === 1;
  const primary = items[0];

  const getIcon = (type?: string, name?: string) => {
    const n = (name || '').toLowerCase();
    const t = (type || '').toLowerCase();
    if (n.endsWith('.pdf') || t.includes('pdf')) return <FileText className="w-3.5 h-3.5 text-red-600" />;
    if (n.endsWith('.xlsx') || n.endsWith('.xls') || t.includes('spreadsheet') || t.includes('excel')) {
      return <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />;
    }
    if (n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || t.startsWith('image/')) {
      return <ImageIcon className="w-3.5 h-3.5 text-blue-600" />;
    }
    return <Paperclip className="w-3.5 h-3.5 text-teal-600" />;
  };

  if (isSingle) {
    const isCopied = copiedId === (primary.id || 'primary');
    return (
      <div className="inline-flex items-center gap-1.5 py-0.5" onClick={e => e.stopPropagation()}>
        <div 
          className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-50 hover:bg-teal-50/60 border border-neutral-200 hover:border-teal-300 rounded text-xs text-neutral-700 transition-colors max-w-[170px]"
          title={`${primary.name} (${primary.size ? `${Math.round(primary.size / 1024)} KB` : 'Uploaded File'})`}
        >
          {getIcon(primary.type, primary.name)}
          <span className="truncate font-medium">{primary.name}</span>
        </div>

        {/* Copy Link Button */}
        <button
          type="button"
          onClick={e => handleCopyLink(e, primary)}
          className={`p-1 rounded transition-colors ${
            isCopied 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 border border-transparent'
          }`}
          title={isCopied ? "Link Copied to Clipboard!" : "Copy accessible file link"}
          aria-label="Copy file link"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* Open / Download */}
        <button
          type="button"
          onClick={e => handleOpenOrDownload(e, primary)}
          className="p-1 hover:bg-neutral-100 text-neutral-500 hover:text-[#0d9488] rounded transition-colors"
          title="Open or Download file"
          aria-label="Open or download file"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Multiple files
  return (
    <div className="relative inline-block text-left" onClick={e => e.stopPropagation()}>
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 hover:bg-teal-100 text-[#0f766e] border border-teal-200 rounded text-xs font-semibold transition-colors"
          title={`Click to view all ${items.length} attachments`}
        >
          <Files className="w-3.5 h-3.5" />
          <span>{items.length} Files</span>
        </button>

        {/* Quick copy first file link */}
        <button
          type="button"
          onClick={e => handleCopyLink(e, primary)}
          className={`p-1 rounded transition-colors ${
            copiedId === primary.id 
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
              : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800'
          }`}
          title={copiedId === primary.id ? "Link Copied!" : `Copy link for ${primary.name}`}
        >
          {copiedId === primary.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Popover list of all files with individual copy links */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
          <div className="absolute left-0 mt-1 w-64 bg-white border border-[#e1dfdd] shadow-lg rounded-xs z-50 p-2 space-y-1.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-1 border-b border-neutral-100 text-[11px] font-bold text-neutral-700">
              <span>Attached Files ({items.length})</span>
              <span className="text-neutral-400 font-normal">Click to copy/open</span>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 divide-y divide-neutral-50">
              {items.map(att => {
                const isCopied = copiedId === att.id;
                return (
                  <div key={att.id} className="pt-1 flex items-center justify-between gap-1.5 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getIcon(att.type, att.name)}
                      <span className="truncate text-neutral-700 font-medium" title={att.name}>
                        {att.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={e => handleCopyLink(e, att)}
                        className={`p-1 rounded transition-colors ${
                          isCopied 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900'
                        }`}
                        title={isCopied ? "Link Copied!" : "Copy Link"}
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={e => handleOpenOrDownload(e, att)}
                        className="p-1 hover:bg-neutral-100 text-neutral-500 hover:text-[#0d9488] rounded"
                        title="Download / Open"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
