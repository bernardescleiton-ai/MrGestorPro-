import { useCallback } from 'react';
import type { AppData, Client, Charge, SentMessageLog } from '../types';
import { getDefaultMessage } from '../utils/formatters';
import { sendWhatsAppMessage } from '../utils/whatsappMediaSender';

export const useMessagingActions = ({ data, setData, generateUUID }: {
  data: AppData; setData: (update: AppData | ((prev: AppData) => AppData)) => void; generateUUID: () => string;
}) => {
  const recordSentMessage = useCallback((client: Client, charge: Charge | null | undefined, messageText: string) => {
    const nowIso = new Date().toISOString();
    const newLog: SentMessageLog = { id: generateUUID(), clientId: client.id, clientName: client.name, phone: client.phone, chargeId: charge?.id, dueDate: charge?.dueDate || client.dueDate, sentAt: nowIso, messageText: messageText || (charge ? getDefaultMessage(client, charge, data.settings) : 'Lembrete de vencimento enviado'), note: charge?.note, status: 'enviado' };
    setData((prev) => ({ ...prev, charges: charge ? prev.charges.map((ch) => ch.id === charge.id ? { ...ch, messageSent: true, messageSentAt: nowIso } : ch) : prev.charges, sentLogs: [newLog, ...(prev.sentLogs || [])] }));
  }, [data.settings, generateUUID, setData]);

  const handleSendWhatsApp = useCallback(async (client: Client, charge?: Charge) => {
    const textToSend = getDefaultMessage(client, charge, data.settings);
    await sendWhatsAppMessage({ phone: client.phone, text: textToSend, settings: data.settings, media: data.settings.whatsappMedia });
    recordSentMessage(client, charge, textToSend);
  }, [data.settings, recordSentMessage]);

  return { handleSendWhatsApp, recordSentMessage };
};
