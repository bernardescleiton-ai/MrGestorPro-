import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Phone, Mail, FileText, Edit, Trash2, History, MessageSquare, Sparkles, CheckSquare, Square, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Check, Pencil, Users, ShieldCheck, AlertTriangle, X, ChevronLeft, ChevronRight, Copy, Download, FileSpreadsheet } from 'lucide-react';
import { Client, Charge } from '../types';
import { formatDateTimeBR, getClientStatusBadge, isClientActive, getDaysUntilDue, getOverdueChargeClientIds, formatPhoneNumber, deduplicateClients, formatClientForCopy, formatClientsListForCopy } from '../utils/formatters';
import { ExportClientsModal } from './ExportClientsModal';

type SortField = 'name' | 'phone' | 'dueDate' | 'status';
type SortDirection = 'asc' | 'desc';
export type ClientFilterType = 'all' | 'active' | 'overdue';

interface InlinePhoneEditorProps {
  clientId: string;
  initialPhone?: string;
  onSave?: (clientId: string, newPhone: string) => void;
}

const InlinePhoneEditor: React.FC<InlinePhoneEditorProps> = ({ clientId, initialPhone = '', onSave }) => {
  const [value, setValue] = useState(initialPhone || '');
  const [isSaved, setIsSaved] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setValue(initialPhone || '');
  }, [initialPhone]);

  const commitChange = (newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed !== (initialPhone || '')) {
      if (onSave) {
        onSave(clientId, trimmed);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    commitChange(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative flex items-center group/phone min-w-[170px] max-w-[220px]">
      <div className="absolute left-2.5 pointer-events-none text-slate-400 group-hover/phone:text-blue-500 transition-colors">
        <Phone className="w-3.5 h-3.5" />
      </div>
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Inserir telefone..."
        title="Telefone editável diretamente na lista (salva automaticamente)"
        className={`w-full text-xs font-mono pl-8 pr-7 py-1.5 rounded-lg border transition-all outline-none ${
          isFocused
            ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 text-slate-900 shadow-sm'
            : isSaved
            ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold'
            : value
            ? 'bg-slate-50/80 hover:bg-white border-slate-200 hover:border-slate-300 text-slate-800'
            : 'bg-amber-50/40 hover:bg-white border-dashed border-amber-300 hover:border-amber-400 text-amber-900 placeholder:text-amber-600/60'
        }`}
      />
      {isSaved ? (
        <span className="absolute right-2 text-emerald-600 text-[10px] font-bold flex items-center gap-0.5 pointer-events-none animate-in fade-in zoom-in-75">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </span>
      ) : (
        <span
          className="absolute right-2 opacity-0 group-hover/phone:opacity-60 hover:opacity-100 text-slate-400 transition-opacity pointer-events-none"
          title="Clique para editar"
        >
          <Pencil className="w-3 h-3" />
        </span>
      )}
    </div>
  );
};

interface ClientsViewProps {
  clients: Client[];
  charges?: Charge[];
  initialStatusFilter?: ClientFilterType;
  onOpenNewClient: () => void;
  onOpenEditClient: (client: Client) => void;
  onUpdatePhone?: (clientId: string, newPhone: string) => void;
  onDeleteClient: (clientId: string) => void;
  onDeleteBatch?: (clientIds: string[]) => void;
  onOpenHistory: (client: Client) => void;
  onSendWhatsApp: (client: Client) => void;
  onOpenRenewClient?: (client: Client) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  charges = [],
  initialStatusFilter = 'all',
  onOpenNewClient,
  onOpenEditClient,
  onUpdatePhone,
  onDeleteClient,
  onDeleteBatch,
  onOpenHistory,
  onSendWhatsApp,
  onOpenRenewClient,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientFilterType>(initialStatusFilter);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportClientsList, setExportClientsList] = useState<Client[]>([]);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copiedSingleId, setCopiedSingleId] = useState<string | null>(null);
  const [localToast, setLocalToast] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    }
  }, [initialStatusFilter]);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(30);

  const safeClients = useMemo(() => (Array.isArray(clients) ? clients : []), [clients]);
  const safeCharges = useMemo(() => (Array.isArray(charges) ? charges : []), [charges]);

  // Precompute overdue charges client IDs in O(M) once
  const overdueChargeClientIds = useMemo(() => getOverdueChargeClientIds(safeCharges), [safeCharges]);

  // Status counts in O(N)
  const totalCount = safeClients.length;
  const activeCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < safeClients.length; i++) {
      if (isClientActive(safeClients[i], safeCharges, overdueChargeClientIds)) {
        count++;
      }
    }
    return count;
  }, [safeClients, safeCharges, overdueChargeClientIds]);
  const overdueCount = totalCount - activeCount;

  // Filter out any selected IDs that no longer exist in clients
  const validClientIds = useMemo(() => new Set(safeClients.map((c) => c.id).filter(Boolean)), [safeClients]);
  const activeSelectedIds = selectedIds.filter((id) => validClientIds.has(id));

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

  const handleOpenExportModal = (customList?: Client[]) => {
    if (customList && customList.length > 0) {
      setExportClientsList(deduplicateClients(customList));
    } else if (activeSelectedIds.length > 0) {
      const selectedList = safeClients.filter((c) => activeSelectedIds.includes(c.id));
      setExportClientsList(deduplicateClients(selectedList));
    } else {
      setExportClientsList(deduplicateClients(filteredClients));
    }
    setIsExportModalOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const filteredClients = useMemo(() => {
    const term = search.toLowerCase().trim();
    return safeClients
      .filter((c) => {
        if (!c) return false;

        // Status Filter
        if (statusFilter === 'active') {
          if (!isClientActive(c, safeCharges, overdueChargeClientIds)) return false;
        } else if (statusFilter === 'overdue') {
          if (isClientActive(c, safeCharges, overdueChargeClientIds)) return false;
        }

        // Text Search
        if (term) {
          const nameMatch = (c.name || '').toLowerCase().includes(term);
          const phoneMatch = (c.phone || '').includes(term);
          if (!nameMatch && !phoneMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let res = 0;
        if (sortField === 'name') {
          res = (a.name || '').localeCompare(b.name || '', 'pt-BR');
        } else if (sortField === 'phone') {
          res = (a.phone || '').localeCompare(b.phone || '');
        } else if (sortField === 'dueDate') {
          const dA = a.dueDate || '9999-99-99';
          const dB = b.dueDate || '9999-99-99';
          res = dA.localeCompare(dB);
        } else if (sortField === 'status') {
          const wA = getDaysUntilDue(a.dueDate) ?? 9999;
          const wB = getDaysUntilDue(b.dueDate) ?? 9999;
          res = wA - wB;
        }

        return sortDirection === 'asc' ? res : -res;
      });
  }, [safeClients, safeCharges, overdueChargeClientIds, statusFilter, search, sortField, sortDirection]);

  // Reset page when filtering or searching changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  // Paginated clients slice for rendering
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredClients.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedClients = useMemo(() => {
    if (pageSize === 'all') return filteredClients;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredClients.slice(startIndex, startIndex + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredClients.map((c) => c.id).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (clientId: string) => {
    if (!clientId) return;
    setSelectedIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  const isAllSelected = filteredClients.length > 0 && filteredClients.every((c) => c.id && activeSelectedIds.includes(c.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clientes</h1>
            {statusFilter === 'active' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Apenas Ativos
              </span>
            )}
            {statusFilter === 'overdue' && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                Apenas Vencidos
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-mono mt-0.5">Cadastre, filtre e gerencie sua carteira de clientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleOpenExportModal()}
            className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-sm font-bold px-3.5 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 active:scale-95"
            title="Copiar ou exportar arquivo com os dados dos clientes (Nome, Telefone e Vencimento)"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Copiar / Exportar ({filteredClients.length})</span>
          </button>

          <button
            onClick={onOpenNewClient}
            className="flex-1 sm:flex-none bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Novo cliente
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

      {/* Interactive Status Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl border border-slate-300/80 shadow-2xs">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'all'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Todos</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
            statusFilter === 'all' ? 'bg-slate-100 text-slate-800 font-bold' : 'bg-slate-200 text-slate-600'
          }`}>
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'active'
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
              : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/70'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Clientes Ativos</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
            statusFilter === 'active' ? 'bg-blue-500 text-white font-bold' : 'bg-blue-100 text-blue-800'
          }`}>
            {activeCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('overdue')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            statusFilter === 'overdue'
              ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
              : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50/70'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Vencidos / Atrasados</span>
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
            statusFilter === 'overdue' ? 'bg-rose-500 text-white font-bold' : 'bg-rose-100 text-rose-800'
          }`}>
            {overdueCount}
          </span>
        </button>
      </div>

      {/* Active Filter Notice */}
      {statusFilter !== 'all' && (
        <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200/80 px-4 py-2.5 rounded-xl text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {statusFilter === 'active' ? '🎯 Mostrando apenas Clientes Ativos' : '⚠️ Mostrando apenas Clientes Vencidos / Em Atraso'}
            </span>
            <span className="text-blue-700 font-mono">({filteredClients.length} encontrados)</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 underline underline-offset-2 hover:opacity-80"
          >
            <X className="w-3.5 h-3.5" /> Ver todos os clientes
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {activeSelectedIds.length > 0 && (
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl animate-in fade-in duration-200 border border-slate-800">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs font-bold shadow-xs">
              {activeSelectedIds.length}
            </span>
            <div>
              <div className="font-bold text-sm text-white">
                {activeSelectedIds.length} cliente{activeSelectedIds.length > 1 ? 's' : ''} selecionado{activeSelectedIds.length > 1 ? 's' : ''}
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
                const selectedClientsList = safeClients.filter((c) => activeSelectedIds.includes(c.id));
                handleDirectCopy(selectedClientsList);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                copiedBatch ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title="Copiar dados dos clientes selecionados para a área de transferência"
            >
              {copiedBatch ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
              <span>{copiedBatch ? 'Copiado!' : `Copiar Dados (${activeSelectedIds.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const selectedClientsList = safeClients.filter((c) => activeSelectedIds.includes(c.id));
                handleOpenExportModal(selectedClientsList);
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
                if (onDeleteBatch) {
                  onDeleteBatch(activeSelectedIds);
                  setSelectedIds([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ml-auto sm:ml-0"
            >
              <Trash2 className="w-4 h-4" />
              <span>Excluir</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {statusFilter === 'active' ? 'Clientes Ativos' : statusFilter === 'overdue' ? 'Clientes Vencidos' : 'Lista de Clientes'} ({filteredClients.length})
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar clientes..."
              className="w-full bg-slate-100 border-none rounded-lg py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm font-mono space-y-2">
              <p>Nenhum cliente encontrado {statusFilter !== 'all' ? `no filtro "${statusFilter === 'active' ? 'Ativos' : 'Vencidos'}"` : ''}.</p>
              {statusFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-xs font-bold transition-colors inline-block"
                >
                  Limpar filtro e ver todos ({totalCount})
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      title="Selecionar todos"
                    />
                  </th>
                  {/* Cliente */}
                  <th className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-blue-600 uppercase tracking-widest transition-colors cursor-pointer group"
                      title="Clique para ordenar por nome de cliente"
                    >
                      <span>Cliente</span>
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>

                  {/* WhatsApp */}
                  <th className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('phone')}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-blue-600 uppercase tracking-widest transition-colors cursor-pointer group"
                      title="Clique para ordenar por WhatsApp"
                    >
                      <span>WhatsApp</span>
                      {sortField === 'phone' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>

                  {/* Vencimento */}
                  <th className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('dueDate')}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-blue-600 uppercase tracking-widest transition-colors cursor-pointer group"
                      title="Clique para inverter ordem da data de vencimento"
                    >
                      <span>Vencimento</span>
                      {sortField === 'dueDate' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>

                  {/* Status */}
                  <th className="px-6 py-3">
                    <button
                      type="button"
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 hover:text-blue-600 uppercase tracking-widest transition-colors cursor-pointer group"
                      title="Clique para inverter ordem por status (vencidos no topo / no prazo)"
                    >
                      <span>Status</span>
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-blue-600 font-bold" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedClients.map((client) => {
                  const isSelected = selectedIds.includes(client.id);
                  return (
                    <tr
                      key={client.id}
                      className={`hover:bg-blue-50/50 group transition-colors ${isSelected ? 'bg-blue-50/70' : ''}`}
                    >
                      <td className="px-4 py-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(client.id)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm">{client.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <InlinePhoneEditor
                          clientId={client.id}
                          initialPhone={client.phone}
                          onSave={onUpdatePhone}
                        />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 font-mono font-semibold">
                        {formatDateTimeBR(client.dueDate)}
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const status = getClientStatusBadge(client.dueDate);
                          return (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${status.className}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenRenewClient && (
                            <button
                              onClick={() => onOpenRenewClient(client)}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all active:scale-95"
                              title="Renovar Acesso / Vencimento"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Renovar
                            </button>
                          )}
                          <button
                            onClick={() => onSendWhatsApp(client)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 flex items-center gap-1 transition-colors"
                            title="Enviar WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                          </button>
                          <button
                            onClick={() => onOpenHistory(client)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                            title="Ver histórico"
                          >
                            <History className="w-3.5 h-3.5" /> Histórico
                          </button>
                          <button
                            onClick={() => handleCopySingle(client)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Copiar dados deste cliente (Nome, Telefone e Vencimento)"
                          >
                            {copiedSingleId === client.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-600" />
                            )}
                          </button>
                          <button
                            onClick={() => onOpenEditClient(client)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteClient(client.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {filteredClients.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                Mostrando{' '}
                <strong className="text-slate-900 font-semibold">
                  {pageSize === 'all' ? '1' : (currentPage - 1) * pageSize + 1}
                </strong>{' '}
                a{' '}
                <strong className="text-slate-900 font-semibold">
                  {pageSize === 'all' ? filteredClients.length : Math.min(currentPage * pageSize, filteredClients.length)}
                </strong>{' '}
                de <strong className="text-slate-900 font-semibold">{filteredClients.length}</strong> clientes
              </span>

              <div className="flex items-center gap-1.5 ml-2 border-l border-slate-300 pl-3">
                <span className="text-slate-500">Por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPageSize(v === 'all' ? 'all' : Number(v));
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

            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1 px-2">
                  <span className="font-semibold text-slate-800">{currentPage}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-600">{totalPages}</span>
                </div>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
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

