import React, { useMemo, useState } from 'react';
import {
  Users,
  Calendar,
  AlertTriangle,
  AlertCircle,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  Copy,
  Check,
  Phone,
  Search,
  ExternalLink,
  Edit,
} from 'lucide-react';
import { AppData, SectionType, Client, Charge } from '../types';
import {
  getDaysUntilDue,
  isClientActive,
  getOverdueChargeClientIds,
  dateBR,
  formatDateTimeBR,
  getClientStatusBadge,
  openWhatsApp,
  formatClientForCopy,
  deduplicateClients,
  deduplicatePaidCharges,
} from '../utils/formatters';
import { buildClientLookupContext, resolveClientForCharge } from '../utils/clientResolver';
import { DueTabFilter } from './DueView';

interface DashboardViewProps {
  data: AppData;
  onNavigate: (section: SectionType, dueTab?: DueTabFilter, clientFilter?: 'all' | 'active' | 'overdue') => void;
  onOpenNewClient: () => void;
  onMarkPaid: (chargeId: string) => void;
  onUndoPaid?: (chargeId: string) => void;
  onSendWhatsApp?: (client: Client, charge?: Charge) => void;
  onOpenRenewClient?: (client: Client) => void;
  onOpenEditClient?: (client: Client) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onNavigate,
  onOpenNewClient,
  onMarkPaid,
  onUndoPaid,
  onSendWhatsApp,
  onOpenRenewClient,
  onOpenEditClient,
}) => {
  const clients = useMemo(() => (Array.isArray(data?.clients) ? data.clients : []), [data?.clients]);
  const charges = useMemo(() => (Array.isArray(data?.charges) ? data.charges : []), [data?.charges]);
  const settings = data?.settings;

  const [activeDashboardTab, setActiveDashboardTab] = useState<DueTabFilter>('in_1_day');
  const [tabSearch, setTabSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fast client lookup context & precomputed charges
  const {
    clientLookup,
    clientMap,
    allPendingCharges,
    paidCharges,
    metrics,
  } = useMemo(() => {
    const lookup = buildClientLookupContext(clients, data.sentLogs);
    const map = lookup.idMap;

    const overdueChargeClientIds = getOverdueChargeClientIds(charges);

    // Clientes ativos: verificação O(1)
    let activeClientsCount = 0;
    for (let i = 0; i < clients.length; i++) {
      if (isClientActive(clients[i], charges, overdueChargeClientIds)) {
        activeClientsCount++;
      }
    }

    // Unpaid and paid charges separation
    const chargeClientIds = new Set<string>();
    const pendingList: Charge[] = [];
    const rawPaidList: Charge[] = [];

    for (let i = 0; i < charges.length; i++) {
      const c = charges[i];
      if (c.paid) {
        rawPaidList.push(c);
      } else {
        pendingList.push(c);
        chargeClientIds.add(c.clientId);
      }
    }

    // Deduplicate paid charges per client: keep only the one with the newest date without duplicates
    const paidList = deduplicatePaidCharges(rawPaidList, lookup, clients, data.sentLogs);

    // Virtual charges for clients with dueDate and no unpaid charge
    const virtualCharges: Charge[] = [];
    for (let i = 0; i < clients.length; i++) {
      const cl = clients[i];
      if (cl.dueDate && !chargeClientIds.has(cl.id)) {
        const fullDt = cl.dueDate;
        const [datePart, timePart] = fullDt.includes('T') ? fullDt.split('T') : [fullDt, ''];
        virtualCharges.push({
          id: `client-charge-${cl.id}`,
          clientId: cl.id,
          amount: 0,
          dueDate: datePart,
          dueTime: timePart || undefined,
          paid: false,
          note: 'Vencimento do Cliente',
          createdAt: cl.createdAt,
        });
      }
    }

    const pendingAll = [...pendingList, ...virtualCharges];

    let in1DayCount = 0;
    let dueTodayCount = 0;
    let dueLate1DayCount = 0;
    let overdueCount = 0;
    let overdue5DaysCount = 0;

    for (let i = 0; i < pendingAll.length; i++) {
      const ch = pendingAll[i];
      const cl = resolveClientForCharge(ch, lookup, clients, data.sentLogs);
      const dateToEval = ch.dueDate || (cl?.dueDate ? (cl.dueDate.includes('T') ? cl.dueDate.split('T')[0] : cl.dueDate) : undefined);
      const diff = getDaysUntilDue(dateToEval);

      if (diff === 1) in1DayCount++;
      if (diff === 0) dueTodayCount++;
      if (diff === -1) dueLate1DayCount++;
      if (diff !== null && diff < 0) overdueCount++;
      if (diff !== null && diff <= -5) overdue5DaysCount++;
    }

    const completedCount = paidList.length;

    return {
      clientLookup: lookup,
      clientMap: map,
      allPendingCharges: pendingAll,
      paidCharges: paidList,
      metrics: {
        activeClientsCount,
        in1DayCount,
        dueTodayCount,
        dueLate1DayCount,
        overdueCount,
        overdue5DaysCount,
        completedCount,
        totalPendingCount: pendingAll.length,
      },
    };
  }, [clients, charges, data.sentLogs]);

  const {
    activeClientsCount,
    in1DayCount,
    dueTodayCount,
    dueLate1DayCount,
    overdueCount,
    overdue5DaysCount,
    completedCount,
    totalPendingCount,
  } = metrics;

  // Filtered charges for the embedded tab view
  const currentTabCharges = useMemo(() => {
    let list: Charge[] = [];

    if (activeDashboardTab === 'completed') {
      list = [...paidCharges]
        .filter((ch) => {
          const cl = resolveClientForCharge(ch, clientLookup, clients, data.sentLogs);
          return Boolean(cl && cl.name && cl.name.trim() !== '');
        })
        .sort((a, b) => {
          const dtA = (a.dueDate || '') + (a.dueTime ? `T${a.dueTime}` : '');
          const dtB = (b.dueDate || '') + (b.dueTime ? `T${b.dueTime}` : '');
          if (dtB !== dtA) return dtB.localeCompare(dtA);
          const paidA = a.paidAt || a.createdAt || '';
          const paidB = b.paidAt || b.createdAt || '';
          return paidB.localeCompare(paidA);
        });
    } else {
      list = allPendingCharges.filter((ch) => {
        const cl = resolveClientForCharge(ch, clientLookup, clients, data.sentLogs);
        const dateToEval = ch.dueDate || (cl?.dueDate ? (cl.dueDate.includes('T') ? cl.dueDate.split('T')[0] : cl.dueDate) : undefined);
        const diff = getDaysUntilDue(dateToEval);

        if (activeDashboardTab === 'in_1_day') return diff === 1;
        if (activeDashboardTab === 'today') return diff === 0;
        if (activeDashboardTab === 'in_3_days') return diff !== null && diff >= 1 && diff <= 3;
        if (activeDashboardTab === 'late_1_day') return diff === -1;
        if (activeDashboardTab === 'overdue_5_days') return diff !== null && diff <= -5;
        if (activeDashboardTab === 'all_late') return diff !== null && diff < 0;
        return true; // 'all'
      }).sort((a, b) => {
        const dtA = (a.dueDate || '') + (a.dueTime ? `T${a.dueTime}` : '');
        const dtB = (b.dueDate || '') + (b.dueTime ? `T${b.dueTime}` : '');
        return dtA.localeCompare(dtB);
      });
    }

    if (!tabSearch.trim()) return list;

    const term = tabSearch.toLowerCase().trim();
    return list.filter((ch) => {
      const client = resolveClientForCharge(ch, clientLookup, clients, data.sentLogs);
      const nameMatch = client?.name?.toLowerCase().includes(term);
      const phoneMatch = client?.phone?.includes(term);
      const noteMatch = ch.note?.toLowerCase().includes(term);
      return nameMatch || phoneMatch || noteMatch;
    });
  }, [activeDashboardTab, allPendingCharges, paidCharges, clientLookup, clients, data.sentLogs, tabSearch]);

  const handleCopyClient = async (client: Client) => {
    try {
      const text = formatClientForCopy(client);
      await navigator.clipboard.writeText(text);
      setCopiedId(client.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Futuristic Dashboard Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-5 text-white shadow-lg border border-slate-700/60">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-6 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/icon-192.png"
              alt="MrGestor Logo"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover shadow-[0_0_15px_rgba(59,130,246,0.5)] border border-blue-400/40"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-white font-mono">Mister Gestor</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">Central de Ações, Prazos e Controle em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Monitorando: <strong className="text-white">{activeClientsCount}</strong> clientes</span>
          </div>
        </div>
      </div>

      {/* 3D Tactile Relief Buttons Grid - 2 per row on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-4.5">
        {/* 1. Clientes Ativos */}
        <button
          type="button"
          onClick={() => onNavigate('clients', undefined, 'active')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-blue-50/50 text-left transition-all duration-150 border-t-2 border-t-white border-x border-slate-200/90 border-b-0 shadow-[0_6px_0_0_#cbd5e1,0_10px_20px_-3px_rgba(15,23,42,0.12)] hover:shadow-[0_8px_0_0_#94a3b8,0_14px_24px_-4px_rgba(59,130,246,0.2)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#94a3b8,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-[0_3px_0_0_#1d4ed8,0_4px_8px_rgba(37,99,235,0.3)] transition-transform group-hover:scale-105">
              <Users className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-blue-100/80 text-blue-700 border border-blue-200">
              Ativos
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
              Clientes Ativos
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {activeClientsCount}
              </span>
              <span className="text-[11px] font-bold text-blue-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 2. 1 Dia Antes de Vencer (NOVO) */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('in_1_day');
            onNavigate('due', 'in_1_day');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-cyan-50/30 to-cyan-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-cyan-200/90 border-b-0 shadow-[0_6px_0_0_#a5f3fc,0_10px_20px_-3px_rgba(6,182,212,0.15)] hover:shadow-[0_8px_0_0_#22d3ee,0_14px_24px_-4px_rgba(6,182,212,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#22d3ee,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-teal-400" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-cyan-600 text-white shadow-[0_3px_0_0_#0e7490,0_4px_8px_rgba(6,182,212,0.4)] transition-transform group-hover:scale-105">
              <Clock className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-cyan-200">
              Amanhã
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-cyan-800 uppercase tracking-wider mb-0.5 truncate">
              1 Dia Antes de Vencer
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-cyan-700 tracking-tight">
                {in1DayCount}
              </span>
              <span className="text-[11px] font-bold text-cyan-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 3. Vencem Hoje */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('today');
            onNavigate('due', 'today');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-amber-50/30 to-amber-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-amber-200/90 border-b-0 shadow-[0_6px_0_0_#fcd34d,0_10px_20px_-3px_rgba(217,119,6,0.15)] hover:shadow-[0_8px_0_0_#f59e0b,0_14px_24px_-4px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#f59e0b,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-white shadow-[0_3px_0_0_#b45309,0_4px_8px_rgba(245,158,11,0.4)] transition-transform group-hover:scale-105">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-amber-200/70 text-amber-900 border border-amber-300">
              Hoje
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-0.5 truncate">
              Vencem Hoje
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-amber-600 tracking-tight">
                {dueTodayCount}
              </span>
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 4. 1 Dia de Atraso */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('late_1_day');
            onNavigate('due', 'late_1_day');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-rose-50/30 to-rose-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-rose-200/90 border-b-0 shadow-[0_6px_0_0_#fecdd3,0_10px_20px_-3px_rgba(225,29,72,0.15)] hover:shadow-[0_8px_0_0_#fb7185,0_14px_24px_-4px_rgba(225,29,72,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#fb7185,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-rose-600 text-white shadow-[0_3px_0_0_#be123c,0_4px_8px_rgba(225,29,72,0.35)] transition-transform group-hover:scale-105">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
              Ontem
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider mb-0.5 truncate">
              1 Dia Atraso
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-rose-600 tracking-tight">
                {dueLate1DayCount}
              </span>
              <span className="text-[11px] font-bold text-rose-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 5. +5 Dias Vencidos */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('overdue_5_days');
            onNavigate('due', 'overdue_5_days');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-purple-50/30 to-purple-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-purple-200/90 border-b-0 shadow-[0_6px_0_0_#e9d5ff,0_10px_20px_-3px_rgba(168,85,247,0.15)] hover:shadow-[0_8px_0_0_#c084fc,0_14px_24px_-4px_rgba(168,85,247,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#c084fc,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-indigo-600" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-purple-700 text-white shadow-[0_3px_0_0_#6b21a8,0_4px_8px_rgba(147,51,234,0.35)] transition-transform group-hover:scale-105">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
              &gt; 5 Dias
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider mb-0.5 truncate">
              +5 Dias Vencidos
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-purple-700 tracking-tight">
                {overdue5DaysCount}
              </span>
              <span className="text-[11px] font-bold text-purple-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 6. Total Atrasados */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('all_late');
            onNavigate('due', 'all_late');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-red-50/40 to-red-100/50 text-left transition-all duration-150 border-t-2 border-t-white border-x border-red-200/90 border-b-0 shadow-[0_6px_0_0_#fca5a5,0_10px_20px_-3px_rgba(220,38,38,0.18)] hover:shadow-[0_8px_0_0_#ef4444,0_14px_24px_-4px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#ef4444,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-rose-600" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-red-600 text-white shadow-[0_3px_0_0_#991b1b,0_4px_8px_rgba(220,38,38,0.4)] transition-transform group-hover:scale-105">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-red-200 text-red-900 border border-red-300">
              Crítico
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-red-800 uppercase tracking-wider mb-0.5 truncate">
              Total Atrasados
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-red-600 tracking-tight">
                {overdueCount}
              </span>
              <span className="text-[11px] font-bold text-red-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 7. Concluídos / Pagos (NOVO) */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('completed');
            onNavigate('due', 'completed');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-emerald-50/40 to-emerald-100/50 text-left transition-all duration-150 border-t-2 border-t-white border-x border-emerald-200/90 border-b-0 shadow-[0_6px_0_0_#a7f3d0,0_10px_20px_-3px_rgba(16,185,129,0.18)] hover:shadow-[0_8px_0_0_#34d399,0_14px_24px_-4px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#34d399,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-green-500" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-[0_3px_0_0_#047857,0_4px_8px_rgba(16,185,129,0.4)] transition-transform group-hover:scale-105">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Pagos
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5 truncate">
              Concluídos
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-emerald-700 tracking-tight">
                {completedCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 8. Todos os Vencimentos */}
        <button
          type="button"
          onClick={() => {
            setActiveDashboardTab('all');
            onNavigate('due', 'all');
          }}
          className="group relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-slate-100 text-left transition-all duration-150 border-t-2 border-t-white border-x border-slate-300 border-b-0 shadow-[0_6px_0_0_#cbd5e1,0_10px_20px_-3px_rgba(15,23,42,0.15)] hover:shadow-[0_8px_0_0_#94a3b8,0_14px_24px_-4px_rgba(15,23,42,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#94a3b8,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-600 to-slate-800" />

          <div className="flex items-center justify-between w-full mb-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-white shadow-[0_3px_0_0_#0f172a,0_4px_8px_rgba(15,23,42,0.35)] transition-transform group-hover:scale-105">
              <Layers className="w-4 h-4" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-slate-200 text-slate-800 border border-slate-300">
              Geral
            </span>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-0.5 truncate">
              Todos Vencimentos
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {totalPendingCount}
              </span>
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Embedded Quick View Tabs Section on Dashboard */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Painel de Clientes por Aba</span>
              <span className="text-xs font-mono font-normal text-slate-500">
                ({currentTabCharges.length} registros nesta aba)
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Acesse e gerencie diretamente os clientes separados por cada categoria de vencimento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('due', activeDashboardTab)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Abrir na Tela Completa</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dashboard Filter Tabs */}
        <div className="p-3 sm:p-4 bg-slate-100/70 border-b border-slate-200/80 flex flex-wrap gap-1.5 sm:gap-2">
          {/* Tab: 1 Dia Antes de Vencer */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('in_1_day')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'in_1_day'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-cyan-50 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>1 Dia Antes ({in1DayCount})</span>
          </button>

          {/* Tab: Vencem Hoje */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'today'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-amber-50 border border-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Hoje ({dueTodayCount})</span>
          </button>

          {/* Tab: 1 Dia Atraso */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('late_1_day')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'late_1_day'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-rose-50 border border-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>1 Dia Atraso ({dueLate1DayCount})</span>
          </button>

          {/* Tab: +5 Dias Vencidos */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('overdue_5_days')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'overdue_5_days'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-purple-50 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>+5 Dias ({overdue5DaysCount})</span>
          </button>

          {/* Tab: Total Atrasados */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('all_late')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'all_late'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-red-50 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Total Atrasados ({overdueCount})</span>
          </button>

          {/* Tab: Concluídos (NOVO) */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-emerald-50 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Concluídos ({completedCount})</span>
          </button>

          {/* Tab: Todos */}
          <button
            type="button"
            onClick={() => setActiveDashboardTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeDashboardTab === 'all'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todos ({totalPendingCount})</span>
          </button>
        </div>

        {/* Quick Search within the active tab */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              placeholder="Buscar cliente por nome, telefone ou observação nesta aba..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
            />
          </div>
        </div>

        {/* Client List inside Dashboard Tab */}
        <div className="p-3.5 sm:p-5 max-h-[480px] overflow-y-auto space-y-2.5">
          {currentTabCharges.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">Nenhum cliente nesta aba</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {tabSearch ? 'Nenhum resultado para a busca' : 'Nenhum registro encontrado para esta categoria.'}
              </p>
            </div>
          ) : (
            currentTabCharges.map((ch) => {
              const client = resolveClientForCharge(ch, clientLookup, clients, data.sentLogs);
              const isPaid = Boolean(ch.paid);
              const statusBadge = getClientStatusBadge(ch.dueDate + (ch.dueTime ? `T${ch.dueTime}` : ''));
              const clientDisplayName =
                client?.name ||
                (ch.note && ch.note !== 'Vencimento do Cliente' && ch.note !== 'Mensalidade do Cliente'
                  ? ch.note
                  : 'Cliente');

              return (
                <div
                  key={ch.id}
                  className={`p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isPaid
                      ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                      : activeDashboardTab === 'in_1_day'
                      ? 'bg-cyan-50/40 border-cyan-200 hover:border-cyan-300'
                      : activeDashboardTab === 'today'
                      ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                      : 'bg-white border-slate-200/90 hover:border-blue-200'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">
                        {clientDisplayName}
                      </span>
                      {isPaid ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Concluído / Pago
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono">
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

                  {/* Actions for client row */}
                  <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto shrink-0 flex-wrap justify-end">
                    {client && onOpenRenewClient && (
                      <button
                        type="button"
                        onClick={() => onOpenRenewClient(client)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="Renovar período deste cliente"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Renovar
                      </button>
                    )}

                    {client && (
                      <button
                        type="button"
                        onClick={() => handleCopyClient(client)}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors active:scale-95 flex items-center gap-1 cursor-pointer"
                        title={`Copiar dados de ${client.name}`}
                      >
                        {copiedId === client.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                        )}
                        <span className="hidden sm:inline">
                          {copiedId === client.id ? 'Copiado' : 'Copiar'}
                        </span>
                      </button>
                    )}

                    {client && onOpenEditClient && (
                      <button
                        type="button"
                        onClick={() => onOpenEditClient(client)}
                        className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors active:scale-95 flex items-center gap-1 cursor-pointer"
                        title={`Editar dados de ${client.name}`}
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

                    {isPaid ? (
                      onUndoPaid && (
                        <button
                          type="button"
                          onClick={() => onUndoPaid(ch.id)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shadow-2xs active:scale-95 cursor-pointer"
                          title="Desfazer marcação de pago"
                        >
                          Desfazer
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onMarkPaid(ch.id)}
                        className="bg-slate-800 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                        title="Marcar como concluído/pago"
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
