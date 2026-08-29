import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Bell, X, MessageCircle, RefreshCw } from 'lucide-react';
import { AppData, SectionType, Client, Charge, CompanySettings, SentMessageLog, SystemRestorePoint } from './types';
import { initialAppData } from './data/initialData';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ClientsView } from './components/ClientsView';
import { ChargesView } from './components/ChargesView';
import { DueView, DueTabFilter } from './components/DueView';
import { SettingsView } from './components/SettingsView';
import { NotificationsView } from './components/NotificationsView';
import { ProfileView } from './components/ProfileView';
import { NoticesConfigView } from './components/NoticesConfigView';
import { ClientModal, isDuplicateClientName } from './components/ClientModal';
import { ChargeModal } from './components/ChargeModal';
import { ClientHistoryModal } from './components/ClientHistoryModal';
import { RenewalModal } from './components/RenewalModal';
import { openWhatsApp, openDirectWhatsApp, openWhatsAppLink, normalizePhone, getDefaultMessage, encodeForWhatsApp, formatDateTimeBR, calculateRenewalDueDate } from './utils/formatters';
import { checkAndTriggerDeviceNotifications } from './utils/notifications';
import { subscribeToApiData, saveAppData, sanitizeAppData, fetchAppData, mergeAppData, deleteClientFromFirestore, deleteChargeFromFirestore } from './lib/api';

const STORAGE_KEY = 'gc_v1_data';

const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'f' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export default function App() {
  const [data, setRawData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return sanitizeAppData(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading localStorage:', e);
    }
    return sanitizeAppData({ ...initialAppData, updatedAt: 1 });
  });

  const isRemoteUpdate = useRef<boolean>(false);
  const hasFetchedCloud = useRef<boolean>(false);
  const lastSavedDataJsonRef = useRef<string>('');
  const dataRef = useRef<AppData>(data);
  dataRef.current = data;

  // Custom setter that automatically adds or updates 'updatedAt' for local changes
  const setData = (update: AppData | ((prev: AppData) => AppData)) => {
    setRawData((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      return sanitizeAppData({
        ...next,
        updatedAt: Date.now(),
      });
    });
  };

  const [activeSection, setActiveSection] = useState<SectionType>('dashboard');
  const [dueTabFilter, setDueTabFilter] = useState<DueTabFilter>('today');

  const handleNavigate = (section: SectionType, tab?: DueTabFilter) => {
    if (tab) {
      setDueTabFilter(tab);
    } else if (section === 'due') {
      setDueTabFilter('today');
    }
    setActiveSection(section);
  };

  // Live Toast Notification
  const [liveToast, setLiveToast] = useState<{
    title: string;
    body: string;
    phone?: string;
    clientMessage?: string;
    client?: Client;
    charge?: Charge;
  } | null>(null);

  // Modals state
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [chargeDefaultClientId, setChargeDefaultClientId] = useState<string | undefined>(undefined);

  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  const [renewalClient, setRenewalClient] = useState<Client | null>(null);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [syncTrigger, setSyncTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      // 1. Manually write local state to Firestore immediately to guarantee sync
      await saveAppData(dataRef.current, 0);

      // 2. Fetch fresh cloud state
      const result = await fetchAppData();
      if (result.exists && result.data) {
        setRawData(result.data);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
        } catch {
          // localStorage fallback
        }
      }

      setSyncTrigger((prev) => prev + 1);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      console.warn('Manual sync notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Re-establish Firestore listener on focus, visibility change, online status, or periodic heartbeat
  useEffect(() => {
    const handleSyncReset = () => {
      setSyncTrigger((prev) => prev + 1);
    };

    window.addEventListener('focus', handleSyncReset);
    window.addEventListener('online', handleSyncReset);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleSyncReset();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleSyncReset);
      window.removeEventListener('online', handleSyncReset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Helper to create and save a system restore point into localStorage
  const createRestorePoint = (customName?: string, isAuto: boolean = false) => {
    try {
      const now = new Date();
      const todayDateStr = now.toISOString().split('T')[0];

      if (isAuto) {
        const lastAutoDate = localStorage.getItem('gc_v1_last_auto_restore_date');
        if (lastAutoDate === todayDateStr) {
          // Already created an automatic restore point today
          return null;
        }
      }

      const currentAppData = dataRef.current;
      if (isAuto && (!currentAppData || (!currentAppData.clients.length && !currentAppData.charges.length))) {
        return null;
      }

      const dateFormatted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const pointTitle = customName || (isAuto
        ? `Ponto Automático - ${now.toLocaleDateString('pt-BR')}`
        : `Ponto de Restauração - Sistema (${dateFormatted})`);

      const newPoint: SystemRestorePoint = {
        id: `rp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: pointTitle,
        createdAt: now.toISOString(),
        clientsCount: currentAppData ? currentAppData.clients.length : 0,
        chargesCount: currentAppData ? currentAppData.charges.length : 0,
        data: {
          clients: currentAppData ? JSON.parse(JSON.stringify(currentAppData.clients)) : [],
          charges: currentAppData ? JSON.parse(JSON.stringify(currentAppData.charges)) : [],
          settings: currentAppData ? JSON.parse(JSON.stringify(currentAppData.settings)) : {},
        },
      };

      const existingStr = localStorage.getItem('gc_v1_restore_points');
      const existing: SystemRestorePoint[] = existingStr ? JSON.parse(existingStr) : [];

      const updated = [newPoint, ...existing];
      localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));

      if (isAuto) {
        localStorage.setItem('gc_v1_last_auto_restore_date', todayDateStr);
      }

      return newPoint;
    } catch (e) {
      console.error('Failed to create system restore point:', e);
      return null;
    }
  };

  // Automatically save a restore point at most 1 time per day
  useEffect(() => {
    const timer = setTimeout(() => {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const lastAutoDate = localStorage.getItem('gc_v1_last_auto_restore_date');
      if (lastAutoDate !== todayDateStr) {
        const dateFormatted = new Date().toLocaleDateString('pt-BR');
        createRestorePoint(`Ponto Automático - ${dateFormatted}`, true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    fetchAppData()
      .then((res) => {
        if (res.exists && res.data) {
          hasFetchedCloud.current = true;
          setRawData((prev) => {
            const merged = mergeAppData(prev, res.data!);
            lastSavedDataJsonRef.current = JSON.stringify({
              clients: merged.clients,
              charges: merged.charges,
              settings: merged.settings,
              sentLogs: merged.sentLogs,
            });
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  // 1. Listen to Real-Time Cloud Updates (Instant Sync between Web App & APK)
  useEffect(() => {
    const unsubscribe = subscribeToApiData(
      (cloudData, exists) => {
        setSyncError(null);

        if (exists && cloudData) {
          hasFetchedCloud.current = true;
          setRawData((prev) => {
            const merged = mergeAppData(prev, cloudData);
            const serialized = JSON.stringify({
              clients: merged.clients,
              charges: merged.charges,
              settings: merged.settings,
              sentLogs: merged.sentLogs,
            });
            lastSavedDataJsonRef.current = serialized;
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            } catch {
              // local storage fallback
            }
            return merged;
          });
        } else if (!exists) {
          hasFetchedCloud.current = true;
          saveAppData(dataRef.current, 0).catch(() => {});
        }
      },
      (error) => {
        console.warn('Sync stream notice:', error);
        if (error && error.message && (error.message.includes('Quota exceeded') || error.message.includes('resource-exhausted'))) {
          setSyncError('Cota diária gratuita do Firebase atingida (dados mantidos no aparelho)');
        }
      }
    );

    return () => unsubscribe();
  }, [syncTrigger]);

  // 2. Persist changes locally and to REST API backend
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      if (!hasFetchedCloud.current) {
        return; // Do not push to Firebase until initial cloud state is loaded
      }

      const currentJson = JSON.stringify({
        clients: data.clients,
        charges: data.charges,
        settings: data.settings,
        sentLogs: data.sentLogs,
      });

      // Save to Cloud Firestore ONLY if data actually changed from last save/fetch
      if (currentJson !== lastSavedDataJsonRef.current) {
        lastSavedDataJsonRef.current = currentJson;
        saveAppData(data)
          .then(() => {
            setSyncError(null);
          })
          .catch((err) => {
            console.warn('Save app data notice:', err);
            if (err && err.message && (err.message.includes('Quota exceeded') || err.message.includes('resource-exhausted'))) {
              setSyncError('Cota diária do Firebase atingida. Seus dados estão salvos no aparelho!');
            } else {
              setSyncError(err instanceof Error ? err.message : String(err));
            }
          });
      }

      checkAndTriggerDeviceNotifications(data, (alertData) => {
        setLiveToast(alertData);
      });
    } catch (e) {
      console.error('Error saving data:', e);
    }
  }, [data]);

  // Real-time 5-second interval check for exact hour/minute notifications
  useEffect(() => {
    checkAndTriggerDeviceNotifications(data, (alertData) => {
      setLiveToast(alertData);
    });

    const interval = setInterval(() => {
      checkAndTriggerDeviceNotifications(data, (alertData) => {
        setLiveToast(alertData);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [data]);

  // Client handlers
  const handleOpenNewClient = () => {
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const handleOpenEditClient = (client: Client) => {
    setClientToEdit(client);
    setIsClientModalOpen(true);
  };

  const handleOpenRenewClient = (client: Client) => {
    setRenewalClient(client);
    setIsRenewalModalOpen(true);
  };

  const handleConfirmRenewal = ({
    client,
    months,
    customAmount,
    recordPaidCharge,
    sendWhatsApp,
    customDateStr,
    customWhatsAppMessage,
  }: {
    client: Client;
    months: number;
    customAmount: number;
    recordPaidCharge: boolean;
    sendWhatsApp: boolean;
    customDateStr?: string;
    customWhatsAppMessage?: string;
  }) => {
    let newDueDateStr = customDateStr || calculateRenewalDueDate(client.dueDate, months);

    const [datePart, timePart] = newDueDateStr.includes('T') ? newDueDateStr.split('T') : [newDueDateStr, ''];

    setData((prev) => {
      // 1. Update client's main due date
      const updatedClients = prev.clients.map((c) =>
        c.id === client.id ? { ...c, dueDate: newDueDateStr } : c
      );

      // 2. Insert new paid charge record if requested
      let updatedCharges = prev.charges;
      if (recordPaidCharge) {
        const newPaidCharge: Charge = {
          id: generateUUID(),
          clientId: client.id,
          amount: customAmount || 0,
          dueDate: datePart,
          dueTime: timePart || undefined,
          note: `Renovação (${months} ${months === 1 ? 'mês' : 'meses'})`,
          paid: true,
          paidAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        // Also mark existing unpaid charges for this client as paid/resolved
        updatedCharges = prev.charges.map((ch) =>
          ch.clientId === client.id && !ch.paid
            ? { ...ch, paid: true, paidAt: new Date().toISOString() }
            : ch
        );
        updatedCharges = [newPaidCharge, ...updatedCharges];
      }

      return {
        ...prev,
        clients: updatedClients,
        charges: updatedCharges,
      };
    });

    setIsRenewalModalOpen(false);

    // 3. Open WhatsApp if selected
    if (sendWhatsApp) {
      const phone = normalizePhone(client.phone);
      if (phone) {
        const formattedDate = formatDateTimeBR(newDueDateStr);
        const valText = customAmount > 0 ? `\n💰 *Valor:* R$ ${customAmount.toFixed(2).replace('.', ',')}` : '';
        const defaultMsg = `Olá, *${client.name}*! Sua renovação de acesso foi realizada com sucesso!\n\n📅 *Novo Vencimento:* ${formattedDate}${valText}\n\nAgradecemos a preferência!`;
        const messageToSend = customWhatsAppMessage && customWhatsAppMessage.trim() ? customWhatsAppMessage : defaultMsg;
        openWhatsAppLink(client.phone, messageToSend, data.settings);
      }
    }
  };

  const handleSaveRenewalTemplate = (templateText: string) => {
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        renewalMessageTemplate: templateText,
      },
    }));
  };

  const handleSaveClient = (clientData: Omit<Client, 'id' | 'createdAt'>, editId?: string) => {
    const trimmedName = clientData.name.trim();
    const duplicate = isDuplicateClientName(trimmedName, data.clients, editId);
    if (duplicate) {
      alert(`⚠️ Não foi possível salvar: já existe um cliente cadastrado com o nome "${duplicate.name}". Não são permitidos nomes duplicados.`);
      return;
    }

    setData((prev) => {
      let updatedClients = [...prev.clients];
      let updatedCharges = [...prev.charges];
      const targetClientId = editId || generateUUID();

      if (editId) {
        updatedClients = updatedClients.map((c) => (c.id === editId ? { ...c, ...clientData, name: trimmedName } : c));
      } else {
        const newClient: Client = {
          id: targetClientId,
          ...clientData,
          name: trimmedName,
          createdAt: new Date().toISOString(),
        };
        updatedClients = [newClient, ...updatedClients];
      }

      // If clientData has a dueDate set, ensure an active charge exists or update the existing charge
      if (targetClientId) {
        if (clientData.dueDate) {
          const fullDt = clientData.dueDate;
          const [datePart, timePart] = fullDt.includes('T') ? fullDt.split('T') : [fullDt, ''];

          // Find existing unpaid charge for this client
          const existingChargeIndex = updatedCharges.findIndex(
            (ch) => ch.clientId === targetClientId && !ch.paid
          );

          if (existingChargeIndex >= 0) {
            updatedCharges[existingChargeIndex] = {
              ...updatedCharges[existingChargeIndex],
              dueDate: datePart,
              dueTime: timePart || undefined,
            };
          } else {
            const newCharge: Charge = {
              id: generateUUID(),
              clientId: targetClientId,
              amount: 0,
              dueDate: datePart,
              dueTime: timePart || undefined,
              paid: false,
              note: 'Vencimento do Cliente',
              createdAt: new Date().toISOString(),
            };
            updatedCharges = [newCharge, ...updatedCharges];
          }
        } else {
          // If due date was removed/cleared, remove the unpaid automatic charge
          updatedCharges = updatedCharges.filter(
            (ch) => !(ch.clientId === targetClientId && !ch.paid && ch.note === 'Vencimento do Cliente')
          );
        }
      }

      return {
        ...prev,
        clients: updatedClients,
        charges: updatedCharges,
      };
    });
  };

  const handleUpdateClientPhone = (clientId: string, newPhone: string) => {
    setData((prev) => ({
      ...prev,
      clients: prev.clients.map((c) =>
        c.id === clientId ? { ...c, phone: newPhone } : c
      ),
    }));
  };

  const handleSaveBatch = (clientsData: Omit<Client, 'id' | 'createdAt'>[]) => {
    setData((prev) => {
      let updatedClients = [...prev.clients];
      let updatedCharges = [...prev.charges];
      const existingNames = new Set(prev.clients.map((c) => c.name.trim().toLowerCase()));

      for (const clientData of clientsData) {
        const trimmedName = clientData.name.trim();
        const lowerName = trimmedName.toLowerCase();
        if (existingNames.has(lowerName)) {
          continue;
        }
        existingNames.add(lowerName);

        const targetClientId = generateUUID();
        const newClient: Client = {
          id: targetClientId,
          ...clientData,
          name: trimmedName,
          createdAt: new Date().toISOString(),
        };
        updatedClients = [newClient, ...updatedClients];

        if (clientData.dueDate) {
          const fullDt = clientData.dueDate;
          const [datePart, timePart] = fullDt.includes('T') ? fullDt.split('T') : [fullDt, ''];
          const newCharge: Charge = {
            id: generateUUID(),
            clientId: targetClientId,
            amount: 0,
            dueDate: datePart,
            dueTime: timePart || undefined,
            paid: false,
            note: 'Vencimento do Cliente',
            createdAt: new Date().toISOString(),
          };
          updatedCharges = [newCharge, ...updatedCharges];
        }
      }

      return {
        ...prev,
        clients: updatedClients,
        charges: updatedCharges,
      };
    });
  };

  const handleDeleteClient = (clientId: string) => {
    const client = data.clients.find((c) => c.id === clientId);
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Cliente',
      message: `Deseja realmente excluir o cliente "${client?.name || 'Cliente'}"? Todas as cobranças associadas a ele também serão removidas.`,
      onConfirm: () => {
        // Update state and close modal instantly for instant UI feedback
        setData((prev) => ({
          ...prev,
          clients: prev.clients.filter((c) => c.id !== clientId),
          charges: prev.charges.filter((ch) => ch.clientId !== clientId),
        }));

        if (historyClient?.id === clientId) {
          setHistoryClient(null);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));

        // Delete from Firestore asynchronously in background
        const associatedCharges = data.charges.filter((ch) => ch.clientId === clientId);
        Promise.all([
          deleteClientFromFirestore(clientId).catch(() => {}),
          ...associatedCharges.map((ch) => deleteChargeFromFirestore(ch.id).catch(() => {})),
        ]).catch(() => {});
      },
    });
  };

  const handleDeleteBatch = (clientIds: string[]) => {
    if (!clientIds || clientIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Clientes Selecionados',
      message: `Deseja realmente excluir os ${clientIds.length} clientes selecionados? Todas as cobranças associadas a eles também serão removidas.`,
      onConfirm: () => {
        const idSet = new Set(clientIds);

        // Update state and close modal instantly for instant UI responsiveness
        setData((prev) => ({
          ...prev,
          clients: prev.clients.filter((c) => !idSet.has(c.id)),
          charges: prev.charges.filter((ch) => !idSet.has(ch.clientId)),
        }));

        if (historyClient && idSet.has(historyClient.id)) {
          setHistoryClient(null);
        }
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));

        // Delete from Firestore asynchronously in parallel in background
        const associatedCharges = data.charges.filter((ch) => idSet.has(ch.clientId));
        Promise.all([
          ...Array.from(idSet).map((cid) => deleteClientFromFirestore(cid).catch(() => {})),
          ...associatedCharges.map((ch) => deleteChargeFromFirestore(ch.id).catch(() => {})),
        ]).catch(() => {});
      },
    });
  };

  // Charge handlers
  const handleOpenNewCharge = (defaultClientId?: string) => {
    if (data.clients.length === 0) {
      alert('Você precisa cadastrar pelo menos um cliente antes de criar uma cobrança.');
      setActiveSection('clients');
      return;
    }
    setChargeDefaultClientId(defaultClientId || data.clients[0].id);
    setIsChargeModalOpen(true);
  };

  const handleSaveCharge = (chargeData: Omit<Charge, 'id' | 'createdAt' | 'paid'>) => {
    const newCharge: Charge = {
      id: generateUUID(),
      ...chargeData,
      paid: false,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      charges: [newCharge, ...prev.charges],
    }));
  };

  const handleMarkPaid = (chargeId: string) => {
    setData((prev) => {
      // 1. Handle Virtual Charges
      if (chargeId.startsWith('client-charge-')) {
        const clientId = chargeId.replace('client-charge-', '');
        const client = prev.clients.find((c) => c.id === clientId);
        if (!client || !client.dueDate) return prev;

        // Create a real paid charge record in history
        const [datePart, timePart] = client.dueDate.split('T');
        const newPaidCharge: Charge = {
          id: generateUUID(),
          clientId: client.id,
          amount: 0,
          dueDate: datePart,
          dueTime: timePart || undefined,
          note: 'Mensalidade do Cliente',
          paid: true,
          paidAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        // Advance client's dueDate by exactly 1 month
        const currentDate = new Date(client.dueDate);
        currentDate.setMonth(currentDate.getMonth() + 1);
        const nextDueDateStr = currentDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm

        return {
          ...prev,
          charges: [newPaidCharge, ...prev.charges],
          clients: prev.clients.map((c) =>
            c.id === clientId ? { ...c, dueDate: nextDueDateStr } : c
          ),
        };
      }

      // 2. Handle Real Charges
      const targetCharge = prev.charges.find((ch) => ch.id === chargeId);
      if (!targetCharge) return prev;

      let updatedClients = prev.clients;
      const client = prev.clients.find((c) => c.id === targetCharge.clientId);
      
      // If this real charge was matching the client's profile dueDate, advance the client's profile dueDate too!
      if (client && client.dueDate) {
        const [clientDatePart] = client.dueDate.split('T');
        if (targetCharge.dueDate === clientDatePart) {
          const currentDate = new Date(client.dueDate);
          currentDate.setMonth(currentDate.getMonth() + 1);
          const nextDueDateStr = currentDate.toISOString().slice(0, 16);

          updatedClients = prev.clients.map((c) =>
            c.id === client.id ? { ...c, dueDate: nextDueDateStr } : c
          );
        }
      }

      return {
        ...prev,
        clients: updatedClients,
        charges: prev.charges.map((ch) =>
          ch.id === chargeId ? { ...ch, paid: true, paidAt: new Date().toISOString() } : ch
        ),
      };
    });
  };

  const handleUndoPaid = (chargeId: string) => {
    setData((prev) => {
      const targetCharge = prev.charges.find((ch) => ch.id === chargeId);
      if (!targetCharge) return prev;

      let updatedClients = prev.clients;
      const client = prev.clients.find((c) => c.id === targetCharge.clientId);
      
      // Symmetrically roll back the client's profile dueDate by exactly 1 month if we are undoing their payment
      if (client && client.dueDate) {
        const currentDate = new Date(client.dueDate);
        currentDate.setMonth(currentDate.getMonth() - 1);
        const prevDueDateStr = currentDate.toISOString().slice(0, 16);

        const nextMonthOfCharge = new Date(targetCharge.dueDate + 'T12:00:00');
        nextMonthOfCharge.setMonth(nextMonthOfCharge.getMonth() + 1);
        const [nextMonthOfChargeDatePart] = nextMonthOfCharge.toISOString().split('T');
        const [clientDatePart] = client.dueDate.split('T');

        if (clientDatePart === nextMonthOfChargeDatePart) {
          updatedClients = prev.clients.map((c) =>
            c.id === client.id ? { ...c, dueDate: prevDueDateStr } : c
          );
        }
      }

      return {
        ...prev,
        clients: updatedClients,
        charges: prev.charges.map((ch) => {
          if (ch.id === chargeId) {
            const { paidAt, ...rest } = ch;
            return { ...rest, paid: false };
          }
          return ch;
        }),
      };
    });
  };

  const handleDeleteCharge = (chargeId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Cobrança',
      message: 'Deseja excluir esta cobrança permanentemente?',
      onConfirm: () => {
        setData((prev) => ({
          ...prev,
          charges: prev.charges.filter((ch) => ch.id !== chargeId),
        }));
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
    });
  };

  const handleSaveSettings = (newSettings: CompanySettings) => {
    setData((prev) => ({
      ...prev,
      settings: newSettings,
    }));
  };

  const handleSendWhatsApp = (client: Client, charge?: Charge) => {
    if (charge) {
      openWhatsApp(client, charge, data.settings);
    } else {
      openDirectWhatsApp(client, data.settings);
    }

    const nowIso = new Date().toISOString();
    const newLog: SentMessageLog = {
      id: generateUUID(),
      clientId: client.id,
      clientName: client.name,
      phone: client.phone,
      chargeId: charge?.id,
      dueDate: charge?.dueDate || client.dueDate,
      sentAt: nowIso,
      messageText: charge ? getDefaultMessage(client, charge, data.settings) : 'Lembrete de vencimento enviado',
      note: charge?.note,
      status: 'enviado',
    };

    setData((prev) => {
      const updatedCharges = charge
        ? prev.charges.map((ch) =>
            ch.id === charge.id ? { ...ch, messageSent: true, messageSentAt: nowIso } : ch
          )
        : prev.charges;

      return {
        ...prev,
        charges: updatedCharges,
        sentLogs: [newLog, ...(prev.sentLogs || [])],
      };
    });
  };

  const handleDeleteSentLog = (logId: string) => {
    setData((prev) => ({
      ...prev,
      sentLogs: (prev.sentLogs || []).filter((l) => l.id !== logId),
    }));
  };

  const handleToggleMessageSent = (chargeId: string) => {
    setData((prev) => ({
      ...prev,
      charges: prev.charges.map((ch) => {
        if (ch.id === chargeId) {
          const isSent = !ch.messageSent;
          return {
            ...ch,
            messageSent: isSent,
            messageSentAt: isSent ? new Date().toISOString() : undefined,
          };
        }
        return ch;
      }),
    }));
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs">
            M
          </div>
          <span className="font-bold text-sm tracking-tight text-white">MrGestor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 active:scale-95 transition-all disabled:opacity-50 shadow-2xs"
            title="Sincronizar dados com a nuvem agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="text-[11px] font-bold text-emerald-400">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </header>

      {/* Sidebar / Nav */}
      <Sidebar 
        activeSection={activeSection} 
        onSelectSection={setActiveSection} 
        onSync={handleManualSync}
        isSyncing={isSyncing}
        syncError={syncError}
      />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-3.5 sm:p-8 max-w-7xl w-full mx-auto pb-24 md:pb-12">
        {activeSection === 'dashboard' && (
          <DashboardView
            data={data}
            onNavigate={handleNavigate}
            onOpenNewClient={handleOpenNewClient}
            onMarkPaid={handleMarkPaid}
            onSendWhatsApp={handleSendWhatsApp}
            onOpenRenewClient={handleOpenRenewClient}
          />
        )}

        {activeSection === 'clients' && (
          <ClientsView
            clients={data.clients}
            onOpenNewClient={handleOpenNewClient}
            onOpenEditClient={handleOpenEditClient}
            onUpdatePhone={handleUpdateClientPhone}
            onDeleteClient={handleDeleteClient}
            onDeleteBatch={handleDeleteBatch}
            onOpenHistory={setHistoryClient}
            onSendWhatsApp={(client) => handleSendWhatsApp(client)}
            onOpenRenewClient={handleOpenRenewClient}
          />
        )}

        {activeSection === 'charges' && (
          <ChargesView
            clients={data.clients}
            charges={data.charges}
            settings={data.settings}
            sentLogs={data.sentLogs}
            onMarkPaid={handleMarkPaid}
            onUndoPaid={handleUndoPaid}
            onDeleteCharge={handleDeleteCharge}
            onSendWhatsApp={handleSendWhatsApp}
            onDeleteSentLog={handleDeleteSentLog}
            onToggleMessageSent={handleToggleMessageSent}
          />
        )}

        {activeSection === 'due' && (
          <DueView
            clients={data.clients}
            charges={data.charges}
            settings={data.settings}
            initialFilter={dueTabFilter}
            onMarkPaid={handleMarkPaid}
            onSendWhatsApp={handleSendWhatsApp}
            onOpenRenewClient={handleOpenRenewClient}
          />
        )}

        {activeSection === 'profile' && (
          <ProfileView
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeSection === 'notices' && (
          <NoticesConfigView
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
          />
        )}

        {activeSection === 'settings' && (
          <SettingsView
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
            clients={data.clients}
            charges={data.charges}
            onSync={handleManualSync}
            isSyncing={isSyncing}
            syncError={syncError}
            onImportData={(newData) => {
              setData((prev) => ({
                ...prev,
                settings: newData.settings || prev.settings,
                clients: newData.clients || prev.clients,
                charges: newData.charges || prev.charges,
              }));
            }}
          />
        )}
      </main>

      {/* Modals */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        onSaveBatch={handleSaveBatch}
        clientToEdit={clientToEdit}
        clients={data.clients}
      />

      <ChargeModal
        isOpen={isChargeModalOpen}
        onClose={() => setIsChargeModalOpen(false)}
        onSave={handleSaveCharge}
        clients={data.clients}
        defaultClientId={chargeDefaultClientId}
      />

      <ClientHistoryModal
        isOpen={!!historyClient}
        onClose={() => setHistoryClient(null)}
        client={historyClient}
        charges={data.charges}
        settings={data.settings}
        onMarkPaid={handleMarkPaid}
        onUndoPaid={handleUndoPaid}
        onSendWhatsApp={handleSendWhatsApp}
        onOpenRenewClient={handleOpenRenewClient}
        onNewChargeForClient={(clientId) => {
          setHistoryClient(null);
          handleOpenNewCharge(clientId);
        }}
      />

      <RenewalModal
        isOpen={isRenewalModalOpen}
        client={renewalClient}
        settings={data.settings}
        onClose={() => setIsRenewalModalOpen(false)}
        onConfirmRenewal={handleConfirmRenewal}
        onSaveRenewalTemplate={handleSaveRenewalTemplate}
      />

      {/* Real-time In-App Live Alert Toast */}
      {liveToast && (
        <div className="fixed inset-x-3 top-3 sm:top-5 sm:right-5 sm:left-auto sm:max-w-md sm:w-full z-50 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-3.5 sm:p-4 border border-slate-700 space-y-3 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-start gap-2.5 sm:gap-3 shrink-0">
              <div className="p-2 sm:p-2.5 bg-rose-600 rounded-xl shrink-0 mt-0.5 animate-pulse">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-white tracking-tight line-clamp-2">{liveToast.title}</h4>
                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 font-mono leading-snug line-clamp-2">{liveToast.body}</p>
              </div>
              <button
                onClick={() => setLiveToast(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {liveToast.clientMessage && (
              <div className="p-2.5 sm:p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-1 flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <MessageCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                    Mensagem para o cliente:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(liveToast.clientMessage!);
                      alert('Mensagem copiada para a área de transferência!');
                    }}
                    className="text-[10px] text-blue-400 hover:underline cursor-pointer font-semibold"
                  >
                    Copiar
                  </button>
                </div>
                <div className="overflow-y-auto max-h-36 sm:max-h-52 pr-1 text-xs text-slate-200 font-sans italic leading-relaxed whitespace-pre-wrap">
                  "{liveToast.clientMessage}"
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 shrink-0">
              {liveToast.client ? (
                <button
                  type="button"
                  onClick={() => {
                    handleSendWhatsApp(liveToast.client!, liveToast.charge);
                    setLiveToast(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Enviar WhatsApp ao Cliente
                </button>
              ) : liveToast.phone ? (
                <button
                  type="button"
                  onClick={() => {
                    const num = normalizePhone(liveToast.phone!);
                    if (num) {
                      const msg = liveToast.clientMessage ? encodeURIComponent(liveToast.clientMessage) : '';
                      window.open(`https://wa.me/55${num}?text=${msg}`, '_blank');
                    }
                    setLiveToast(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Abrir WhatsApp
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setLiveToast(null)}
                className="px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{confirmModal.title}</h3>
              </div>
            </div>
            <p className="text-slate-600 text-xs font-mono leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
