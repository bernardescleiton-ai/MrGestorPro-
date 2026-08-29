import React, { useState } from 'react';
import { Search, Trash2, MessageSquare, CheckCircle2, Send, Clock, UserCheck, RefreshCw, Calendar, Phone } from 'lucide-react';
import { Client, Charge, CompanySettings, SentMessageLog } from '../types';
import { dateBR, formatDateTimeBR, getChargeStatus } from '../utils/formatters';

interface ChargesViewProps {
  clients: Client[];
  charges: Charge[];
  settings: CompanySettings;
  sentLogs?: SentMessageLog[];
  onMarkPaid: (chargeId: string) => void;
  onUndoPaid: (chargeId: string) => void;
  onDeleteCharge: (chargeId: string) => void;
  onSendWhatsApp: (client: Client, charge?: Charge) => void;
  onDeleteSentLog?: (logId: string) => void;
  onToggleMessageSent?: (chargeId: string) => void;
}

export const ChargesView: React.FC<ChargesViewProps> = ({
  clients,
  charges,
  settings,
  sentLogs = [],
  onMarkPaid,
  onUndoPaid,
  onDeleteCharge,
  onSendWhatsApp,
  onDeleteSentLog,
  onToggleMessageSent,
}) => {
  const [activeTab, setActiveTab] = useState<'logs' | 'all'>('logs');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  const safeClients = Array.isArray(clients) ? clients : [];
  const safeCharges = Array.isArray(charges) ? charges : [];
  const safeSentLogs = Array.isArray(sentLogs) ? sentLogs : [];

  const getClient = (clientId: string) => safeClients.find((c) => c.id === clientId);

  // Compute stats
  const totalSentMessages = safeSentLogs.length + safeCharges.filter((c) => c.messageSent && !safeSentLogs.some((l) => l.chargeId === c.id)).length;
  
  const notifiedClientsCount = new Set([
    ...safeSentLogs.map((l) => l.clientId),
    ...safeCharges.filter((c) => c.messageSent).map((c) => c.clientId),
  ]).size;

  const todayIso = new Date().toISOString().slice(0, 10);
  const sentTodayCount = sentLogs.filter((l) => l.sentAt && l.sentAt.slice(0, 10) === todayIso).length +
    charges.filter((c) => c.messageSentAt && c.messageSentAt.slice(0, 10) === todayIso).length;

  const pendingMessageCount = charges.filter((c) => !c.messageSent && !c.paid).length;

  // Filter sent logs
  const filteredSentLogs = sentLogs.filter((log) => {
    const term = search.toLowerCase();
    return (
      log.clientName.toLowerCase().includes(term) ||
      log.phone.includes(term) ||
      (log.note && log.note.toLowerCase().includes(term)) ||
      (log.messageText && log.messageText.toLowerCase().includes(term))
    );
  }).sort((a, b) => b.sentAt.localeCompare(a.sentAt));

  // Filter all charges
  const filteredCharges = charges
    .filter((ch) => {
      const client = getClient(ch.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      const matchesSearch =
        clientName.includes(search.toLowerCase()) ||
        (ch.note && ch.note.toLowerCase().includes(search.toLowerCase()));

      const st = getChargeStatus(ch);
      let matchesFilter = true;
      if (filterStatus === 'sent') matchesFilter = !!ch.messageSent;
      else if (filterStatus === 'unsent') matchesFilter = !ch.messageSent;
      else if (filterStatus === 'pending') matchesFilter = st === 'pending';
      else if (filterStatus === 'paid') matchesFilter = st === 'paid';
      else if (filterStatus === 'late') matchesFilter = st === 'late';

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Histórico de Mensagens Enviadas</h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            Registro detalhado dos clientes que já receberam lembretes e avisos de vencimento.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Mensagens Enviadas ({totalSentMessages})</span>
          </button>

          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            <span>Todos os Registros ({charges.length})</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total de Envios</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalSentMessages}</div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">mensagens registradas</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Clientes Notificados</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">{notifiedClientsCount}</div>
          <span className="text-[10px] text-emerald-700 font-mono mt-1 block">clientes contatados</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Enviadas Hoje</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-indigo-600">{sentTodayCount}</div>
          <span className="text-[10px] text-indigo-700 font-mono mt-1 block">hoje</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pendentes de Envio</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <RefreshCw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600">{pendingMessageCount}</div>
          <span className="text-[10px] text-amber-700 font-mono mt-1 block">aguardando lembrete</span>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {activeTab === 'logs' ? 'Histórico de Clientes que Receberam Mensagem' : 'Todos os Vencimentos'}
          </h2>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar cliente ou observação..."
                className="w-full bg-slate-100 border-none rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-medium"
              />
            </div>

            {activeTab === 'all' && (
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-100 border-none rounded-xl py-2 px-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 font-semibold cursor-pointer"
              >
                <option value="">Todos os status</option>
                <option value="sent">Mensagem Enviada</option>
                <option value="unsent">Mensagem Não Enviada</option>
                <option value="pending">Vencimentos Pendentes</option>
                <option value="paid">Concluídos</option>
              </select>
            )}
          </div>
        </div>

        {/* TAB 1: LOGS DE MENSAGENS ENVIADAS */}
        {activeTab === 'logs' && (
          <div className="overflow-x-auto">
            {filteredSentLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-mono">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-300 mb-2 opacity-60" />
                Nenhuma mensagem registrada no histórico ainda.
                <p className="text-xs text-slate-500 mt-1">Ao enviar mensagens pelo WhatsApp, os registros dos clientes aparecerão aqui automaticamente.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cliente</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vencimento</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data & Hora do Envio</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSentLogs.map((log) => {
                    const client = getClient(log.clientId);
                    return (
                      <tr key={log.id} className="hover:bg-emerald-50/30 group transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 text-sm">{log.clientName}</div>
                          <div className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-emerald-600" />
                            {log.phone}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-xs font-mono font-bold text-slate-700">
                          {log.dueDate ? dateBR(log.dueDate) : '—'}
                          {log.note && <span className="block text-[11px] text-slate-500 font-normal font-sans">{log.note}</span>}
                        </td>

                        <td className="px-6 py-4 text-xs font-mono text-slate-700">
                          {formatDateTimeBR(log.sentAt)}
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Mensagem Enviada
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {client && (
                              <button
                                onClick={() => onSendWhatsApp(client)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1"
                                title="Reenviar mensagem pelo WhatsApp"
                              >
                                Reenviar WhatsApp
                              </button>
                            )}

                            {onDeleteSentLog && (
                              <button
                                onClick={() => onDeleteSentLog(log.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                                title="Excluir do histórico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: TODOS OS VENCIMENTOS E SEUS STATUS DE ENVIO */}
        {activeTab === 'all' && (
          <div className="overflow-x-auto">
            {filteredCharges.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm font-mono">
                Nenhum registro encontrado.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cliente</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vencimento</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Observação</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Envio de Mensagem</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Prazo</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCharges.map((ch) => {
                    const client = getClient(ch.clientId);
                    const st = getChargeStatus(ch);
                    return (
                      <tr key={ch.id} className="hover:bg-blue-50/50 group transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800 text-sm">
                          {client ? client.name : <span className="text-rose-500">Cliente removido</span>}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-700 font-mono font-bold">
                          {dateBR(ch.dueDate)}
                          {ch.dueTime && <span className="ml-1 text-slate-500 font-semibold">às {ch.dueTime}</span>}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{ch.note || '—'}</td>

                        <td className="px-6 py-4">
                          {ch.messageSent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Enviado {ch.messageSentAt ? formatDateTimeBR(ch.messageSentAt) : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              Pendente de envio
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              st === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : st === 'late'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}
                          >
                            {st === 'paid' ? 'Concluído' : st === 'late' ? 'Atrasado' : 'Pendente'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {client && (
                              <button
                                onClick={() => onSendWhatsApp(client, ch)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 active:scale-95"
                                title="Enviar lembrete pelo WhatsApp e registrar no histórico"
                              >
                                Enviar WhatsApp
                              </button>
                            )}

                            {onToggleMessageSent && (
                              <button
                                onClick={() => onToggleMessageSent(ch.id)}
                                className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  ch.messageSent
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                                }`}
                                title={ch.messageSent ? 'Marcar como não enviado' : 'Marcar como mensagem enviada'}
                              >
                                {ch.messageSent ? 'Não enviado' : 'Marcar enviado'}
                              </button>
                            )}

                            {!ch.paid ? (
                              <button
                                onClick={() => onMarkPaid(ch.id)}
                                className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition-colors shadow-2xs active:scale-95"
                                title="Marcar prazo como concluído"
                              >
                                Concluir
                              </button>
                            ) : (
                              <button
                                onClick={() => onUndoPaid(ch.id)}
                                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                                title="Desfazer conclusão"
                              >
                                Desfazer
                              </button>
                            )}

                            <button
                              onClick={() => onDeleteCharge(ch.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-colors"
                              title="Excluir registro"
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
        )}
      </div>
    </div>
  );
};
