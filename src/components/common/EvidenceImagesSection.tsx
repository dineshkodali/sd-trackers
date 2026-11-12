import React, { useRef, useState } from 'react';
import { IconCloudUpload as UploadCloud, IconTrash as Trash2, IconX as X, IconPhoto as ImageIcon } from '@tabler/icons-react';
import { RecordAttachment } from '../../types';
import { useApp } from '../../context/AppContext';
import { compressImage, IMAGE_ACCEPT } from '../../utils/imageCompress';

interface Props {
  /** Heading, e.g. "Before work" - this section never shows pictures from any other section */
  title: string;
  images?: RecordAttachment[];
  onChange?: (images: RecordAttachment[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
  maxImages?: number;
  /** Shown when there are no pictures */
  emptyText?: string;
}

const fmtWhen = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
};

/**
 * A gallery of evidence photographs with its own uploader, preview and delete. Each picture records who uploaded it
 * and when. Used twice on a maintenance job (before work, after work) so the two sets can never be mixed.
 */
export const EvidenceImagesSection: React.FC<Props> = ({
  title, images = [], onChange, readOnly = false, disabled = false, maxImages = 10, emptyText
}) => {
  const { currentUserName, currentUserRole, requestConfirmation, closeConfirmation } = useApp();
  const [preview, setPreview] = useState<RecordAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = !readOnly && !!onChange && !disabled;
  const src = (a: RecordAttachment) => a.url || a.dataUrl || '';

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0 || !onChange) return;
    setError(null);
    const room = maxImages - images.length;
    if (room <= 0) { setError(`At most ${maxImages} pictures can be attached here.`); return; }
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Only the first ${room} picture(s) were added (limit ${maxImages}).`);
    setBusy(true);
    const added: RecordAttachment[] = [];
    const failed: string[] = [];
    for (const file of chosen) {
      try {
        const out = await compressImage(file);
        added.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
          size: out.size,
          type: out.type,
          dataUrl: out.dataUrl,
          uploadedBy: currentUserName || currentUserRole,
          uploadedAt: new Date().toISOString()
        });
      } catch (err: any) {
        failed.push(err?.message || file.name);
      }
    }
    setBusy(false);
    if (added.length > 0) onChange([...images, ...added]);
    if (failed.length > 0) setError(failed.join(' '));
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (img: RecordAttachment) => {
    if (!canEdit) return;
    requestConfirmation({
      title: 'Remove picture',
      message: `Remove "${img.name}" from ${title.toLowerCase()}? This cannot be undone.`,
      confirmLabel: 'Remove',
      isDanger: true,
      onConfirm: () => {
        onChange!(images.filter(i => i.id !== img.id));
        if (preview?.id === img.id) setPreview(null);
        closeConfirmation();
      }
    });
  };

  return (
    <section className="border border-[#e1dfdd] rounded-xs bg-white" aria-label={title}>
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#edebe9] bg-[#faf9f8]">
        <h4 className="text-xs font-bold text-[#323130] uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[#0d9488]" aria-hidden="true" />
          {title} <span className="font-normal text-[#605e5c] normal-case">({images.length})</span>
        </h4>
        {canEdit && (
          <>
            <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-white border border-[#8a8886] rounded-xs hover:bg-[#edebe9] disabled:opacity-60 cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" aria-hidden="true" />
              {busy ? 'Processing…' : 'Add pictures'}
            </button>
          </>
        )}
      </header>

      {error && <p role="alert" className="px-3 py-1.5 text-xs text-red-700 bg-red-50 border-b border-red-100">{error}</p>}

      {images.length === 0 ? (
        <p className="px-3 py-4 text-xs text-[#605e5c]">{emptyText || (canEdit ? 'No pictures yet. Use "Add pictures".' : 'No pictures recorded.')}</p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
          {images.map(img => (
            <li key={img.id} className="border border-[#e1dfdd] rounded-xs overflow-hidden bg-white">
              <button type="button" onClick={() => setPreview(img)} className="block w-full cursor-zoom-in" title="Open picture">
                {src(img)
                  ? <img src={src(img)} alt={img.name} loading="lazy" className="w-full h-24 object-cover bg-neutral-100" />
                  : <span className="flex items-center justify-center w-full h-24 text-[11px] text-neutral-500 bg-neutral-100">Picture unavailable</span>}
              </button>
              <div className="px-2 py-1.5 text-[11px] leading-snug">
                <div className="font-medium text-[#323130] truncate" title={img.uploadedBy}>{img.uploadedBy || '—'}</div>
                <div className="text-[#605e5c]">{fmtWhen(img.uploadedAt)}</div>
                {canEdit && (
                  <button type="button" onClick={() => remove(img)} className="mt-1 inline-flex items-center gap-1 text-red-700 hover:underline cursor-pointer">
                    <Trash2 className="w-3 h-3" aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {preview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={`${title} picture`} onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-xs overflow-hidden" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setPreview(null)} className="absolute top-2 right-2 p-1 bg-white/90 rounded-xs hover:bg-white cursor-pointer" aria-label="Close picture">
              <X className="w-4 h-4" />
            </button>
            <img src={src(preview)} alt={preview.name} className="max-h-[80vh] max-w-full object-contain" />
            <div className="px-3 py-2 text-xs text-[#323130] border-t border-[#e1dfdd]">
              {title} · uploaded by <strong>{preview.uploadedBy || '—'}</strong> · {fmtWhen(preview.uploadedAt)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
