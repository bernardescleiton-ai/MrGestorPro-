import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';
import { Client, Charge } from '../types';
import { todayStr } from '../utils/formatters';

interface ChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (chargeData: Omit<Charge, 'id' | 'createdAt' | 'paid'>) => void;
  clients: Client[];
  defaultClientId?: string;
}

function addOffsetDateOnly(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const ChargeModal: React.FC<ChargeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clients,
  defaultClientId,
}) => {
  const [clientId, setClientId] = useState('');
  const [dueDate, setDueDate] = useState(todayStr());
  const [dueTime, setDueTime] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (defaultClientId) {
        setClientId(defaultClientId);
      } else if (clients.length > 0 && !clientId) {
        setClientId(clients[0].id);
      }
      setDueDate(todayStr());
      setDueTime('');
      setNote('');
    }
  }, [isOpen, defaultClientId, clients]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !dueDate) {
      alert('Por favor, selecione o cliente e a data de vencimento.');
      return;
    }

    onSave({
      clientId,
      amount: 0,
      dueDate,
      dueTime: dueTime || undefined,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg text-slate-800">Novo Vencimento</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Cliente *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm bg-white text-slate-800 font-medium"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Data do Vencimento *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min="2020-01-01"
                max="2036-12-31"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-800 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Horário Exato (Opcional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                placeholder="Ex: 14:30"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Observação / Descrição do Prazo
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Vencimento da fatura, renovação de contrato, entrega de serviço..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-800 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              Salvar Vencimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
