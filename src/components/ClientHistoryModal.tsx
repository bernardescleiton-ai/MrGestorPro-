import React from 'react';
import { X, Phone, Plus, RefreshCw } from 'lucide-react';
import { Client, Charge, CompanySettings } from '../types';
import { dateBR, getChargeStatus, openWhatsApp } from '../utils/formatters';

interface ClientHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  charges: Charge[];
  settings: CompanySettings;
  onMarkPaid: (chargeId: string) => void;
  onUndoPaid: (chargeId: string) => void;
  onNewChargeForClient: (clientId: string) => void;
  onSendWhatsApp?: (client: Client, charge?: Charge) => void;
  onOpenRenewClient?: (client: Client) => void;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  isOpen,
  onClose,
  client,
  charges,
  settings,
  onMarkPaid,
  onUndoPaid,
  onNewChargeForClient,
  onSendWhatsApp,
  onOpenRenewClient,
}) => {
  if (!isOpen || !client) return null;

  const clientCharges = charges.filter((c) => c.clientId === client.id);
  const pendingCount = clientCharges.filter((c) => !c.paid).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-800">{client.name}</h2>
              <span className="text-xs text-slate-500">Histórico de Vencimentos do Cliente</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenRenewClient && (
              <button
                onClick={() => onOpenRenewClient(client)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Renovar Acesso
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Client Details Card */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-slate-400">WhatsApp</span>
                <span className="font-semibold text-slate-700">{client.phone}</span>
              </div>
            </div>
            {client.notes && (
              <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600">
                <strong className="text-slate-700">Obs:</strong> {client.notes}
              </div>
            )}
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-blue-600 uppercase">Total de Vencimentos</span>
              <div className="text-2xl font-extrabold text-blue-900 mt-1">{clientCharges.length}</div>
            </div>
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-amber-700 uppercase">Pendentes</span>
              <div className="text-2xl font-extrabold text-amber-900 mt-1">{pendingCount}</div>
            </div>
          </div>

          {/* Charges list header */}
          <div className="flex items-center justify-between pt-2">
            <h3 className="font-bold text-slate-800 text-base">Vencimentos ({clientCharges.length})</h3>
          </div>

          {/* Charges Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {clientCharges.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Nenhum vencimento registrado para este cliente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase">
                      <th className="py-3 px-4 font-semibold">Vencimento</th>
                      <th className="py-3 px-4 font-semibold">Observação</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clientCharges.map((ch) => {
                      const st = getChargeStatus(ch);
                      return (
                        <tr key={ch.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {dateBR(ch.dueDate)}
                            {ch.dueTime && <span className="ml-1 text-xs text-slate-500">às {ch.dueTime}</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">{ch.note || '—'}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                st === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : st === 'late'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {st === 'paid' ? 'Concluído' : st === 'late' ? 'Atrasado' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => (onSendWhatsApp ? onSendWhatsApp(client, ch) : openWhatsApp(client, ch, settings))}
                                title="Enviar lembrete via WhatsApp"
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200 transition-colors"
                              >
                                WhatsApp
                              </button>
                              {ch.paid ? (
                                <button
                                  onClick={() => onUndoPaid(ch.id)}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                                >
                                  Desfazer
                                </button>
                              ) : (
                                <button
                                  onClick={() => onMarkPaid(ch.id)}
                                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
                                >
                                  Concluir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
