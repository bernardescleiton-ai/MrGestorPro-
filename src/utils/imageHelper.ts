/**
 * Utility functions for handling image templates, compression, clipboard copying, and downloading
 */

export interface ProcessedImageResult {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Reads and compresses an image file (.jpg, .jpeg, .png)
 * Automatically resizes to max dimensions (default 1200x1200) to keep base64 payload small (<150KB)
 * while preserving high visual quality for WhatsApp messages.
 */
export async function processTemplateImage(
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.84
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    // Validate file type
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const isJpg =
      file.type === 'image/jpeg' ||
      file.type === 'image/jpg' ||
      file.name.toLowerCase().endsWith('.jpg') ||
      file.name.toLowerCase().endsWith('.jpeg');

    if (!isPng && !isJpg) {
      reject(new Error('Formato não suportado. Por favor, envie uma imagem nos formatos .jpg, .jpeg ou .png.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Downscale while preserving aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem no navegador.'));
          return;
        }

        // Draw smoothly
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as PNG if it was PNG, or JPEG otherwise
        const outputMime = isPng ? 'image/png' : 'image/jpeg';
        const dataUrl = canvas.toDataURL(outputMime, isPng ? undefined : quality);

        // Approximate size in bytes
        const head = `data:${outputMime};base64,`;
        const sizeBytes = Math.round(((dataUrl.length - head.length) * 3) / 4);

        resolve({
          dataUrl,
          name: file.name,
          width,
          height,
          sizeBytes,
        });
      };

      img.onerror = () => reject(new Error('Falha ao renderizar a imagem carregada.'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Falha na leitura do arquivo de imagem.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Converts a data URL to a PNG Blob for ClipboardItem support
 */
export async function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Falha ao gerar blob de imagem'));
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para conversão'));
    img.src = dataUrl;
  });
}

/**
 * Converts a data URL to a File object with proper MIME type
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const byteString = atob(parts[1]);
  const length = byteString.length;
  const u8arr = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    u8arr[i] = byteString.charCodeAt(i);
  }

  return new File([u8arr], filename, { type: mime });
}

/**
 * Copies an image dataUrl directly to the system clipboard
 */
export async function copyImageToClipboard(dataUrl: string): Promise<boolean> {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) {
      return false;
    }
    const pngBlob = await dataUrlToPngBlob(dataUrl);
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ]);
    return true;
  } catch (err) {
    console.warn('Clipboard copy error:', err);
    return false;
  }
}

/**
 * Copies text string to clipboard
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.warn('Text copy error:', err);
    return false;
  }
}

/**
 * Triggers a download of the dataUrl image
 */
export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename || 'aviso-vencimento.jpg';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
  }, 200);
}

/**
 * Checks if the current browser/device supports native sharing of files
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return false;
  }
  try {
    const dummyFile = new File(['test'], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [dummyFile] });
  } catch {
    return false;
  }
}
