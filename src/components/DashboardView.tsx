import React from 'react';
import { Users, Calendar, AlertTriangle, Clock, AlertCircle, Layers, ChevronRight, Zap, ShieldCheck } from 'lucide-react';
import { AppData, SectionType, Client, Charge } from '../types';
import { getDaysUntilDue } from '../utils/formatters';
import { DueTabFilter } from './DueView';

interface DashboardViewProps {
  data: AppData;
  onNavigate: (section: SectionType, dueTab?: DueTabFilter) => void;
  onOpenNewClient: () => void;
  onMarkPaid: (chargeId: string) => void;
  onSendWhatsApp?: (client: Client, charge?: Charge) => void;
  onOpenRenewClient?: (client: Client) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onNavigate,
}) => {
  const clients = Array.isArray(data?.clients) ? data.clients : [];
  const charges = Array.isArray(data?.charges) ? data.charges : [];

  // Clientes ativos: somente clientes que ainda não venceram (vencimento hoje ou futuro, e sem pendências vencidas)
  const activeClientsCount = clients.filter((cl) => {
    const diff = getDaysUntilDue(cl.dueDate);
    if (diff !== null && diff < 0) return false;
    const clientPendingCharges = charges.filter((c) => c.clientId === cl.id && !c.paid);
    const hasOverdueCharge = clientPendingCharges.some((c) => {
      const cDiff = getDaysUntilDue(c.dueDate);
      return cDiff !== null && cDiff < 0;
    });
    return !hasOverdueCharge;
  }).length;

  // Gather all pending charges + client due dates
  const chargeClientIds = new Set(charges.filter((c) => !c.paid).map((c) => c.clientId));
  const clientCharges: Charge[] = clients
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

  const allPendingCharges = [...charges.filter((c) => !c.paid), ...clientCharges];

  const getItemDaysDiff = (ch: Charge): number | null => {
    const client = clients.find((c) => c.id === ch.clientId);
    const dateToEvaluate = ch.dueDate || client?.dueDate?.split('T')[0];
    return getDaysUntilDue(dateToEvaluate);
  };

  // Due today count (0 days)
  const dueTodayCount = allPendingCharges.filter((c) => getItemDaysDiff(c) === 0).length;

  // Due in 1 to 3 days (Faltando 3 dias)
  const dueIn3DaysCount = allPendingCharges.filter((c) => {
    const diff = getItemDaysDiff(c);
    return diff !== null && diff >= 1 && diff <= 3;
  }).length;

  // Due with 1 day late (1 dia de atraso)
  const dueLate1DayCount = allPendingCharges.filter((c) => getItemDaysDiff(c) === -1).length;

  // Overdue count (all late)
  const overdueCount = allPendingCharges.filter((c) => {
    const diff = getItemDaysDiff(c);
    return diff !== null && diff < 0;
  }).length;

  const totalPendingCount = allPendingCharges.length;

  return (
    <div className="space-y-5 sm:space-y-6">
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
              <p className="text-xs text-slate-300 font-mono">Central de Ações e Controle em Tempo Real</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Monitorando: <strong className="text-white">{activeClientsCount}</strong> clientes</span>
          </div>
        </div>
      </div>

      {/* 3D Tactile Relief Buttons Grid - strictly 2 in a row on mobile (pairs of 2), 3 in desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-5">
        {/* 1. Clientes Ativos */}
        <button
          type="button"
          onClick={() => onNavigate('clients')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-white via-slate-50 to-blue-50/50 text-left transition-all duration-150 border-t-2 border-t-white border-x border-slate-200/90 border-b-0 shadow-[0_6px_0_0_#cbd5e1,0_10px_20px_-3px_rgba(15,23,42,0.12)] hover:shadow-[0_8px_0_0_#94a3b8,0_14px_24px_-4px_rgba(59,130,246,0.2)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#94a3b8,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Cyber Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-cyan-400" />

          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-600 text-white shadow-[0_3px_0_0_#1d4ed8,0_4px_8px_rgba(37,99,235,0.3)] transition-transform group-hover:scale-105">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-blue-100/80 text-blue-700 border border-blue-200">
              Ativos
            </span>
          </div>

          <div>
            <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5 truncate">
              Clientes Ativos
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                {activeClientsCount}
              </span>
              <span className="text-[11px] font-bold text-blue-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Acessar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 2. Vencem Hoje */}
        <button
          type="button"
          onClick={() => onNavigate('due', 'today')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-white via-amber-50/30 to-amber-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-amber-200/90 border-b-0 shadow-[0_6px_0_0_#fcd34d,0_10px_20px_-3px_rgba(217,119,6,0.15)] hover:shadow-[0_8px_0_0_#f59e0b,0_14px_24px_-4px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#f59e0b,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Cyber Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-yellow-400" />

          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500 text-white shadow-[0_3px_0_0_#b45309,0_4px_8px_rgba(245,158,11,0.4)] transition-transform group-hover:scale-105">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-amber-200/70 text-amber-900 border border-amber-300">
              Hoje
            </span>
          </div>

          <div>
            <div className="text-[11px] sm:text-xs font-bold text-amber-800 uppercase tracking-wider mb-0.5 truncate">
              Vencem Hoje
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-amber-600 tracking-tight">
                {dueTodayCount}
              </span>
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Acessar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 3. Faltam 3 Dias */}
        <button
          type="button"
          onClick={() => onNavigate('due', 'in_3_days')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-white via-indigo-50/30 to-indigo-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-indigo-200/90 border-b-0 shadow-[0_6px_0_0_#c7d2fe,0_10px_20px_-3px_rgba(99,102,241,0.15)] hover:shadow-[0_8px_0_0_#818cf8,0_14px_24px_-4px_rgba(99,102,241,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#818cf8,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Cyber Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-400" />

          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-600 text-white shadow-[0_3px_0_0_#4338ca,0_4px_8px_rgba(79,70,229,0.35)] transition-transform group-hover:scale-105">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200">
              3 Dias
            </span>
          </div>

          <div>
            <div className="text-[11px] sm:text-xs font-bold text-indigo-800 uppercase tracking-wider mb-0.5 truncate">
              Faltam 3 Dias
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-indigo-600 tracking-tight">
                {dueIn3DaysCount}
              </span>
              <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Acessar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 4. 1 Dia de Atraso */}
        <button
          type="button"
          onClick={() => onNavigate('due', 'late_1_day')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-white via-rose-50/30 to-rose-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-rose-200/90 border-b-0 shadow-[0_6px_0_0_#fecdd3,0_10px_20px_-3px_rgba(225,29,72,0.15)] hover:shadow-[0_8px_0_0_#fb7185,0_14px_24px_-4px_rgba(225,29,72,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#fb7185,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Cyber Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500" />

          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-rose-600 text-white shadow-[0_3px_0_0_#be123c,0_4px_8px_rgba(225,29,72,0.35)] transition-transform group-hover:scale-105">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
              1 Dia
            </span>
          </div>

          <div>
            <div className="text-[11px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider mb-0.5 truncate">
              1 Dia Atraso
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-rose-600 tracking-tight">
                {dueLate1DayCount}
              </span>
              <span className="text-[11px] font-bold text-rose-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Acessar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 5. Total Atrasados */}
        <button
          type="button"
          onClick={() => onNavigate('due', 'all_late')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-white via-red-50/40 to-red-100/50 text-left transition-all duration-150 border-t-2 border-t-white border-x border-red-200/90 border-b-0 shadow-[0_6px_0_0_#fca5a5,0_10px_20px_-3px_rgba(220,38,38,0.18)] hover:shadow-[0_8px_0_0_#ef4444,0_14px_24px_-4px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#ef4444,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Cyber Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-rose-600" />

          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-red-600 text-white shadow-[0_3px_0_0_#991b1b,0_4px_8px_rgba(220,38,38,0.4)] transition-transform group-hover:scale-105">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-red-200 text-red-900 border border-red-300">
              Crítico
            </span>
          </div>

          <div>
            <div className="text-[11px] sm:text-xs font-bold text-red-800 uppercase tracking-wider mb-0.5 truncate">
              Total Atrasados
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-red-600 tracking-tight">
                {overdueCount}
              </span>
              <span className="text-[11px] font-bold text-red-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Acessar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>

        {/* 6. Todos os Vencimentos */}
        <button
          type="button"
          onClick={() => onNavigate('due', 'all')}
          className="group relative flex flex-col justify-between p-3.5 sm:p-5 rounded-2xl bg-gradient-to-b from-white via-emerald-50/30 to-emerald-100/40 text-left transition-all duration-150 border-t-2 border-t-white border-x border-emerald-200/90 border-b-0 shadow-[0_6px_0_0_#a7f3d0,0_10px_20px_-3px_rgba(16,185,129,0.15)] hover:shadow-[0_8px_0_0_#34d399,0_14px_24px_-4px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 active:translate-y-1.5 active:shadow-[0_1px_0_0_#34d399,0_3px_6px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Cyber Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400" />

          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-600 text-white shadow-[0_3px_0_0_#065f46,0_4px_8px_rgba(5,150,105,0.35)] transition-transform group-hover:scale-105">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
              Geral
            </span>
          </div>

          <div>
            <div className="text-[11px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider mb-0.5 truncate">
              Todos Vencimentos
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 tracking-tight">
                {totalPendingCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Acessar <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

