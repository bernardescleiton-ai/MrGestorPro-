import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Package, Calendar, Check, MessageSquare, DollarSign, Clock, ArrowRight, CheckCircle2, Sparkles, Save } from 'lucide-react';
import { Client, CompanySettings } from '../types';
import { dateBR, todayStr, formatDateTimeBR, encodeForWhatsApp, normalizePhone, calculateRenewalDueDate } from '../utils/formatters';

interface RenewalModalProps {
  isOpen: boolean;
  client: Client | null;
  settings: CompanySettings;
  onClose: () => void;
  onConfirmRenewal: (data: {
    client: Client;
    months: number;
    customAmount: number;
    recordPaidCharge: boolean;
    sendWhatsApp: boolean;
    customDateStr?: string;
    customWhatsAppMessage?: string;
  }) => void;
  onSaveRenewalTemplate?: (template: string) => void;
}

export const RenewalModal: React.FC<RenewalModalProps> = ({
  isOpen,
  client,
  settings,
  onClose,
  onConfirmRenewal,
  onSaveRenewalTemplate,
}) => {
  const [selectedMonths, setSelectedMonths] = useState<number>(1);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customDaysMonths, setCustomDaysMonths] = useState<string>('1');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('12:00');
  const [amountInput, setAmountInput] = useState<string>('');
  const [recordPaid, setRecordPaid] = useState<boolean>(true);
  const [sendWhatsApp, setSendWhatsApp] = useState<boolean>(true);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [hasManuallyEditedMsg, setHasManuallyEditedMsg] = useState<boolean>(false);
  const [isSavedNotice, setIsSavedNotice] = useState<boolean>(false);

  // Helper to generate default renewal message using settings or standard template
  const generateDefaultMessage = (clientObj: Client, dueDateStr: string, amountStr: string): string => {
    const formattedDate = formatDateTimeBR(dueDateStr);
    const parsedAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    const valText = parsedAmount > 0 ? `\n💰 *Valor:* R$ ${parsedAmount.toFixed(2).replace('.', ',')}` : '';

    if (settings?.renewalMessageTemplate && settings.renewalMessageTemplate.trim()) {
      return settings.renewalMessageTemplate
        .replace(/{nome}/g, clientObj.name)
        .replace(/{vencimento}/g, formattedDate)
        .replace(/{valor}/g, valText);
    }

    return `Olá, *${clientObj.name}*! Sua renovação de acesso foi realizada com sucesso!\n\n📅 *Novo Vencimento:* ${formattedDate}${valText}\n\nAgradecemos a preferência!`;
  };

  useEffect(() => {
    if (client) {
      setSelectedMonths(1);
      setIsCustomMode(false);
      setCustomDaysMonths('1');
      setAmountInput('');
      setRecordPaid(true);
      setSendWhatsApp(settings?.enableRenewalWhatsAppMessage ?? true);
      setHasManuallyEditedMsg(false);

      const initialDueDateStr = calculateRenewalDueDate(client.dueDate, 1);
      const [initDate, initTime] = initialDueDateStr.includes('T')
        ? initialDueDateStr.split('T')
        : [initialDueDateStr, '12:00'];

      setSelectedDate(initDate || todayStr());
      setSelectedTime(initTime || '12:00');

      const fullStr = initDate ? (initTime ? `${initDate}T${initTime}` : initDate) : initialDueDateStr;
      setCustomMessage(generateDefaultMessage(client, fullStr, ''));
    }
  }, [client, isOpen]);

  // Handle package selection
  const handlePackageSelect = (months: number) => {
    setIsCustomMode(false);
    setSelectedMonths(months);
    if (client) {
      const calcStr = calculateRenewalDueDate(client.dueDate, months);
      const [calcDate] = calcStr.split('T');
      if (calcDate) {
        setSelectedDate(calcDate);
      }
    }
  };

  const handleCustomMonthsChange = (val: string) => {
    setCustomDaysMonths(val);
    const months = parseInt(val, 10) || 1;
    if (client) {
      const calcStr = calculateRenewalDueDate(client.dueDate, months);
      const [calcDate] = calcStr.split('T');
      if (calcDate) {
        setSelectedDate(calcDate);
      }
    }
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    setSelectedTime(`${h}:${m}`);
  };

  // Full formatted new due date string (YYYY-MM-DDTHH:mm)
  const calculatedNewDueDateStr = selectedDate
    ? (selectedTime ? `${selectedDate}T${selectedTime}` : selectedDate)
    : (client ? calculateRenewalDueDate(client.dueDate, selectedMonths) : '');

  // Keep message updated if user hasn't typed custom message
  useEffect(() => {
    if (client && !hasManuallyEditedMsg && calculatedNewDueDateStr) {
      setCustomMessage(generateDefaultMessage(client, calculatedNewDueDateStr, amountInput));
    }
  }, [calculatedNewDueDateStr, amountInput, client, hasManuallyEditedMsg]);

  if (!isOpen || !client) return null;

  const handleResetMessage = () => {
    setHasManuallyEditedMsg(false);
    setCustomMessage(generateDefaultMessage(client, calculatedNewDueDateStr, amountInput));
  };

  const handleSaveTemplate = () => {
    if (!onSaveRenewalTemplate) return;

    let templateText = customMessage;
    if (client) {
      const formattedDate = formatDateTimeBR(calculatedNewDueDateStr);
      // Replace specific client name and date with placeholders for generic future use
      templateText = templateText.replace(new RegExp(client.name, 'g'), '{nome}');
      if (formattedDate) {
        templateText = templateText.replace(new RegExp(formattedDate, 'g'), '{vencimento}');
      }
    }

    onSaveRenewalTemplate(templateText);
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 3000);
  };

  const handleInsertTag = (tag: string) => {
    setCustomMessage((prev) => (prev ? `${prev} ${tag}` : tag));
    setHasManuallyEditedMsg(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const months = isCustomMode ? (parseInt(customDaysMonths, 10) || 1) : selectedMonths;
    const customAmount = parseFloat(amountInput.replace(',', '.')) || 0;

    onConfirmRenewal({
      client,
      months,
      customAmount,
      recordPaidCharge: recordPaid,
      sendWhatsApp,
      customDateStr: calculatedNewDueDateStr,
      customWhatsAppMessage: customMessage,
    });
  };

  const packages = [
    { months: 1, title: '1 Mês', subtitle: '30 dias', credits: '1 mês' },
    { months: 3, title: '3 Meses', subtitle: '90 dias', credits: '3 meses' },
    { months: 6, title: '6 Meses', subtitle: '180 dias', credits: '6 meses' },
    { months: 12, title: '12 Meses', subtitle: '365 dias (1 Ano)', credits: '12 meses' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden transform transition-all my-auto">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="p-2 sm:p-2.5 bg-blue-100 text-blue-600 rounded-xl shrink-0">
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                Renovação: <span className="text-blue-600">{client.name}</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-mono truncate">Estenda e ajuste a data e horário de vencimento</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">
          {/* Package Selection Grid */}
          <div>
            <label className="block text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Selecione o pacote de renovação
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {packages.map((pkg) => {
                const isSelected = !isCustomMode && selectedMonths === pkg.months;
                return (
                  <button
                    key={pkg.months}
                    type="button"
                    onClick={() => handlePackageSelect(pkg.months)}
                    className={`p-2.5 sm:p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-blue-600 text-white rounded-full flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </span>
                    )}
                    <div className="p-1.5 sm:p-2 bg-blue-100/60 text-blue-700 rounded-lg w-fit mb-1.5 sm:mb-2">
                      <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs sm:text-sm">{pkg.title}</div>
                      <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono mt-0.5">{pkg.credits}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date and Time Adjustment Section */}
          <div className="bg-slate-50/90 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                2. Ajustar Data e Horário de Vencimento
              </label>
              <span className="text-[10px] text-slate-400 font-mono">Calculado automaticamente, editável</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Data */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Nova Data de Vencimento
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs sm:text-sm font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                  required
                />
              </div>

              {/* Horário */}
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-500" />
                  Novo Horário de Vencimento
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs sm:text-sm font-mono font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSetCurrentTime}
                    className="px-2.5 py-2 bg-slate-200/80 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shrink-0 transition-colors"
                    title="Definir horário atual do celular/computador"
                  >
                    Agora
                  </button>
                </div>
              </div>
            </div>

            {/* Quick time chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Atalhos de horário:
              </span>
              {[
                { label: '00:00 (Início)', time: '00:00' },
                { label: '08:00 (Manhã)', time: '08:00' },
                { label: '12:00 (Meio-dia)', time: '12:00' },
                { label: '18:00 (Tarde)', time: '18:00' },
                { label: '23:59 (Fim do dia)', time: '23:59' },
              ].map((preset) => (
                <button
                  key={preset.time}
                  type="button"
                  onClick={() => setSelectedTime(preset.time)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                    selectedTime === preset.time
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              {client?.dueDate?.includes('T') && (
                <button
                  type="button"
                  onClick={() => {
                    const prevTime = client.dueDate?.split('T')[1];
                    if (prevTime) setSelectedTime(prevTime);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 transition-colors"
                  title="Restaurar o mesmo horário anterior do cliente"
                >
                  Manter Anterior ({client.dueDate.split('T')[1]})
                </button>
              )}
            </div>
          </div>

          {/* Current vs New Due Date Comparison Card */}
          <div className="p-3 sm:p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 sm:gap-4">
            <div className="text-left min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block truncate">Vencimento Atual</span>
              <span className="text-xs sm:text-xs font-mono font-bold text-slate-700 block truncate">
                {formatDateTimeBR(client.dueDate)}
              </span>
            </div>

            <div className="flex items-center justify-center shrink-0 px-1 text-blue-600">
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>

            <div className="text-right min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 uppercase tracking-widest block flex items-center justify-end gap-1 truncate">
                <Sparkles className="w-3 h-3 shrink-0" /> Novo Vencimento
              </span>
              <span className="text-xs sm:text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-emerald-200 inline-block mt-0.5 truncate">
                {formatDateTimeBR(calculatedNewDueDateStr)}
              </span>
            </div>
          </div>

          {/* Additional Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Amount Field */}
            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Valor do Pacote (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 sm:top-2.5 text-xs text-slate-400 font-bold">R$</span>
                <input
                  type="text"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0,00 (opcional)"
                  className="w-full bg-slate-100 border-none rounded-lg py-1.5 sm:py-2 pl-9 pr-3 text-xs sm:text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-800"
                />
              </div>
            </div>

            {/* Custom duration checkbox/toggle */}
            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Modo Período Customizado
              </label>
              <div className="flex items-center gap-2 pt-0.5 sm:pt-1">
                <input
                  type="checkbox"
                  id="customModeToggle"
                  checked={isCustomMode}
                  onChange={(e) => {
                    setIsCustomMode(e.target.checked);
                    if (e.target.checked) {
                      handleCustomMonthsChange(customDaysMonths);
                    } else {
                      handlePackageSelect(selectedMonths);
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 cursor-pointer shrink-0"
                />
                <label htmlFor="customModeToggle" className="text-xs text-slate-700 cursor-pointer select-none">
                  Meses personalizados
                </label>
              </div>
              {isCustomMode && (
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customDaysMonths}
                    onChange={(e) => handleCustomMonthsChange(e.target.value)}
                    className="w-16 sm:w-20 bg-slate-100 border-none rounded-lg p-1.5 text-xs text-center font-bold font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-xs text-slate-500 font-mono">meses adicionais</span>
                </div>
              )}
            </div>
          </div>

          {/* Options Toggles & Custom Message Box */}
          <div className="space-y-3.5 bg-slate-50/70 p-3 sm:p-4 rounded-xl border border-slate-200">
            <label className="flex items-center justify-between cursor-pointer gap-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                Registrar baixa de pagamento no histórico
              </span>
              <input
                type="checkbox"
                checked={recordPaid}
                onChange={(e) => setRecordPaid(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 shrink-0"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer gap-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                Abrir WhatsApp com mensagem de renovação
              </span>
              <input
                type="checkbox"
                checked={sendWhatsApp}
                onChange={(e) => setSendWhatsApp(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 shrink-0"
              />
            </label>

            {sendWhatsApp && (
              <div className="pt-3 border-t border-slate-200/80 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                    Mensagem do WhatsApp (Personalizável)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetMessage}
                      className="text-[10px] text-slate-500 hover:text-slate-700 font-bold hover:underline"
                    >
                      Restaurar padrão
                    </button>
                    {onSaveRenewalTemplate && (
                      <button
                        type="button"
                        onClick={handleSaveTemplate}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs active:scale-95"
                        title="Salvar esta mensagem como padrão para futuras renovações"
                      >
                        <Save className="w-3 h-3" />
                        Salvar Mensagem
                      </button>
                    )}
                  </div>
                </div>

                {/* Quick Variable Tags */}
                <div className="flex items-center gap-1.5 flex-wrap py-0.5">
                  <span className="text-[10px] text-slate-400 font-medium">Inserir tag:</span>
                  <button
                    type="button"
                    onClick={() => handleInsertTag('{nome}')}
                    className="px-2 py-0.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-semibold transition-colors"
                  >
                    &#123;nome&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag('{vencimento}')}
                    className="px-2 py-0.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-semibold transition-colors"
                  >
                    &#123;vencimento&#125;
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag('{valor}')}
                    className="px-2 py-0.5 bg-slate-200/70 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono font-semibold transition-colors"
                  >
                    &#123;valor&#125;
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={customMessage}
                  onChange={(e) => {
                    setCustomMessage(e.target.value);
                    setHasManuallyEditedMsg(true);
                  }}
                  placeholder="Digite aqui a mensagem personalizada que será enviada para o cliente no WhatsApp..."
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 text-xs font-sans text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed shadow-2xs transition-all resize-y"
                />

                {isSavedNotice && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>✓ Mensagem de renovação salva como padrão com sucesso!</span>
                  </div>
                )}

                <p className="text-[10px] text-slate-400 font-mono">
                  Dica: Clique em "Salvar Mensagem" para salvar este modelo para todas as próximas renovações.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer inside Form */}
          <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 sm:px-4 py-2 sm:py-2.5 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5 sm:gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Renovar Acesso
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

