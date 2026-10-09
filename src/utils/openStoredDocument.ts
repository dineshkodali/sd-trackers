/**
 * Open a stored document URL safely.
 *
 * The previous viewers wrote the URL into a same-origin popup with
 * document.write, so a crafted fileUrl could inject script that ran with the
 * app's origin (and read the session token). Inline files are now decoded into
 * a Blob of an allow-listed, non-scriptable type; remote files must be http(s).
 */
const INLINE_DOCUMENT = /^data:(image\/(?:png|jpe?g|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/=\s]+)$/i;

export function openStoredDocument(fileUrl: string | undefined | null, fileName?: string): void {
  if (!fileUrl) return;

  const inline = INLINE_DOCUMENT.exec(fileUrl);
  if (inline) {
    const binary = atob(inline[2].replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blobUrl = URL.createObjectURL(new Blob([bytes], { type: inline[1].toLowerCase() }));
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(fileUrl, window.location.href);
  } catch {
    return;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;

  const a = document.createElement('a');
  a.href = parsed.href;
  a.download = fileName || 'Document';
  a.rel = 'noopener noreferrer';
  a.click();
}
