import { useCallback } from 'react';
import type { AppData, Client, Charge, WhatsAppMediaAttachment } from '../types';
import type { ConfirmModal } from './useAppData';
import type { RenewalToastData } from '../components/RenewalSuccessToast';
import { isDuplicateClientName } from '../components/ClientModal';
import { calculateRenewalDueDate, formatDateTimeBR, normalizePhone } from '../utils/formatters';
import { sendWhatsAppMessage } from '../utils/whatsappMediaSender';
import { deleteChargeFromFirestore, deleteClientFromFirestore } from '../lib/api';
import { trackClientDeletion, trackClientsBatchDeletion, trackChargeDeletion, trackChargesBatchDeletion, markHasPendingLocalChanges } from '../lib/offlineSyncManager';

export const useClientActions = ({
  data, setData, generateUUID, setClientToEdit, setIsClientModalOpen, setRenewalClient,
  setIsRenewalModalOpen, setRenewalToast, setConfirmModal, historyClient, setHistoryClient,
}: {
  data: AppData;
  setData: (update: AppData | ((prev: AppData) => AppData)) => void;
  generateUUID: () => string;
  setClientToEdit: (client: Client | null) => void;
  setIsClientModalOpen: (value: boolean) => void;
  setRenewalClient: (client: Client | null) => void;
  setIsRenewalModalOpen: (value: boolean) => void;
  setRenewalToast: (value: RenewalToastData | null) => void;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModal>>;
  historyClient: Client | null;
  setHistoryClient: (client: Client | null) => void;
}) => {
  const handleOpenNewClient = useCallback(() => { setClientToEdit(null); setIsClientModalOpen(true); }, []);
  const handleOpenEditClient = useCallback((client: Client) => { setClientToEdit(client); setIsClientModalOpen(true); }, []);
  const handleOpenRenewClient = useCallback((client: Client) => { setRenewalClient(client); setIsRenewalModalOpen(true); }, []);

  const handleConfirmRenewal = useCallback(async ({ client, months, customAmount, recordPaidCharge, sendWhatsApp, customDateStr, customWhatsAppMessage, media }: {
    client: Client; months: number; customAmount: number; recordPaidCharge: boolean; sendWhatsApp: boolean; customDateStr?: string; customWhatsAppMessage?: string; media?: WhatsAppMediaAttachment | null;
  }) => {
    const newDueDateStr = customDateStr || calculateRenewalDueDate(client.dueDate, months);
    const [datePart, timePart] = newDueDateStr.includes('T') ? newDueDateStr.split('T') : [newDueDateStr, ''];
    setData((prev) => {
      const updatedClients = prev.clients.map((c) => c.id === client.id ? { ...c, dueDate: newDueDateStr } : c);
      let updatedCharges = prev.charges;
      if (recordPaidCharge) {
        const newPaidCharge: Charge = {
          id: generateUUID(), clientId: client.id, amount: customAmount || 0, dueDate: datePart, dueTime: timePart || undefined,
          note: `Renovação (${months} ${months === 1 ? 'mês' : 'meses'})`, paid: true, paidAt: new Date().toISOString(), createdAt: new Date().toISOString(),
        };
        updatedCharges = prev.charges.map((ch) => ch.clientId === client.id && !ch.paid ? { ...ch, paid: true, paidAt: new Date().toISOString() } : ch);
        updatedCharges = [newPaidCharge, ...updatedCharges];
      }
      return { ...prev, clients: updatedClients, charges: updatedCharges };
    });
    setIsRenewalModalOpen(false);
    setRenewalToast({ client, newDueDate: newDueDateStr, months, amount: customAmount || 0, messageSent: Boolean(sendWhatsApp), customMessage: customWhatsAppMessage });
    if (sendWhatsApp) {
      const phone = normalizePhone(client.phone);
      if (phone) {
        const formattedDate = formatDateTimeBR(newDueDateStr);
        const valText = customAmount > 0 ? `\n💰 *Valor:* R$ ${customAmount.toFixed(2).replace('.', ',')}` : '';
        const defaultMsg = `Olá, *${client.name}*! Sua renovação de acesso foi realizada com sucesso!\n\n📅 *Novo Vencimento:* ${formattedDate}${valText}\n\nAgradecemos a preferência!`;
        const mediaToSend = media !== undefined ? media : data.settings.whatsappMedia;
        await sendWhatsAppMessage({ phone: client.phone, text: customWhatsAppMessage?.trim() ? customWhatsAppMessage : defaultMsg, settings: data.settings, media: mediaToSend });
      }
    }
  }, [data.settings, generateUUID, setData, setIsRenewalModalOpen, setRenewalClient, setRenewalToast]);

  const handleSaveRenewalTemplate = useCallback((templateText: string) => {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, renewalMessageTemplate: templateText } }));
  }, [setData]);

  const handleSaveClient = useCallback((clientData: Omit<Client, 'id' | 'createdAt'>, editId?: string) => {
    const trimmedName = clientData.name.trim();
    const duplicate = isDuplicateClientName(trimmedName, data.clients, editId);
    if (duplicate) { alert(`⚠️ Não foi possível salvar: já existe um cliente cadastrado com o nome "${duplicate.name}". Não são permitidos nomes duplicados.`); return; }
    setData((prev) => {
      let updatedClients = [...prev.clients];
      let updatedCharges = [...prev.charges];
      const targetClientId = editId || generateUUID();
      if (editId) updatedClients = updatedClients.map((c) => c.id === editId ? { ...c, ...clientData, name: trimmedName } : c);
      else updatedClients = [{ id: targetClientId, ...clientData, name: trimmedName, createdAt: new Date().toISOString() }, ...updatedClients];
      if (clientData.dueDate) {
        const [datePart, timePart] = clientData.dueDate.includes('T') ? clientData.dueDate.split('T') : [clientData.dueDate, ''];
        const existingChargeIndex = updatedCharges.findIndex((ch) => ch.clientId === targetClientId && !ch.paid);
        if (existingChargeIndex >= 0) updatedCharges[existingChargeIndex] = { ...updatedCharges[existingChargeIndex], dueDate: datePart, dueTime: timePart || undefined };
        else updatedCharges = [{ id: generateUUID(), clientId: targetClientId, amount: 0, dueDate: datePart, dueTime: timePart || undefined, paid: false, note: 'Vencimento do Cliente', createdAt: new Date().toISOString() }, ...updatedCharges];
      } else updatedCharges = updatedCharges.filter((ch) => !(ch.clientId === targetClientId && !ch.paid && ch.note === 'Vencimento do Cliente'));
      return { ...prev, clients: updatedClients, charges: updatedCharges };
    });
  }, [data.clients, generateUUID, setData]);

  const handleUpdateClientPhone = useCallback((clientId: string, newPhone: string) => setData((prev) => ({ ...prev, clients: prev.clients.map((c) => c.id === clientId ? { ...c, phone: newPhone } : c) })), [setData]);

  const handleSaveBatch = useCallback((clientsData: Omit<Client, 'id' | 'createdAt'>[]) => {
    setData((prev) => {
      let updatedClients = [...prev.clients]; let updatedCharges = [...prev.charges];
      const existingNames = new Set(prev.clients.map((c) => c.name.trim().toLowerCase()));
      for (const clientData of clientsData) {
        const trimmedName = clientData.name.trim(); const lowerName = trimmedName.toLowerCase();
        if (existingNames.has(lowerName)) continue;
        existingNames.add(lowerName);
        const targetClientId = generateUUID();
        updatedClients = [{ id: targetClientId, ...clientData, name: trimmedName, createdAt: new Date().toISOString() }, ...updatedClients];
        if (clientData.dueDate) {
          const [datePart, timePart] = clientData.dueDate.includes('T') ? clientData.dueDate.split('T') : [clientData.dueDate, ''];
          updatedCharges = [{ id: generateUUID(), clientId: targetClientId, amount: 0, dueDate: datePart, dueTime: timePart || undefined, paid: false, note: 'Vencimento do Cliente', createdAt: new Date().toISOString() }, ...updatedCharges];
        }
      }
      return { ...prev, clients: updatedClients, charges: updatedCharges };
    });
  }, [generateUUID, setData]);

  const handleDeleteClient = useCallback((clientId: string) => {
    const client = data.clients.find((c) => c.id === clientId);
    setConfirmModal({ isOpen: true, title: 'Excluir Cliente', message: `Deseja realmente excluir o cliente "${client?.name || 'Cliente'}"? Todas as cobranças associadas a ele também serão removidas.`, onConfirm: () => {
      const associatedCharges = data.charges.filter((ch) => ch.clientId === clientId);
      trackClientDeletion(clientId);
      for (const ch of associatedCharges) {
        trackChargeDeletion(ch.id);
      }
      setData((prev) => ({ ...prev, clients: prev.clients.filter((c) => c.id !== clientId), charges: prev.charges.filter((ch) => ch.clientId !== clientId) }));
      if (historyClient?.id === clientId) setHistoryClient(null);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      Promise.all([deleteClientFromFirestore(clientId).catch(() => {}), ...associatedCharges.map((ch) => deleteChargeFromFirestore(ch.id).catch(() => {}))]).catch(() => {});
    } });
  }, [data, historyClient, setConfirmModal, setData, setHistoryClient]);

  const handleDeleteBatch = useCallback((clientIds: string[]) => {
    if (!clientIds.length) return;
    setConfirmModal({ isOpen: true, title: 'Excluir Clientes Selecionados', message: `Deseja realmente excluir os ${clientIds.length} clientes selecionados? Todas as cobranças associadas a eles também serão removidas.`, onConfirm: () => {
      const idSet = new Set(clientIds);
      const associatedCharges = data.charges.filter((ch) => idSet.has(ch.clientId));
      trackClientsBatchDeletion(clientIds);
      trackChargesBatchDeletion(associatedCharges.map((ch) => ch.id));
      setData((prev) => ({ ...prev, clients: prev.clients.filter((c) => !idSet.has(c.id)), charges: prev.charges.filter((ch) => !idSet.has(ch.clientId)) }));
      if (historyClient && idSet.has(historyClient.id)) setHistoryClient(null);
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      Promise.all([...Array.from(idSet).map((cid) => deleteClientFromFirestore(cid).catch(() => {})), ...associatedCharges.map((ch) => deleteChargeFromFirestore(ch.id).catch(() => {}))]).catch(() => {});
    } });
  }, [data, historyClient, setConfirmModal, setData, setHistoryClient]);

  return { handleOpenNewClient, handleOpenEditClient, handleOpenRenewClient, handleConfirmRenewal, handleSaveRenewalTemplate, handleSaveClient, handleUpdateClientPhone, handleSaveBatch, handleDeleteClient, handleDeleteBatch };
};
