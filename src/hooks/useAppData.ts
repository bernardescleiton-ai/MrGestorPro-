import { useRef, useState } from 'react';
import type { AppData, Client, Charge, SectionType } from '../types';
import { initialAppData } from '../data/initialData';
import { sanitizeAppData, saveAppData, fetchAppData } from '../lib/api';
import type { ClientFilterType } from '../components/ClientsView';
import type { DueTabFilter } from '../components/DueView';
import type { RenewalToastData } from '../components/RenewalSuccessToast';

import { logger } from '../lib/logger';
const STORAGE_KEY = 'gc_v1_data';

export type LiveToast = {
  title: string;
  body: string;
  phone?: string;
  clientMessage?: string;
  client?: Client;
  charge?: Charge;
};

export type ConfirmModal = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
};

const generateUUID = () => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'f' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const useAppData = () => {
  const [data, setRawData] = useState<AppData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return sanitizeAppData(JSON.parse(saved));
    } catch (e) {
      logger.error('Error loading localStorage:', e);
    }
    return sanitizeAppData({ ...initialAppData, updatedAt: 1 });
  });

  const isRemoteUpdate = useRef(false);
  const hasFetchedCloud = useRef(false);
  const lastSavedDataJsonRef = useRef('');
  const dataRef = useRef<AppData>(data);
  dataRef.current = data;

  const setData = (update: AppData | ((prev: AppData) => AppData)) => {
    setRawData((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      return sanitizeAppData({ ...next, updatedAt: Date.now() });
    });
  };

  const [activeSection, setActiveSection] = useState<SectionType>('dashboard');
  const [dueTabFilter, setDueTabFilter] = useState<DueTabFilter>('today');
  const [clientStatusFilter, setClientStatusFilter] = useState<ClientFilterType>('all');
  const [liveToast, setLiveToast] = useState<LiveToast | null>(null);
  const [renewalToast, setRenewalToast] = useState<RenewalToastData | null>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [chargeDefaultClientId, setChargeDefaultClientId] = useState<string | undefined>();
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [renewalClient, setRenewalClient] = useState<Client | null>(null);
  const [isRenewalModalOpen, setIsRenewalModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [syncTrigger, setSyncTrigger] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleNavigate = (section: SectionType, tab?: DueTabFilter, clientFilter?: ClientFilterType) => {
    if (tab) setDueTabFilter(tab);
    else if (section === 'due') setDueTabFilter('today');
    if (clientFilter) setClientStatusFilter(clientFilter);
    else if (section === 'clients') setClientStatusFilter('all');
    setActiveSection(section);
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      await saveAppData(dataRef.current, 0);
      const result = await fetchAppData();
      if (result.exists && result.data) {
        setRawData(result.data);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data)); } catch {}
      }
      setSyncTrigger((prev) => prev + 1);
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (err) {
      logger.warn('Manual sync notice:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    data, setData, setRawData, dataRef, isRemoteUpdate, hasFetchedCloud, lastSavedDataJsonRef,
    activeSection, setActiveSection, dueTabFilter, setDueTabFilter, clientStatusFilter, setClientStatusFilter,
    liveToast, setLiveToast, renewalToast, setRenewalToast, isClientModalOpen, setIsClientModalOpen,
    clientToEdit, setClientToEdit, isChargeModalOpen, setIsChargeModalOpen, chargeDefaultClientId,
    setChargeDefaultClientId, historyClient, setHistoryClient, renewalClient, setRenewalClient,
    isRenewalModalOpen, setIsRenewalModalOpen, confirmModal, setConfirmModal, syncTrigger, setSyncTrigger,
    isSyncing, setIsSyncing, syncError, setSyncError, handleNavigate, handleManualSync, generateUUID,
  };
};
