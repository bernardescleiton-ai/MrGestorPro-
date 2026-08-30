import React, { useState, useEffect, useMemo } from 'react';
import { Bell, RefreshCw, Calendar, Clock, AlertTriangle, AlertCircle, Search, CheckCircle2, MessageSquare, Phone, Trash2, CheckSquare, Square } from 'lucide-react';
import { Client, Charge, CompanySettings } from '../types';
import { dateBR, formatDateTimeBR, getChargeStatus, getDaysUntilDue, getClientStatusBadge, openWhatsApp } from '../utils/formatters';

export type DueTabFilter = 'today' | 'in_3_days' | 'late_1_day' | 'all_late' | 'all';

interface DueViewProps {
  clients: Client[];
  charges: Charge[];
  settings: CompanySettings;
  initialFilter?: DueTabFilter;
  onMarkPaid: (chargeId: string) => void;
  onSendWhatsApp?: (client: Client, charge?: Charge) => void;
  onOpenRenewClient?: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onDeleteClientsBatch?: (clientIds: string[]) => void;
}

export const DueView: React.FC<DueViewProps> = ({
  clients,
  charges,
  settings,
  initialFilter = 'today',
  onMarkPaid,
  onSendWhatsApp,
  onOpenRenewClient,
  onDeleteClient,
  onDeleteClientsBatch,
}) => {
  const [activeTab, setActiveTab] = useState<DueTabFilter>(initialFilter);
  const [search, setSearch] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

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

  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    safeClients.forEach((c) => {
      if (c && c.id) map.set(c.id, c);
    });
    return map;
  }, [safeClients]);

  const getClient = (clientId: string) => clientMap.get(clientId);

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

  // Helper to compute day difference for a charge/client
  const getItemDaysDiff = (ch: Charge): number | null => {
    const client = getClient(ch.clientId);
    const dateToEvaluate = ch.dueDate || client?.dueDate?.split('T')[0];
    return getDaysUntilDue(dateToEvaluate);
  };

  // Pre-calculate counts for each tab
  const todayCount = useMemo(() => {
    return allPendingItems.filter((ch) => getItemDaysDiff(ch) === 0).length;
  }, [allPendingItems, clientMap]);

  const in3DaysCount = useMemo(() => {
    return allPendingItems.filter((ch) => {
      const diff = getItemDaysDiff(ch);
      return diff !== null && diff >= 1 && diff <= 3;
    }).length;
  }, [allPendingItems, clientMap]);

  const late1DayCount = useMemo(() => {
    return allPendingItems.filter((ch) => getItemDaysDiff(ch) === -1).length;
  }, [allPendingItems, clientMap]);

  const allLateCount = useMemo(() => {
    return allPendingItems.filter((ch) => {
      const diff = getItemDaysDiff(ch);
      return diff !== null && diff < 0;
    }).length;
  }, [allPendingItems, clientMap]);

  const totalAllCount = allPendingItems.length;

  // Filter items based on active tab
  const tabFilteredItems = useMemo(() => {
    return allPendingItems.filter((ch) => {
      const diff = getItemDaysDiff(ch);
      if (activeTab === 'today') {
        return diff === 0;
      }
      if (activeTab === 'in_3_days') {
        return diff !== null && diff >= 1 && diff <= 3;
      }
      if (activeTab === 'late_1_day') {
        return diff === -1;
      }
      if (activeTab === 'all_late') {
        return diff !== null && diff < 0;
      }
      return true; // 'all'
    });
  }, [allPendingItems, activeTab, clientMap]);

  // Apply search query filter
  const displayedItems = useMemo(() => {
    return tabFilteredItems
      .filter((ch) => {
        if (!search.trim()) return true;
        const client = getClient(ch.clientId);
        const nameMatch = client?.name?.toLowerCase().includes(search.toLowerCase());
        const phoneMatch = client?.phone?.includes(search);
        const noteMatch = ch.note?.toLowerCase().includes(search.toLowerCase());
        return nameMatch || phoneMatch || noteMatch;
      })
      .sort((a, b) => {
        const dtA = (a.dueDate || '') + (a.dueTime ? `T${a.dueTime}` : '');
        const dtB = (b.dueDate || '') + (b.dueTime ? `T${b.dueTime}` : '');
        return dtA.localeCompare(dtB);
      });
  }, [tabFilteredItems, search, clientMap]);

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
      case 'all_late':
        return {
          title: 'Todos os Atrasados',
          desc: 'Clientes com pagamento ou plano vencido há 1 ou mais dias.',
          badgeColor: 'bg-red-100 text-red-800 border-red-300',
          count: allLateCount,
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
      </div>

      {/* Immediate Access Category Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {/* Vencem Hoje */}
        <button
          type="button"
          onClick={() => handleTabChange('today')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'today'
              ? 'bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-400/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'today' ? 'text-amber-100' : 'text-slate-500'}`}>
              Hoje
            </span>
            <div className={`p-1.5 rounded-lg ${activeTab === 'today' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs sm:text-sm font-bold truncate">Vencem Hoje</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
              activeTab === 'today' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
            }`}>
              {todayCount}
            </span>
          </div>
        </button>

        {/* Faltando 3 Dias */}
        <button
          type="button"
          onClick={() => handleTabChange('in_3_days')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'in_3_days'
              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-500/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300 hover:bg-blue-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'in_3_days' ? 'text-blue-100' : 'text-slate-500'}`}>
              Próximos
            </span>
            <div className={`p-1.5 rounded-lg ${activeTab === 'in_3_days' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs sm:text-sm font-bold truncate">Faltando 3 Dias</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
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
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'late_1_day'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-rose-300 hover:bg-rose-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'late_1_day' ? 'text-rose-100' : 'text-slate-500'}`}>
              Ontem
            </span>
            <div className={`p-1.5 rounded-lg ${activeTab === 'late_1_day' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs sm:text-sm font-bold truncate">1 Dia Atraso</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
              activeTab === 'late_1_day' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-800'
            }`}>
              {late1DayCount}
            </span>
          </div>
        </button>

        {/* Todos Atrasados */}
        <button
          type="button"
          onClick={() => handleTabChange('all_late')}
          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'all_late'
              ? 'bg-red-700 text-white border-red-800 shadow-md ring-2 ring-red-600/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-red-300 hover:bg-red-50/30 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'all_late' ? 'text-red-100' : 'text-slate-500'}`}>
              Atrasados
            </span>
            <div className={`p-1.5 rounded-lg ${activeTab === 'all_late' ? 'bg-red-800 text-white' : 'bg-red-50 text-red-600'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs sm:text-sm font-bold truncate">Total Atrasados</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
              activeTab === 'all_late' ? 'bg-white text-red-700' : 'bg-red-100 text-red-800'
            }`}>
              {allLateCount}
            </span>
          </div>
        </button>

        {/* Todos os Vencimentos */}
        <button
          type="button"
          onClick={() => handleTabChange('all')}
          className={`col-span-2 sm:col-span-1 lg:col-span-1 p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between active:scale-95 cursor-pointer ${
            activeTab === 'all'
              ? 'bg-slate-800 text-white border-slate-900 shadow-md ring-2 ring-slate-700/30'
              : 'bg-white text-slate-700 border-slate-200/80 hover:border-slate-400 hover:bg-slate-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTab === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
              Geral
            </span>
            <div className={`p-1.5 rounded-lg ${activeTab === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <Bell className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between w-full mt-1">
            <span className="text-xs sm:text-sm font-bold truncate">Todos</span>
            <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
              activeTab === 'all' ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {totalAllCount}
            </span>
          </div>
        </button>
      </div>

      {/* Bulk Action Bar for Selected Clients */}
      {activeSelectedClientIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between text-xs text-rose-900 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs">
              {activeSelectedClientIds.length}
            </span>
            <span>
              cliente{activeSelectedClientIds.length > 1 ? 's' : ''} selecionado{activeSelectedClientIds.length > 1 ? 's' : ''} para exclusão
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedClientIds([])}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              Desmarcar todos
            </button>
            <button
              type="button"
              onClick={() => {
                if (onDeleteClientsBatch) {
                  onDeleteClientsBatch(activeSelectedClientIds);
                  setSelectedClientIds([]);
                }
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" /> Excluir {activeSelectedClientIds.length} Cliente{activeSelectedClientIds.length > 1 ? 's' : ''}
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
              {displayedItems.map((ch) => {
                const client = getClient(ch.clientId);
                const daysDiff = getItemDaysDiff(ch);
                const statusBadge = getClientStatusBadge(ch.dueDate + (ch.dueTime ? `T${ch.dueTime}` : ''));
                const isSelected = client ? selectedClientIds.includes(client.id) : false;

                return (
                  <div
                    key={ch.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all gap-3 ${
                      isSelected
                        ? 'bg-rose-50/70 border-rose-300 shadow-xs'
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
                            {client ? client.name : 'Cliente sem cadastro'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono">
                          <span>
                            Vencimento: <strong className="text-slate-800">{dateBR(ch.dueDate)}{ch.dueTime ? ` às ${ch.dueTime}` : ''}</strong>
                          </span>
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
                          onClick={() => (onSendWhatsApp ? onSendWhatsApp(client, ch) : openWhatsApp(client, ch, settings))}
                          className="px-2.5 sm:px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors active:scale-95 flex items-center gap-1 cursor-pointer"
                          title="Enviar mensagem pelo WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onMarkPaid(ch.id)}
                        className="bg-slate-800 text-white text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                        title="Marcar como concluído/pago"
                      >
                        Concluir
                      </button>

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
      </div>
    </div>
  );
};


