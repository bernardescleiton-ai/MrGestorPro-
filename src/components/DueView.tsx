import React, { useState, useEffect, useMemo } from 'react';
import { Bell, RefreshCw, Calendar, Clock, AlertTriangle, AlertCircle, Search, CheckCircle2, MessageSquare, Phone, Trash2, CheckSquare, Square, Edit, ChevronLeft, ChevronRight, Copy, Download, Check } from 'lucide-react';
import { Client, Charge, CompanySettings, SentMessageLog } from '../types';
import { dateBR, formatDateTimeBR, getChargeStatus, getDaysUntilDue, getClientStatusBadge, openWhatsApp, formatPhoneNumber, deduplicateClients, formatClientForCopy, formatClientsListForCopy, deduplicatePaidCharges } from '../utils/formatters';
import { buildClientLookupContext, resolveClientForCharge } from '../utils/clientResolver';
import { ExportClientsModal } from './ExportClientsModal';

export type DueTabFilter = 'today' | 'in_1_day' | 'in_3_days' | 'late_1_day' | 'overdue_5_days' | 'all_late' | 'completed' | 'all';

interface DueViewProps {
  clients: Client[];
  charges: Charge[];
  settings: CompanySettings;
  sentLogs?: SentMessageLog[];
  initialFilter?: DueTabFilter;
  onMarkPaid: (chargeId: string) => void;
  onUndoPaid?: (chargeId: string) => void;
  onSendWhatsApp?: (client: Client, charge?: Charge) => void;
  onOpenRenewClient?: (client: Client) => void;
  onOpenEditClient?: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onDeleteClientsBatch?: (clientIds: string[]) => void;
}

export const DueView: React.FC<DueViewProps> = ({
  clients,
  charges,
  settings,
  sentLogs,
  initialFilter = 'today',
  onMarkPaid,
  onUndoPaid,
  onSendWhatsApp,
  onOpenRenewClient,
  onOpenEditClient,
  onDeleteClient,
  onDeleteClientsBatch,
}) => {
  const [activeTab, setActiveTab] = useState<DueTabFilter>(initialFilter);
  const [search, setSearch] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportClientsList, setExportClientsList] = useState<Client[]>([]);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedSingleId, setCopiedSingleId] = useState<string | null>(null);
  const [localToast, setLocalToast] = useState<{ title: string; message: string } | null>(null);

  // Update active tab if initialFilter prop changes
  useEffect(() => {
    if (initialFilter) {
      setActiveTab(initialFilter);
      setSelectedClientIds([]);
    }
  }, [initialFilter]);

  const handleTabChange = (tab: DueTabFilter) => {
    setActiveTab(tab);
    setSelectedClientIds([]);
  };

  const safeClients = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const safeCharges = useMemo(() => (Array.isArray(charges) ? charges : []), [charges]);

  const showLocalToast = (title: string, message: string) => {
    setLocalToast({ title, message });
    setTimeout(() => setLocalToast(null), 3000);
  };

  const handleDirectCopy = async (targetClients: Client[]) => {
    if (!targetClients || targetClients.length === 0) return;
    const text = formatClientsListForCopy(targetClients);
    const uniqueCount = deduplicateClients(targetClients).length;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedBatch(true);
      showLocalToast('Copiado com Sucesso!', `${uniqueCount} cliente(s) copiado(s) para a área de transferência.`);
      setTimeout(() => setCopiedBatch(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar dados:', err);
    }
  };

  const handleCopySingle = async (client: Client) => {
    const text = formatClientForCopy(client);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSingleId(client.id);
      showLocalToast('Copiado!', `Dados de "${client.name}" copiados com sucesso.`);
      setTimeout(() => setCopiedSingleId(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  const clientLookup = useMemo(() => {
    return buildClientLookupContext(safeClients, sentLogs);
  }, [safeClients, sentLogs]);

  const clientMap = clientLookup.idMap;

  const getClient = (clientId: string) => clientLookup.idMap.get(clientId);

  // Gather all pending charges
  const chargeClientIds = useMemo(() => {
    return new Set(safeCharges.filter((c) => !c.paid).map((c) => c.clientId));
  }, [safeCharges]);

  // Also build virtual charges for clients with dueDate who don't have an unpaid charge
  const clientCharges: Charge[] = useMemo(() => {
    return safeClients
      .filter((cl) => cl.dueDate && !chargeClientIds.has(cl.id))
      .map((cl) => {
        const fullDt = cl.dueDate!;
        const [datePart, timePart] = fullDt.includes('T') ? fullDt.split('T') : [fullDt, ''];
        return {
          id: `client-charge-${cl.id}`,
          clientId: cl.id,
          amount: 0,
          dueDate: datePart,
          dueTime: timePart || undefined,
          paid: false,
          note: 'Vencimento do Cliente',
          createdAt: cl.createdAt,
        };
      });
  }, [safeClients, chargeClientIds]);

  const allPendingItems = useMemo(() => {
    return [...safeCharges.filter((c) => !c.paid), ...clientCharges];
  }, [safeCharges, clientCharges]);

  const [duePage, setDuePage] = useState<number>(1);
  const [duePageSize, setDuePageSize] = useState<number | 'all'>(30);

  // Helper to compute day difference for a charge/client using fast O(1) map
  const getItemDaysDiff = (ch: Charge): number | null => {
    const client = resolveClientForCharge(ch, clientLookup, safeClients, sentLogs);
    const dateToEvaluate = ch.dueDate || client?.dueDate?.split('T')[0];
    return getDaysUntilDue(dateToEvaluate);
  };

  // Pre-calculate all counts in a single O(N) pass
  const counts = useMemo(() => {
    let today = 0;
    let in1Day = 0;
    let in3Days = 0;
    let late1Day = 0;
    let overdue5Days = 0;
    let allLate = 0;

    for (let i = 0; i < allPendingItems.length; i++) {
      const ch = allPendingItems[i];
      const diff = getItemDaysDiff(ch);
      if (diff === 0) today++;
      if (diff === 1) in1Day++;
      if (diff !== null && diff >= 1 && diff <= 3) in3Days++;
      if (diff === -1) late1Day++;
      if (diff !== null && diff <= -5) overdue5Days++;
      if (diff !== null && diff < 0) allLate++;
    }

    const completed = deduplicatePaidCharges(safeCharges.filter((c) => c.paid), clientLookup, safeClients, sentLogs).length;

    return { today, in1Day, in3Days, late1Day, overdue5Days, allLate, completed };
  }, [allPendingItems, safeCharges, clientLookup, safeClients, sentLogs]);

  const {
    today: todayCount,
    in1Day: in1DayCount,
    in3Days: in3DaysCount,
    late1Day: late1DayCount,
    overdue5Days: overdue5DaysCount,
    allLate: allLateCount,
    completed: completedCount,
  } = counts;
  const totalAllCount = allPendingItems.length;

  // Filter items based on active tab
  const tabFilteredItems = useMemo(() => {
    if (activeTab === 'completed') {
      return deduplicatePaidCharges(safeCharges.filter((c) => c.paid), clientLookup, safeClients, sentLogs);
    }
    return allPendingItems.filter((ch) => {
      const diff = getItemDaysDiff(ch);
      if (activeTab === 'today') return diff === 0;
      if (activeTab === 'in_1_day') return diff === 1;
      if (activeTab === 'in_3_days') return diff !== null && diff >= 1 && diff <= 3;
      if (activeTab === 'late_1_day') return diff === -1;
      if (activeTab === 'overdue_5_days') return diff !== null && diff <= -5;
      if (activeTab === 'all_late') return diff !== null && diff < 0;
      return true; // 'all'
    });
  }, [allPendingItems, safeCharges, activeTab, clientLookup, safeClients, sentLogs]);

  // Apply search query filter
  const displayedItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tabFilteredItems
      .filter((ch) => {
        if (!term) return true;
        const client = resolveClientForCharge(ch, clientLookup, safeClients, sentLogs);
        const nameMatch = client?.name?.toLowerCase().includes(term);
        const phoneMatch = client?.phone?.includes(term);
        const noteMatch = ch.note?.toLowerCase().includes(term);
        return nameMatch || phoneMatch || noteMatch;
      })
      .sort((a, b) => {
        if (activeTab === 'completed') {
          const dtA = (a.dueDate || '') + (a.dueTime ? `T${a.dueTime}` : '');
          const dtB = (b.dueDate || '') + (b.dueTime ? `T${b.dueTime}` : '');
          if (dtB !== dtA) return dtB.localeCompare(dtA);
          const paidA = a.paidAt || a.createdAt || '';
          const paidB = b.paidAt || b.createdAt || '';
          return paidB.localeCompare(paidA);
        }
        const dtA = (a.dueDate || '') + (a.dueTime ? `T${a.dueTime}` : '');
        const dtB = (b.dueDate || '') + (b.dueTime ? `T${b.dueTime}` : '');
        return dtA.localeCompare(dtB);
      });
  }, [tabFilteredItems, search, activeTab, clientLookup, safeClients, sentLogs]);

  // Reset page on search or tab change
  useEffect(() => {
    setDuePage(1);
  }, [activeTab, search, duePageSize]);

  // Paginated items
  const totalDuePages = duePageSize === 'all' ? 1 : Math.max(1, Math.ceil(displayedItems.length / duePageSize));
  const currentDuePage = Math.min(duePage, totalDuePages);

  const paginatedDisplayedItems = useMemo(() => {
    if (duePageSize === 'all') return displayedItems;
    const startIndex = (currentDuePage - 1) * duePageSize;
    return displayedItems.slice(startIndex, startIndex + duePageSize);
  }, [displayedItems, currentDuePage, duePageSize]);

  // Unique clients available in the current displayed items
  const displayedClientIds = useMemo(() => {
    const ids = new Set<string>();
    displayedItems.forEach((item) => {
      if (item.clientId && clientMap.has(item.clientId)) {
        ids.add(item.clientId);
      }
    });
    return Array.from(ids);
  }, [displayedItems, clientMap]);

  // Filter valid selected client ids
  const activeSelectedClientIds = useMemo(() => {
    const validSet = new Set(safeClients.map((c) => c.id));
    return selectedClientIds.filter((id) => validSet.has(id));
  }, [selectedClientIds, safeClients]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedClientIds(displayedClientIds);
    } else {
      setSelectedClientIds([]);
    }
  };

  const toggleSelectClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  // Tab descriptions
  const getTabInfo = () => {
    switch (activeTab) {
      case 'today':
        return {
          title: 'Vencem Hoje',
          desc: 'Clientes cujo prazo de renovação expira exatamente hoje.',
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          count: todayCount,
        };
      case 'in_1_day':
        return {
          title: '1 Dia Antes de Vencer',
          desc: 'Clientes que vencem amanhã (exatamente 1 dia de antecedência) para aviso prévio e lembretes.',
          badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          count: in1DayCount,
        };
      case 'in_3_days':
        return {
          title: 'Faltando 3 Dias',
          desc: 'Clientes com vencimento próximo (nos próximos 1 a 3 dias) para envio antecipado de lembretes.',
          badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
          count: in3DaysCount,
        };
      case 'late_1_day':
        return {
          title: 'Vencidos com 1 Dia de Atraso',
          desc: 'Clientes que venceram ontem (1 dia de atraso) para contato prioritário imediato.',
          badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
          count: late1DayCount,
        };
      case 'overdue_5_days':
        return {
          title: 'Vencidos com Mais de 5 Dias',
          desc: 'Clientes com pagamento ou plano vencido há mais de 5 dias. Envio da mensagem exclusiva de cobrança e regularização.',
          badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
          count: overdue5DaysCount,
        };
      case 'all_late':
        return {
          title: 'Todos os Atrasados',
          desc: 'Clientes com pagamento ou plano vencido há 1 ou mais dias.',
          badgeColor: 'bg-red-100 text-red-800 border-red-300',
          count: allLateCount,
        };
      case 'completed':
        return {
          title: 'Concluídos e Pagos',
          desc: 'Histórico de clientes e cobranças já pagas e concluídas no sistema.',
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          count: completedCount,
        };
      case 'all':
      default:
        return {
          title: 'Todos os Vencimentos',
          desc: 'Visão geral de todos os vencimentos e cobranças pendentes.',
          badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
          count: totalAllCount,
        };
    }
  };

  const tabInfo = getTabInfo();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Vencimentos e Prazos</h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            Acesso imediato e separado por período de vencimento dos clientes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const currentClients = displayedClientIds
                .map((id) => clientMap.get(id))
                .filter((c): c is Client => Boolean(c));
              setExportClientsList(deduplicateClients(currentClients));
              setIsExportModalOpen(true);
            }}
            className="bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs sm:text-sm font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            title="Copiar dados ou baixar arquivo com clientes deste filtro"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Copiar / Exportar ({displayedClientIds.length})</span>
          </button>
        </div>
      </div>

      {/* Floating Local Feedback Toast */}
      {localToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-white stroke-[3]" />
          </div>
          <div>
            <div className="font-bold text-xs">{localToast.title}</div>
            <div className="text-[11px] text-slate-300 font-mono">{localToast.message}</div>
          </div>
        </div>
      )}

      {/* Immediate Access Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-2.5">
        {/* Vencem Hoje */}
        <button
          type="button"
          onClick={() => handleTabChange('today')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'today'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'today' ? 'text-amber-100' : 'text-slate-500'}`}>
              Hoje
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'today' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">Hoje</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'today' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {todayCount}
            </span>
          </div>
        </button>

        {/* 1 Dia Antes de Vencer */}
        <button
          type="button"
          onClick={() => handleTabChange('in_1_day')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'in_1_day'
              ? 'bg-cyan-600 text-white border-cyan-700 shadow-md ring-2 ring-cyan-400/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-cyan-300 hover:bg-cyan-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'in_1_day' ? 'text-cyan-100' : 'text-slate-500'}`}>
              Amanhã
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'in_1_day' ? 'bg-cyan-700 text-white' : 'bg-cyan-50 text-cyan-600'}`}>
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">1 Dia Antes</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'in_1_day' ? 'bg-white text-cyan-700' : 'bg-cyan-100 text-cyan-800'
            }`}>
              {in1DayCount}
            </span>
          </div>
        </button>

        {/* Faltando 3 Dias */}
        <button
          type="button"
          onClick={() => handleTabChange('in_3_days')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'in_3_days'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-500/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'in_3_days' ? 'text-blue-100' : 'text-slate-500'}`}>
              1 a 3 Dias
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'in_3_days' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">3 Dias</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'in_3_days' ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-800'
            }`}>
              {in3DaysCount}
            </span>
          </div>
        </button>

        {/* 1 Dia de Atraso */}
        <button
          type="button"
          onClick={() => handleTabChange('late_1_day')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'late_1_day'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'late_1_day' ? 'text-rose-100' : 'text-slate-500'}`}>
              Ontem
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'late_1_day' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">1 Dia Atraso</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'late_1_day' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'
            }`}>
              {late1DayCount}
            </span>
          </div>
        </button>

        {/* +5 Dias Vencidos (Exclusivo) */}
        <button
          type="button"
          onClick={() => handleTabChange('overdue_5_days')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'overdue_5_days'
              ? 'bg-purple-700 text-white border-purple-800 shadow-md ring-2 ring-purple-500/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-purple-300 hover:bg-purple-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'overdue_5_days' ? 'text-purple-200' : 'text-slate-500'}`}>
              &gt; 5 Dias
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'overdue_5_days' ? 'bg-purple-800 text-white' : 'bg-purple-50 text-purple-700'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">+5 Dias</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'overdue_5_days' ? 'bg-white text-purple-800' : 'bg-purple-100 text-purple-800'
            }`}>
              {overdue5DaysCount}
            </span>
          </div>
        </button>

        {/* Todos Atrasados */}
        <button
          type="button"
          onClick={() => handleTabChange('all_late')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'all_late'
              ? 'bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-600/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-red-300 hover:bg-red-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'all_late' ? 'text-red-100' : 'text-slate-500'}`}>
              Crítico
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'all_late' ? 'bg-red-800 text-white' : 'bg-red-50 text-red-600'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">Atrasados</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'all_late' ? 'bg-white text-red-700' : 'bg-red-100 text-red-800'
            }`}>
              {allLateCount}
            </span>
          </div>
        </button>

        {/* Concluídos / Pagos */}
        <button
          type="button"
          onClick={() => handleTabChange('completed')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-400/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-emerald-300 hover:bg-emerald-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'completed' ? 'text-emerald-100' : 'text-slate-500'}`}>
              Pagos
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'completed' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">Concluídos</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'completed' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {completedCount}
            </span>
          </div>
        </button>

        {/* Todos os Vencimentos */}
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-700/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              Geral
            </span>
            <div className={`p-1 rounded-lg ${activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Bell className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs font-bold truncate">Todos</span>
            <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full ${
              activeTab === 'all' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {totalAllCount}
            </span>
          </div>
        </button>
      </div>

      {/* Bulk Action Bar for Selected Clients */}
      {activeSelectedClientIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in fade-in duration-200 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">
              {activeSelectedClientIds.length}
            </span>
            <div>
              <div className="font-bold text-sm text-white">
                {activeSelectedClientIds.length} cliente{activeSelectedClientIds.length > 1 ? 's' : ''} selecionado{activeSelectedClientIds.length > 1 ? 's' : ''}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Copie os dados ou gere um arquivo completo com Nome, Telefone e Vencimento
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const selectedList = activeSelectedClientIds
                  .map((id) => clientMap.get(id))
                  .filter((c): c is Client => Boolean(c));
                handleDirectCopy(selectedList);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                copiedBatch ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title="Copiar dados dos clientes selecionados para a área de transferência"
            >
              {copiedBatch ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedBatch ? 'Copiado!' : `Copiar Dados (${activeSelectedClientIds.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const selectedList = activeSelectedClientIds
                  .map((id) => clientMap.get(id))
                  .filter((c): c is Client => Boolean(c));
                setExportClientsList(selectedList);
                setIsExportModalOpen(true);
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
              title="Abrir opções completas de exportação e download de arquivo (.txt / .csv / .json)"
            >
              <Download className="w-4 h-4 text-blue-400" />
              <span>Gerar / Baixar Arquivo</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (onDeleteClientsBatch) {
                  onDeleteClientsBatch(activeSelectedClientIds);
                  setSelectedClientIds([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ml-auto sm:ml-0"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>

            <button
              type="button"
              onClick={() => setSelectedClientIds([])}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Desmarcar todos
            </button>
          </div>
        </div>
      )}

      {/* Main List Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* List Header & Search */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900">{tabInfo.title}</h2>
              <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${tabInfo.badgeColor}`}>
                {displayedItems.length} {displayedItems.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{tabInfo.desc}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {displayedClientIds.length > 0 && (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white px-3 py-2 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 select-none">
                <input
                  type="checkbox"
                  checked={
                    displayedClientIds.length > 0 &&
                    displayedClientIds.every((id) => selectedClientIds.includes(id))
                  }
                  onChange={handleSelectAll}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Selecionar Todos ({displayedClientIds.length})</span>
              </label>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Client Rows */}
        <div className="p-3.5 sm:p-5">
          {displayedItems.length === 0 ? (
            <div className="py-14 text-center px-4">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Nenhum cliente nesta categoria!</h3>
              <p className="text-slate-500 text-xs font-mono mt-1 max-w-sm mx-auto">
                {search
                  ? 'Nenhum resultado encontrado para a busca especificada.'
                  : `Não há clientes com status de "${tabInfo.title}" no momento.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedDisplayedItems.map((ch) => {
                const client = resolveClientForCharge(ch, clientLookup, safeClients, sentLogs);
                const daysDiff = getItemDaysDiff(ch);
                const statusBadge = getClientStatusBadge(ch.dueDate + (ch.dueTime ? `T${ch.dueTime}` : ''));
                const isPaid = Boolean(ch.paid);
                const isSelected = client ? selectedClientIds.includes(client.id) : false;
                const clientDisplayName =
                  client?.name ||
                  (ch.note && ch.note !== 'Vencimento do Cliente' && ch.note !== 'Mensalidade do Cliente'
                    ? ch.note
                    : 'Cliente');

                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all gap-3 ${
                      isSelected
                        ? 'bg-rose-50/70 border-rose-300 shadow-xs'
                        : isPaid
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                        : daysDiff === 0
                        ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                        : daysDiff !== null && daysDiff < 0
                        ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                        : 'bg-white border-slate-200/90 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      {/* Checkbox for batch action */}
                      {client && (
                        <div className="pt-0.5 sm:pt-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectClient(client.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            title={`Selecionar ${client.name}`}
                          />
                        </div>
                      )}

                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {clientDisplayName}
                          </span>
                          {isPaid ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Pago / Concluído
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                          <span>
                            Vencimento: <strong className="text-slate-800">{dateBR(ch.dueDate || (client?.dueDate ? (client.dueDate.includes('T') ? client.dueDate.split('T')[0] : client.dueDate) : ''))}{ch.dueTime ? ` às ${ch.dueTime}` : (client?.dueDate && client.dueDate.includes('T') ? ` às ${client.dueDate.split('T')[1]}` : '')}</strong>
                          </span>
                          {isPaid && ch.paidAt && (
                            <span className="text-emerald-700 font-medium">
                              • Pago em: {formatDateTimeBR(ch.paidAt)}
                            </span>
                          )}
                          {client?.phone && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {client.phone}
                            </span>
                          )}
                          {ch.note && ch.note !== 'Vencimento do Cliente' && (
                            <span className="text-slate-500 italic">• {ch.note}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 sm:mt-0 self-end sm:self-auto shrink-0 flex-wrap justify-end">
                      {client && onOpenRenewClient && (
                        <button
                          type="button"
                          onClick={() => onOpenRenewClient(client)}
                          className="px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs cursor-pointer"
                          title="Renovar período deste cliente"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Renovar
                        </button>
                      )}

                      {client && (
                        <button
                          type="button"
                          onClick={() => handleCopySingle(client)}
                          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors active:scale-95 flex items-center gap-1 cursor-pointer"
                          title={`Copiar dados do cliente ${client.name} (Nome, Telefone, Vencimento)`}
                        >
                          {copiedSingleId === client.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-600" />
                          )}
                          <span className="hidden sm:inline">
                            {copiedSingleId === client.id ? 'Copiado' : 'Copiar'}
                          </span>
                        </button>
                      )}

                      {client && onOpenEditClient && (
                        <button
                          type="button"
                          onClick={() => onOpenEditClient(client)}
                          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors active:scale-95 flex items-center gap-1 cursor-pointer"
                          title={`Editar cadastro do cliente ${client.name}`}
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-600" />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                      )}

                      {client && (
                        <button
                          type="button"
                          onClick={() => (onSendWhatsApp ? onSendWhatsApp(client, ch) : openWhatsApp(client, ch, settings))}
                          className="px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="Enviar mensagem pelo WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                      )}

                      {isPaid && onUndoPaid && (
                        <button
                          type="button"
                          onClick={() => onUndoPaid(ch.id)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors shadow-2xs active:scale-95 cursor-pointer"
                          title="Desfazer marcação de pago"
                        >
                          Desfazer
                        </button>
                      )}

                      {/* Explicit Delete Client Button */}
                      {client && onDeleteClient && (
                        <button
                          type="button"
                          onClick={() => onDeleteClient(client.id)}
                          className="p-1.5 sm:px-2 sm:py-1.5 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200/80 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                          title={`Excluir cliente ${client.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Due Pagination Footer */}
        {displayedItems.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Mostrando{' '}
                <strong className="text-slate-900 font-semibold">
                  {duePageSize === 'all' ? '1' : (currentDuePage - 1) * duePageSize + 1}
                </strong>{' '}
                a{' '}
                <strong className="text-slate-900 font-semibold">
                  {duePageSize === 'all' ? displayedItems.length : Math.min(currentDuePage * duePageSize, displayedItems.length)}
                </strong>{' '}
                de <strong className="text-slate-900 font-semibold">{displayedItems.length}</strong> registros
              </span>

              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-300 pl-3">
                <span className="text-slate-500">Por página:</span>
                <select
                  value={duePageSize}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDuePageSize(v === 'all' ? 'all' : Number(v));
                  }}
                  className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700 font-medium focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">Todos</option>
                </select>
              </div>
            </div>

            {duePageSize !== 'all' && totalDuePages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDuePage((p) => Math.max(1, p - 1))}
                  disabled={currentDuePage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 px-2">
                  <span className="font-semibold text-slate-800">{currentDuePage}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-600">{totalDuePages}</span>
                </div>
                <button
                  onClick={() => setDuePage((p) => Math.min(totalDuePages, p + 1))}
                  disabled={currentDuePage >= totalDuePages}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Próxima página"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export / Copy Clients Modal */}
      <ExportClientsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedClients={exportClientsList}
        onShowToast={showLocalToast}
      />
    </div>
  );
};


