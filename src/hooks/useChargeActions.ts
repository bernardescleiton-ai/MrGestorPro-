import { useCallback } from 'react';
import type { AppData, Charge, SectionType } from '../types';
import type { ConfirmModal } from './useAppData';
import { deleteChargeFromFirestore, deleteChargesBatchFromFirestore, deleteSentLogFromFirestore, deleteSentLogsBatchFromFirestore, deleteWhatsAppMediaFromCloud } from '../lib/api';
import { deleteWhatsAppMedia } from '../lib/whatsappMedia';

export const useChargeActions = ({ data, setData, generateUUID, setActiveSection, setChargeDefaultClientId, setIsChargeModalOpen, setConfirmModal }: {
  data: AppData;
  setData: (update: AppData | ((prev: AppData) => AppData)) => void;
  generateUUID: () => string;
  setActiveSection: (section: SectionType) => void;
  setChargeDefaultClientId: (id: string | undefined) => void;
  setIsChargeModalOpen: (value: boolean) => void;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModal>>;

}) => {
  const handleOpenNewCharge = useCallback((defaultClientId?: string) => {
    if (!data.clients.length) { alert('Você precisa cadastrar pelo menos um cliente antes de criar uma cobrança.'); setActiveSection('clients'); return; }
    setChargeDefaultClientId(defaultClientId || data.clients[0].id); setIsChargeModalOpen(true);
  }, [data.clients, setActiveSection, setChargeDefaultClientId, setIsChargeModalOpen]);

  const handleSaveCharge = useCallback((chargeData: Omit<Charge, 'id' | 'createdAt' | 'paid'>) => {
    const newCharge: Charge = { id: generateUUID(), ...chargeData, paid: false, createdAt: new Date().toISOString() };
    setData((prev) => ({ ...prev, charges: [newCharge, ...prev.charges] }));
  }, [generateUUID, setData]);

  const handleMarkPaid = useCallback((chargeId: string) => {
    setData((prev) => {
      if (chargeId.startsWith('client-charge-')) {
        const clientId = chargeId.replace('client-charge-', ''); const client = prev.clients.find((c) => c.id === clientId);
        if (!client?.dueDate) return prev;
        const [datePart, timePart] = client.dueDate.split('T'); const now = new Date().toISOString();
        const newPaidCharge: Charge = { id: generateUUID(), clientId: client.id, amount: 0, dueDate: datePart, dueTime: timePart || undefined, note: 'Mensalidade do Cliente', paid: true, paidAt: now, createdAt: now };
        const currentDate = new Date(client.dueDate); currentDate.setMonth(currentDate.getMonth() + 1);
        return { ...prev, charges: [newPaidCharge, ...prev.charges], clients: prev.clients.map((c) => c.id === clientId ? { ...c, dueDate: currentDate.toISOString().slice(0, 16) } : c) };
      }
      const targetCharge = prev.charges.find((ch) => ch.id === chargeId); if (!targetCharge) return prev;
      let updatedClients = prev.clients; const client = prev.clients.find((c) => c.id === targetCharge.clientId);
      if (client?.dueDate) {
        const [clientDatePart] = client.dueDate.split('T');
        if (targetCharge.dueDate === clientDatePart) {
          const currentDate = new Date(client.dueDate); currentDate.setMonth(currentDate.getMonth() + 1);
          updatedClients = prev.clients.map((c) => c.id === client.id ? { ...c, dueDate: currentDate.toISOString().slice(0, 16) } : c);
        }
      }
      return { ...prev, clients: updatedClients, charges: prev.charges.map((ch) => ch.id === chargeId ? { ...ch, paid: true, paidAt: new Date().toISOString() } : ch) };
    });
  }, [generateUUID, setData]);

  const handleUndoPaid = useCallback((chargeId: string) => {
    setData((prev) => {
      const targetCharge = prev.charges.find((ch) => ch.id === chargeId); if (!targetCharge) return prev;
      let updatedClients = prev.clients; const client = prev.clients.find((c) => c.id === targetCharge.clientId);
      if (client?.dueDate) {
        const currentDate = new Date(client.dueDate); currentDate.setMonth(currentDate.getMonth() - 1);
        const prevDueDateStr = currentDate.toISOString().slice(0, 16);
        const nextMonthOfCharge = new Date(targetCharge.dueDate + 'T12:00:00'); nextMonthOfCharge.setMonth(nextMonthOfCharge.getMonth() + 1);
        const [nextMonthOfChargeDatePart] = nextMonthOfCharge.toISOString().split('T'); const [clientDatePart] = client.dueDate.split('T');
        if (clientDatePart === nextMonthOfChargeDatePart) updatedClients = prev.clients.map((c) => c.id === client.id ? { ...c, dueDate: prevDueDateStr } : c);
      }
      return { ...prev, clients: updatedClients, charges: prev.charges.map((ch) => { if (ch.id !== chargeId) return ch; const { paidAt, ...rest } = ch; return { ...rest, paid: false }; }) };
    });
  }, [setData]);

  const handleDeleteCharge = useCallback((chargeId: string) => {
    setConfirmModal({ isOpen: true, title: 'Excluir Cobrança', message: 'Deseja excluir esta cobrança permanentemente?', onConfirm: () => {
      setData((prev) => ({ ...prev, charges: prev.charges.filter((ch) => ch.id !== chargeId) })); deleteChargeFromFirestore(chargeId).catch(() => {}); setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } });
  }, [setConfirmModal, setData]);

  const handleSaveSettings = useCallback((newSettings: AppData['settings']) => {
    setData((prev) => {
      const isMediaDeleted = prev.settings?.whatsappMedia && !newSettings?.whatsappMedia;
      if (isMediaDeleted) {
        deleteWhatsAppMedia(prev.settings.whatsappMedia).catch(() => {});
        deleteWhatsAppMediaFromCloud().catch(() => {});
      }
      return {
        ...prev,
        settings: newSettings,
        updatedAt: Date.now(),
      };
    });
  }, [setData]);

  const handleDeleteSentLog = useCallback((logId: string) => {
    setConfirmModal({ isOpen: true, title: 'Excluir do Histórico', message: 'Deseja excluir este registro do histórico de mensagens?', onConfirm: () => {
      setData((prev) => ({ ...prev, sentLogs: (prev.sentLogs || []).filter((l) => l.id !== logId) })); deleteSentLogFromFirestore(logId).catch(() => {}); setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } });
  }, [setConfirmModal, setData]);

  const handleDeleteSentLogsBatch = useCallback((logIds: string[]) => {
    if (!logIds.length) return;
    setConfirmModal({ isOpen: true, title: 'Excluir Histórico em Massa', message: `Tem certeza de que deseja excluir permanentemente os ${logIds.length} registros selecionados do histórico?`, onConfirm: () => {
      const idSet = new Set(logIds); setData((prev) => ({ ...prev, sentLogs: (prev.sentLogs || []).filter((l) => !idSet.has(l.id)) })); deleteSentLogsBatchFromFirestore(logIds).catch(() => {}); setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } });
  }, [setConfirmModal, setData]);

  const handleDeleteChargesBatch = useCallback((chargeIds: string[]) => {
    if (!chargeIds.length) return;
    setConfirmModal({ isOpen: true, title: 'Excluir Vencimentos em Massa', message: `Tem certeza de que deseja excluir permanentemente os ${chargeIds.length} vencimentos selecionados?`, onConfirm: () => {
      const idSet = new Set(chargeIds); setData((prev) => ({ ...prev, charges: prev.charges.filter((ch) => !idSet.has(ch.id)) })); deleteChargesBatchFromFirestore(chargeIds).catch(() => {}); setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    } });
  }, [setConfirmModal, setData]);

  const handleToggleMessageSent = useCallback((chargeId: string) => setData((prev) => ({ ...prev, charges: prev.charges.map((ch) => ch.id === chargeId ? { ...ch, messageSent: !ch.messageSent, messageSentAt: !ch.messageSent ? new Date().toISOString() : undefined } : ch) })), [setData]);

  return { handleOpenNewCharge, handleSaveCharge, handleMarkPaid, handleUndoPaid, handleDeleteCharge, handleSaveSettings, handleDeleteSentLog, handleDeleteSentLogsBatch, handleDeleteChargesBatch, handleToggleMessageSent };
};
