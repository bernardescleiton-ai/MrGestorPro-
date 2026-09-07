import type { WhatsAppMediaAttachment } from '../types';
import { saveMediaToIDB, deleteMediaFromIDB } from './indexedDBMedia';
import { getApps } from 'firebase/app';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_BYTES = 16 * 1024 * 1024; // 16 MB
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export function validateWhatsAppMedia(file: File): { type: 'image' | 'video'; error?: string } {
  if (IMAGE_TYPES.has(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) return { type: 'image', error: 'A imagem deve ter no máximo 5 MB.' };
    return { type: 'image' };
  }
  if (VIDEO_TYPES.has(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) return { type: 'video', error: 'O vídeo deve ter no máximo 16 MB.' };
    return { type: 'video' };
  }
  return { type: 'image', error: 'Formato não suportado. Use JPG, PNG, WEBP, MP4, MOV ou WEBM.' };
}

async function uploadToFirebaseStorage(path: string, data: Blob | File, contentType?: string): Promise<string | null> {
  try {
    const apps = getApps();
    if (!apps.length) return null;
    const storage = getStorage(apps[0]);
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, data, contentType ? { contentType } : undefined);
    return await getDownloadURL(fileRef);
  } catch {
    return null;
  }
}

async function deleteFromFirebaseStorage(path: string): Promise<void> {
  try {
    const apps = getApps();
    if (!apps.length) return;
    const storage = getStorage(apps[0]);
    const fileRef = storageRef(storage, path);
    await deleteObject(fileRef);
  } catch {}
}

function processImageToDataUrl(file: File): Promise<{ blob: Blob; dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar a imagem para processamento.'));
      img.onload = () => {
        const maxDimension = 1280;
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const rawDataUrl = reader.result as string;
          resolve({ blob: file, dataUrl: rawDataUrl, mimeType: file.type });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png';
        const targetMime = isPng ? 'image/png' : 'image/jpeg';
        const quality = isPng ? undefined : 0.82;

        try {
          const dataUrl = canvas.toDataURL(targetMime, quality);
          canvas.toBlob(
            (blob) => {
              resolve({
                blob: blob || file,
                dataUrl,
                mimeType: targetMime,
              });
            },
            targetMime,
            quality
          );
        } catch {
          const rawDataUrl = reader.result as string;
          resolve({ blob: file, dataUrl: rawDataUrl, mimeType: file.type });
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadWhatsAppMedia(file: File, id: string): Promise<WhatsAppMediaAttachment> {
  const validation = validateWhatsAppMedia(file);
  if (validation.error) throw new Error(validation.error);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (validation.type === 'image') {
    try {
      const { blob, dataUrl, mimeType } = await processImageToDataUrl(file);
      await saveMediaToIDB(id, blob);

      const storagePath = `whatsapp-media/${id}-${safeName}`;
      const cloudUrl = await uploadToFirebaseStorage(storagePath, blob, mimeType);

      return {
        id,
        name: safeName,
        type: 'image',
        mimeType,
        size: blob.size,
        url: cloudUrl || dataUrl,
        uploadedAt: new Date().toISOString(),
      };
    } catch {
      await saveMediaToIDB(id, file);
      const storagePath = `whatsapp-media/${id}-${safeName}`;
      const cloudUrl = await uploadToFirebaseStorage(storagePath, file, file.type);
      const url = cloudUrl || URL.createObjectURL(file);
      return {
        id,
        name: safeName,
        type: 'image',
        mimeType: file.type,
        size: file.size,
        url,
        uploadedAt: new Date().toISOString(),
      };
    }
  }

  await saveMediaToIDB(id, file);
  const storagePath = `whatsapp-media/${id}-${safeName}`;
  const cloudUrl = await uploadToFirebaseStorage(storagePath, file, file.type);
  const url = cloudUrl || URL.createObjectURL(file);

  return {
    id,
    name: safeName,
    type: 'video',
    mimeType: file.type,
    size: file.size,
    url,
    uploadedAt: new Date().toISOString(),
  };
}

export async function deleteWhatsAppMedia(media?: WhatsAppMediaAttachment | null): Promise<void> {
  if (media) {
    if (media.url && media.url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(media.url);
      } catch {}
    }
    if (media.id) {
      await deleteMediaFromIDB(media.id);
      if (media.name) {
        await deleteFromFirebaseStorage(`whatsapp-media/${media.id}-${media.name}`);
      }
    }
  }
}
