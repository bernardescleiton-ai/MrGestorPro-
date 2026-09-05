import { Client, Charge, CompanySettings } from '../types';
import { getDefaultMessage, openWhatsAppLink } from './formatters';
import { dataUrlToFile, copyImageToClipboard, downloadImage } from './imageHelper';

export interface AutomatedSendResult {
  success: boolean;
  method: 'native_share' | 'whatsapp_link';
  aborted?: boolean;
}

/**
 * Executes 1-click automated WhatsApp sending for a client.
 * Seamlessly handles:
 * - Direct native file sharing (attaches the image file and pre-fills the message text in WhatsApp)
 * - Desktop clipboard copy + direct WhatsApp Web opening
 * - Pure text sending if no image is configured
 * 
 * Eliminates the need for manual downloading, manual copying, or searching in attachments.
 */
export async function sendAutomatedWhatsApp({
  client,
  charge,
  settings,
  onConfirmSent,
}: {
  client: Client;
  charge?: Charge | null;
  settings: CompanySettings;
  onConfirmSent?: (client: Client, charge: Charge | null | undefined, messageText: string) => void;
}): Promise<AutomatedSendResult> {
  const hasImage = Boolean(settings.messageTemplateImage);
  const sendMode = settings.messageSendMode || (hasImage ? 'image_and_text' : 'text_only');
  const fullText = getDefaultMessage(client, charge, settings);
  const textToSend = sendMode === 'image_only' ? '' : fullText;

  // 1. Text only (no image template or mode is text_only)
  if (!hasImage || sendMode === 'text_only') {
    openWhatsAppLink(client.phone, textToSend, settings);
    if (onConfirmSent) {
      onConfirmSent(client, charge, textToSend || 'Lembrete de vencimento enviado');
    }
    return { success: true, method: 'whatsapp_link' };
  }

  // 2. Automated image sending
  const imageSrc = settings.messageTemplateImage!;
  const imageName = settings.messageTemplateImageName || 'aviso_cobranca.jpg';

  // Prepare safe file
  let file: File | null = null;
  try {
    file = dataUrlToFile(imageSrc, imageName);
  } catch (err) {
    console.warn('Could not parse image to File:', err);
  }

  // Check if native Web Share with files is supported (Android Chrome, PWA, iOS)
  if (file && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: textToSend || undefined,
          title: `Aviso - ${client.name}`,
        });

        if (onConfirmSent) {
          onConfirmSent(client, charge, textToSend || 'Envio de aviso com foto');
        }
        return { success: true, method: 'native_share' };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        // User closed or dismissed the share sheet
        return { success: false, method: 'native_share', aborted: true };
      }
      console.warn('Native share failed, falling back to direct WhatsApp link:', shareErr);
    }
  }

  // 3. Fallback for Desktop and environments without direct file share:
  // Automatically copy image to clipboard so user can press Ctrl+V in WhatsApp Web
  copyImageToClipboard(imageSrc).catch(() => {});

  // On mobile without native file share, save to gallery as background helper
  try {
    downloadImage(imageSrc, imageName);
  } catch {}

  // Open WhatsApp directly with phone & text pre-filled
  openWhatsAppLink(client.phone, textToSend, settings);

  if (onConfirmSent) {
    onConfirmSent(client, charge, textToSend || 'Envio de aviso com foto');
  }

  return { success: true, method: 'whatsapp_link' };
}
