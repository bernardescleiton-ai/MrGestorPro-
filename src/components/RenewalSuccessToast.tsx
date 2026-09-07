import React, { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles, Calendar, DollarSign, MessageCircle, X, Clock } from 'lucide-react';
import { Client, CompanySettings } from '../types';
import { formatDateTimeBR, normalizePhone } from '../utils/formatters';
import { sendWhatsAppMessage } from '../utils/whatsappMediaSender';

export interface RenewalToastData {
  client: Client;
  newDueDate: string;
  months: number;
  amount: number;
  messageSent: boolean;
  customMessage?: string;
}

interface RenewalSuccessToastProps {
  toast: RenewalToastData | null;
  settings: CompanySettings;
  onClose: () => void;
}

export const RenewalSuccessToast: React.FC<RenewalSuccessToastProps> = ({
  toast,
  settings,
  onClose,
}) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);

  const durationMs = 6000; // 6 seconds

  useEffect(() => {
    if (!toast) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const intervalTime = 50;
    const step = (intervalTime / durationMs) * 100;

    const timer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev <= step) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return prev - step;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [toast, isPaused, onClose]);

  if (!toast) return null;

  const { client, newDueDate, months, amount, messageSent, customMessage } = toast;
  const formattedDueDate = formatDateTimeBR(newDueDate);
  const hasPhone = Boolean(normalizePhone(client?.phone));

  const handleSendOrResendWhatsApp = () => {
    if (!client || !client.phone) return;
    const defaultMsg = `Olá, *${client.name}*! Sua renovação de acesso foi realizada com sucesso!\n\n📅 *Novo Vencimento:* ${formattedDueDate}${
      amount > 0 ? `\n💰 *Valor:* R$ ${amount.toFixed(2).replace('.', ',')}` : ''
    }\n\nAgradecemos a preferência!`;
    const messageToSend = customMessage && customMessage.trim() ? customMessage : defaultMsg;
    void sendWhatsAppMessage({ phone: client.phone, text: messageToSend, settings, media: settings.whatsappMedia });
  };

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-60 w-[94vw] max-w-lg transition-all animate-in fade-in slide-in-from-top-6 duration-300 pointer-events-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden bg-slate-900/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-emerald-500/40 ring-1 ring-emerald-500/20 p-4 sm:p-5">
        {/* Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm sm:text-base text-white tracking-tight">
                  Renovação Confirmada!
                </h4>
                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Sparkles className="w-2.5 h-2.5" /> Sucesso
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Cliente <strong className="text-white font-semibold">{client.name}</strong> renovado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Renewal Details Card */}
        <div className="mt-3.5 p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" /> Novo Vencimento
            </span>
            <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm block">
              {formattedDueDate || 'Data alterada'}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-teal-400" /> Período
            </span>
            <span className="font-semibold text-slate-200 block">
              {months} {months === 1 ? 'mês (+30d)' : `meses (+${months * 30}d)`}
            </span>
          </div>

          {amount > 0 ? (
            <div className="col-span-2 sm:col-span-1 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-400" /> Valor Pago
              </span>
              <span className="font-mono font-bold text-amber-300 block">
                R$ {amount.toFixed(2).replace('.', ',')}
              </span>
            </div>
          ) : (
            <div className="col-span-2 sm:col-span-1 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400">Status Financeiro</span>
              <span className="font-semibold text-slate-300 block">Mensalidade Paga</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3.5 flex items-center justify-end gap-2">
          {hasPhone && (
            <button
              type="button"
              onClick={handleSendOrResendWhatsApp}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{messageSent ? 'Reabrir WhatsApp' : 'Enviar Comprovante'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>

        {/* Visual Progress Bar (Countdown to auto-dismiss) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
