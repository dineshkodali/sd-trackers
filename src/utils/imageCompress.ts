/**
 * Photograph handling for maintenance evidence.
 *
 * Phone photos are several megabytes. They are scaled to a sensible size and re-encoded as JPEG in the browser before they
 * are attached, so a record with a handful of photos stays small enough to save and to load with every other record.
 */

/** Largest size that fits inside a square of `max` pixels, keeping the proportions and never enlarging. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export interface CompressedImage {
  dataUrl: string;
  size: number;
  type: 'image/jpeg';
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read as a picture.')); };
    img.src = url;
  });
}

const dataUrlBytes = (dataUrl: string) => Math.floor((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

/** Scales and re-encodes a picture. Rejects files that are not pictures the browser can open (for example HEIC). */
export async function compressImage(file: File, maxEdge = IMAGE_MAX_EDGE): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not a picture.`);
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} is larger than ${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)} MB.`);
  const img = await loadImage(file);
  const { width, height } = fitWithin(img.naturalWidth, img.naturalHeight, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Pictures cannot be processed in this browser.');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  let quality = 0.82;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(dataUrl) > 900 * 1024 && quality > 0.5) { // aim for under ~0.9 MB per photo
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return { dataUrl, size: dataUrlBytes(dataUrl), type: 'image/jpeg', width, height };
}
