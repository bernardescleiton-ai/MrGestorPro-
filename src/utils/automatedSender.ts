import { Client, Charge, CompanySettings } from '../types';
import { getDefaultMessage, openWhatsAppLink, dateBR, formatDateTimeBR } from './formatters';
import { dataUrlToFile, copyImageToClipboard, downloadImage } from './imageHelper';

export interface AutomatedSendResult {
  success: boolean;
  method: 'native_share' | 'whatsapp_link';
  copiedToClipboard?: boolean;
  aborted?: boolean;
  textSent?: string;
}

/**
 * Executes 1-click automated WhatsApp sending for a client.
 * Seamlessly handles:
 * - Direct native file sharing (attaches the image file and pre-fills the message text in WhatsApp)
 * - Guaranteed WhatsApp direct chat opening with formatted text + rich image preview link
 * - Background image copying to clipboard & device gallery
 * - 100% immune to empty messages or lost templates
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

  const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const publicNoticeUrl = `${origin}/aviso`;

  // Construct guaranteed text that is NEVER empty and includes the image preview link
  let textToSend = fullText;

  if (hasImage && sendMode === 'image_only') {
    const dueStr = charge
      ? (charge.dueTime ? `${dateBR(charge.dueDate)} às ${charge.dueTime}` : dateBR(charge.dueDate))
      : (client.dueDate ? formatDateTimeBR(client.dueDate) : '');
    const amountStr = charge?.amount ? `R$ ${charge.amount.toFixed(2).replace('.', ',')}` : '';

    let msg = `Olá, *${client.name}*! Tudo bem?`;
    msg += `\n\n🖼️ Segue o seu *Aviso de Vencimento*:`;
    if (dueStr) msg += `\n📅 Vencimento: *${dueStr}*`;
    if (amountStr) msg += `\n💰 Valor: *${amountStr}*`;
    msg += `\n\n👉 *Toque no link para ver o aviso completo:*`;
    msg += `\n${publicNoticeUrl}`;
    if (settings.pixKey) {
      msg += `\n\n🔑 Chave PIX: *${settings.pixKey}*`;
    }
    if (settings.signature) {
      msg += `\n\n${settings.signature}`;
    }
    textToSend = msg;
  } else if (hasImage && sendMode === 'image_and_text') {
    // Append the direct notice link if not already inside the template
    if (!textToSend.includes('/aviso') && !textToSend.includes('/api/template-image')) {
      textToSend += `\n\n🖼️ *Visualizar Aviso / Cartaz Oficial:*\n${publicNoticeUrl}`;
    }
  }

  // 1. Text only (no image template or mode is text_only)
  if (!hasImage || sendMode === 'text_only') {
    openWhatsAppLink(client.phone, textToSend, settings);
    if (onConfirmSent) {
      onConfirmSent(client, charge, textToSend || 'Lembrete de vencimento enviado');
    }
    return { success: true, method: 'whatsapp_link' };
  }

  // 2. Image sending
  const imageSrc = settings.messageTemplateImage!;
  const imageName = settings.messageTemplateImageName || 'aviso_cobranca.jpg';

  // Prepare safe file
  let file: File | null = null;
  try {
    file = dataUrlToFile(imageSrc, imageName);
  } catch (err) {
    console.warn('Could not parse image to File:', err);
  }

  // Try native Web Share with files if supported (Android Chrome, PWA, iOS)
  let canShare = false;
  if (file && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (typeof navigator.canShare === 'function') {
        canShare = navigator.canShare({ files: [file] });
      }
    } catch {
      canShare = false;
    }
  }

  if (canShare && file) {
    try {
      await navigator.share({
        files: [file],
        text: textToSend,
        title: `Aviso - ${client.name}`,
      });

      if (onConfirmSent) {
        onConfirmSent(client, charge, textToSend || 'Envio de aviso com foto');
      }
      return { success: true, method: 'native_share', textSent: textToSend };
    } catch (shareErr: any) {
      if (shareErr?.name === 'AbortError') {
        // User closed or dismissed the share sheet
        return { success: false, method: 'native_share', aborted: true };
      }
      console.warn('Native share failed or not allowed, opening direct WhatsApp chat:', shareErr);
    }
  }

  // 3. Fallback for WebViews, Desktop, and environments without direct native file sharing:
  // Automatically copy image to clipboard so user can press Ctrl+V in WhatsApp Web
  const copied = await copyImageToClipboard(imageSrc).catch(() => false);

  // Save to device gallery as background helper
  try {
    downloadImage(imageSrc, imageName);
  } catch {}

  // Open WhatsApp directly with phone & text pre-filled (including the rich preview link)
  openWhatsAppLink(client.phone, textToSend, settings);

  if (onConfirmSent) {
    onConfirmSent(client, charge, textToSend || 'Envio de aviso com foto');
  }

  return { success: true, method: 'whatsapp_link', copiedToClipboard: copied, textSent: textToSend };
}
