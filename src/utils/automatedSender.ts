import { Client, Charge, CompanySettings } from '../types';
import { getDefaultMessage, openWhatsAppLink } from './formatters';

export interface AutomatedSendResult {
  success: boolean;
  method: 'whatsapp_link';
  textSent?: string;
}

/**
 * Executes 1-click WhatsApp message sending for a client.
 * Directly formats the text template and triggers WhatsApp (or WhatsApp Business / Web).
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
  const textToSend = getDefaultMessage(client, charge, settings);

  openWhatsAppLink(client.phone, textToSend, settings);

  if (onConfirmSent) {
    onConfirmSent(client, charge, textToSend || 'Lembrete de vencimento enviado');
  }

  return { success: true, method: 'whatsapp_link', textSent: textToSend };
}
