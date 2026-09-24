import type { CompanySettings, WhatsAppMediaAttachment } from '../types';
import { openWhatsAppLink, normalizePhone } from './formatters';
import { getMediaFromIDB } from '../lib/indexedDBMedia';

export type WhatsAppMediaSendResult = 'share_sheet' | 'text_fallback' | 'invalid';

/**
 * Converts any image blob (e.g. JPEG, WEBP) to PNG for maximum clipboard compatibility
 */
export function convertBlobToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(blob);
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 300;
      canvas.height = img.naturalHeight || img.height || 300;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(blob);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => resolve(b || blob), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

/**
 * Resolves the raw Blob for a WhatsAppMediaAttachment from IndexedDB or URL
 */
export async function getMediaBlob(media: WhatsAppMediaAttachment): Promise<Blob | null> {
  let blob: Blob | null = null;

  if (media.id) {
    try {
      blob = await getMediaFromIDB(media.id);
    } catch {
      // ignore
    }
  }

  if (!blob && media.url) {
    try {
      const response = await fetch(media.url);
      if (response.ok) {
        blob = await response.blob();
      }
    } catch {
      // ignore
    }
  }

  return blob;
}

let cachedPngBlob: { idOrUrl: string; blob: Blob } | null = null;

/**
 * Copies an attached image directly to the user's system clipboard.
 * When WhatsApp opens, the user can simply hit Ctrl+V (or Paste) to insert the image into WhatsApp!
 */
export async function copyMediaImageToClipboard(media: WhatsAppMediaAttachment): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    const key = media.id || media.url || '';
    let pngBlob: Blob | null = null;

    if (cachedPngBlob && cachedPngBlob.idOrUrl === key) {
      pngBlob = cachedPngBlob.blob;
    } else {
      const rawBlob = await getMediaBlob(media);
      if (!rawBlob || !rawBlob.type.startsWith('image/')) return false;

      pngBlob = rawBlob.type === 'image/png' ? rawBlob : await convertBlobToPng(rawBlob);
      if (pngBlob) {
        cachedPngBlob = { idOrUrl: key, blob: pngBlob };
      }
    }

    if (pngBlob && typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({ 'image/png': pngBlob });
      await navigator.clipboard.write([item]);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Downloads the media attachment to the user's computer/phone
 */
export async function downloadMediaAttachment(media: WhatsAppMediaAttachment): Promise<boolean> {
  try {
    const blob = await getMediaBlob(media);
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = media.name || (media.type === 'image' ? 'anexo-whatsapp.png' : 'anexo-whatsapp.mp4');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prepares a WhatsApp message with an optional file using the browser's native share sheet (Mobile).
 */
async function _shareMedia(text: string, media: WhatsAppMediaAttachment): Promise<WhatsAppMediaSendResult> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'text_fallback';
  try {
    const blob = await getMediaBlob(media);
    if (!blob) return 'text_fallback';

    const file = new File([blob], media.name, { type: media.mimeType || blob.type });

    if (typeof navigator.canShare === 'function' && !navigator.canShare({ files: [file] })) {
      return 'text_fallback';
    }

    await navigator.share({
      title: 'Enviar pelo WhatsApp',
      text,
      files: [file],
    });
    return 'share_sheet';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'share_sheet';
    return 'text_fallback';
  }
}

export async function sendWhatsAppMessage({
  phone,
  text,
  settings,
  media,
  onImageCopied,
}: {
  phone: string;
  text: string;
  settings?: CompanySettings;
  media?: WhatsAppMediaAttachment | null;
  onImageCopied?: () => void;
}): Promise<WhatsAppMediaSendResult> {
  const normalized = normalizePhone(phone);
  if (!normalized) return 'invalid';

  // 1. Open WhatsApp link immediately (0ms delay - instant launch!)
  openWhatsAppLink(phone, text, settings);

  // 2. Asynchronously copy image to clipboard in background if attached
  if (media && media.type === 'image') {
    copyMediaImageToClipboard(media).then((copied) => {
      if (copied && onImageCopied) {
        onImageCopied();
      }
    }).catch(() => {});
  }

  return 'text_fallback';
}
