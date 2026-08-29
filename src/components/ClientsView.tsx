import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, FileText, Edit, Trash2, History, MessageSquare, Sparkles, CheckSquare, Square, RefreshCw, ArrowUp, ArrowDown, ArrowUpDown, Check, Pencil } from 'lucide-react';
import { Client } from '../types';
import { formatDateTimeBR, getClientStatusBadge } from '../utils/formatters';

type SortField = 'name' | 'phone' | 'dueDate' | 'status';
type SortDirection = 'asc' | 'desc';

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const safeClients = Array.isArray(clients) ? clients : [];

  // Filter out any selected IDs that no longer exist in clients
  const validClientIds = new Set(safeClients.map((c) => c.id).filter(Boolean));
  const activeSelectedIds = selectedIds.filter((id) => validClientIds.has(id));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusWeight = (dueDateStr?: string): number => {
    if (!dueDateStr) return 9999;
    const [datePart] = dueDateStr.split('T');
    if (!datePart) return 9999;
    const [y, m, d] = datePart.split('-').map(Number);
    if (!y || !m || !d) return 9999;

    const today = new Date();
    const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueReset = new Date(y, m - 1, d);

    const diffMs = dueReset.getTime() - todayReset.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const filteredClients = safeClients
    .filter(
      (c) =>
        c &&
        ((c.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.phone || '').toLowerCase().includes(search.toLowerCase()))
    )
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
        const wA = getStatusWeight(a.dueDate);
        const wB = getStatusWeight(b.dueDate);
        res = wA - wB;
      }

      return sortDirection === 'asc' ? res : -res;
    });

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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Clientes</h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">Cadastre e gerencie sua carteira de clientes.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewClient}
            className="bg-blue-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-2 active:scale-95 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Novo cliente
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {activeSelectedIds.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between text-xs text-rose-900 shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-bold">
            <span className="w-6 h-6 bg-rose-600 text-white rounded-full flex items-center justify-center text-xs">
              {activeSelectedIds.length}
            </span>
            <span>cliente{activeSelectedIds.length > 1 ? 's' : ''} selecionado{activeSelectedIds.length > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                if (onDeleteBatch) {
                  onDeleteBatch(activeSelectedIds);
                  setSelectedIds([]);
                }
              }}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95"
            >
              <Trash2 className="w-4 h-4" /> Excluir {activeSelectedIds.length} Cliente{activeSelectedIds.length > 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lista de Clientes ({filteredClients.length})</h2>
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
            <div className="p-12 text-center text-slate-400 text-sm font-mono">
              Nenhum cliente encontrado.
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
                {filteredClients.map((client) => {
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
      </div>
    </div>
  );
};
