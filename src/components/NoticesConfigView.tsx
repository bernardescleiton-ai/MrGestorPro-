import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Save,
  CheckCircle2,
  XCircle,
  Eye,
  Check,
  Power,
  Zap,
  Globe,
  ExternalLink,
  Smartphone
} from 'lucide-react';
import { CompanySettings, NotificationRules } from '../types';
import { defaultNotificationRules } from '../utils/notifications';
import { sendAutomatedWhatsApp } from '../utils/automatedSender';

interface NoticesConfigViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
}

export const NoticesConfigView: React.FC<NoticesConfigViewProps> = ({ settings, onSaveSettings }) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'standard' | 'renewal' | 'reminder'>('standard');

  useEffect(() => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (!isTyping) {
      setFormData(settings);
    }
  }, [settings]);

  const currentRules: NotificationRules = formData.notificationRules || defaultNotificationRules;

  const handleSelectWhatsAppMethod = (method: 'direct_app' | 'web' | 'wame') => {
    const updated = { ...formData, whatsappMethod: method };
    setFormData(updated);
    onSaveSettings(updated);
    try {
      localStorage.setItem('gc_v1_last_whatsapp_method', method);
    } catch {}
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleToggleRule = (key: keyof NotificationRules) => {
    const updatedRules: NotificationRules = {
      ...currentRules,
      [key]: !currentRules[key],
    };
    const updated = {
      ...formData,
      notificationRules: updatedRules,
    };
    setFormData(updated);
    onSaveSettings(updated);
  };

  const handleInsertTag = (tag: string, targetField: 'messageTemplate' | 'renewalMessageTemplate' | 'reminderMessageTemplate') => {
    const currentVal = formData[targetField] || '';
    const updatedVal = currentVal ? `${currentVal} ${tag}` : tag;
    const updated = {
      ...formData,
      [targetField]: updatedVal,
    };
    setFormData(updated);
    onSaveSettings(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleTestAutomatedSend = async () => {
    const sampleClient = {
      id: 'teste_envio',
      name: 'Cliente Teste',
      phone: formData.managerPhone || formData.phone || '11999999999',
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await sendAutomatedWhatsApp({
      client: sampleClient,
      settings: formData,
    });
  };

  // Preview generation for WhatsApp bubbles
  const getPreviewText = () => {
    let rawText = '';
    if (activeTemplateTab === 'standard') {
      rawText = formData.messageTemplate || 'Olá {nome}, informamos que seu plano/serviço tem vencimento previsto para {vencimento}. Valor: {valor}. Atenciosamente, {empresa}.';
    } else if (activeTemplateTab === 'renewal') {
      rawText = formData.renewalMessageTemplate || 'Olá {nome}, seu acesso foi renovado com sucesso! Seu novo vencimento é {vencimento}. Agradecemos a preferência!';
    } else {
      rawText = formData.reminderMessageTemplate || 'Olá {nome}, lembrete amigável: seu vencimento vence em breve em {vencimento}.';
    }

    return rawText
      .replace(/{nome}/gi, 'Carlos Silva')
      .replace(/{vencimento}/gi, '25/08/2026')
      .replace(/{valor}/gi, 'R$ 50,00')
      .replace(/{empresa}/gi, formData.name || 'Nossa Empresa')
      .replace(/{pix}/gi, formData.pixKey || '123.456.789-00');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-amber-500" />
          Avisos & Modelos de Mensagem do WhatsApp
        </h1>
        <p className="text-slate-500 text-xs font-mono mt-0.5">
          Configure os gatilhos de alerta para o administrador e personalize os modelos de mensagens de texto automáticas para os clientes.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          Configurações de avisos e modelos de mensagem salvas com sucesso!
        </div>
      )}

      {/* 1. Gatilhos de Notificação para o Administrador */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Gatilhos de Notificação para o Administrador
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Defina em quais momentos o sistema deve emitir alertas sobre os prazos dos clientes
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* No dia do vencimento */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notifyOnDueDate
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notifyOnDueDate}
                onChange={() => handleToggleRule('notifyOnDueDate')}
                className="mt-1 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">No dia do vencimento</span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">
                  Alerta no dia exato do vencimento do plano do cliente.
                </span>
              </div>
            </label>

            {/* 1 dia antes */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify1DayBefore
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify1DayBefore}
                onChange={() => handleToggleRule('notify1DayBefore')}
                className="mt-1 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">1 dia antes do vencimento</span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">
                  Lembrete preventivo na véspera do vencimento.
                </span>
              </div>
            </label>

            {/* 3 dias antes */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify3DaysBefore
                ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify3DaysBefore}
                onChange={() => handleToggleRule('notify3DaysBefore')}
                className="mt-1 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">3 dias antes do vencimento</span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">
                  Aviso antecipado de 3 dias para planejamento.
                </span>
              </div>
            </label>

            {/* 1 dia de atraso */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify1DayAfter
                ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify1DayAfter}
                onChange={() => handleToggleRule('notify1DayAfter')}
                className="mt-1 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">1 dia de atraso (Vencido)</span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">
                  Notifica quando uma fatura completa 1 dia em aberto após o prazo.
                </span>
              </div>
            </label>

            {/* 3 dias de atraso */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify3DaysAfter
                ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify3DaysAfter}
                onChange={() => handleToggleRule('notify3DaysAfter')}
                className="mt-1 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
              />
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-800 block">3 dias de atraso (Vencido)</span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">
                  Alerta crítico para faturas com 3 ou mais dias de atraso.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Modo de Abertura do WhatsApp / WhatsApp Business */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-2xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                Modo de Disparo do WhatsApp & WhatsApp Business
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Escolha como o sistema abre o WhatsApp para obter máxima velocidade
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Direct App / WhatsApp Business */}
            <button
              type="button"
              onClick={() => handleSelectWhatsAppMethod('direct_app')}
              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                (formData.whatsappMethod || 'direct_app') === 'direct_app'
                  ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </span>
                  {(formData.whatsappMethod || 'direct_app') === 'direct_app' && (
                    <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-extrabold uppercase">
                      Recomendado
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    ⚡ App Direto (WhatsApp / Business)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Abre o aplicativo do <strong>WhatsApp ou WhatsApp Business</strong> diretamente no seu aparelho sem passar por páginas intermediárias.
                  </p>
                </div>
              </div>
            </button>

            {/* WhatsApp Web */}
            <button
              type="button"
              onClick={() => handleSelectWhatsAppMethod('web')}
              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                formData.whatsappMethod === 'web'
                  ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="p-2 bg-blue-100 text-blue-800 rounded-lg shrink-0">
                    <Globe className="w-4 h-4" />
                  </span>
                  {formData.whatsappMethod === 'web' && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-extrabold uppercase">
                      Ativo
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    🌐 WhatsApp Web (Navegador)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Abre direto no <code>web.whatsapp.com</code> sem passar pelo <code>wa.me</code>. Excelente para uso no computador.
                  </p>
                </div>
              </div>
            </button>

            {/* Universal wa.me */}
            <button
              type="button"
              onClick={() => handleSelectWhatsAppMethod('wame')}
              className={`p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                formData.whatsappMethod === 'wame'
                  ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="p-2 bg-purple-100 text-purple-800 rounded-lg shrink-0">
                    <ExternalLink className="w-4 h-4" />
                  </span>
                  {formData.whatsappMethod === 'wame' && (
                    <span className="px-2 py-0.5 bg-purple-600 text-white rounded-full text-[10px] font-extrabold uppercase">
                      Ativo
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    🔗 Link Universal (wa.me)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Utiliza o link padrão <code>wa.me</code> do WhatsApp.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Modelos de Mensagem do WhatsApp para os Clientes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Modelos de Mensagem de Texto do WhatsApp
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Textos pré-formatados enviados aos clientes com preenchimento dinâmico de dados
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Template Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTemplateTab('standard')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTemplateTab === 'standard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              1. Mensagem de Cobrança / Vencimento
            </button>

            <button
              type="button"
              onClick={() => setActiveTemplateTab('renewal')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTemplateTab === 'renewal'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              2. Confirmação de Renovação de Acesso
            </button>

            <button
              type="button"
              onClick={() => setActiveTemplateTab('reminder')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTemplateTab === 'reminder'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              3. Lembrete Preventivo (3 Dias Antes)
            </button>
          </div>

          {/* Active Template Form Section */}
          {activeTemplateTab === 'standard' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Texto Padrão de Cobrança / Aviso de Vencimento
                </label>
                {formData.messageTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, messageTemplate: '' };
                      setFormData(updated);
                      onSaveSettings(updated);
                    }}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Deixar em Branco (Mensagem Livre)
                  </button>
                )}
              </div>

              {/* Tag Insertion Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Inserir Tags:</span>
                {['{nome}', '{vencimento}', '{valor}', '{empresa}', '{pix}'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleInsertTag(t, 'messageTemplate')}
                    className="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg text-[11px] font-mono font-bold border border-slate-200 shadow-2xs transition-colors"
                  >
                    +{t}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={formData.messageTemplate ?? ''}
                onChange={(e) => {
                  const updated = { ...formData, messageTemplate: e.target.value };
                  setFormData(updated);
                }}
                placeholder="Ex: Olá {nome}, seu plano vence em {vencimento}. Valor: {valor}. Chave PIX: {pix}. Atenciosamente, {empresa}."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none leading-relaxed font-mono"
              />
            </div>
          )}

          {activeTemplateTab === 'renewal' && (
            <div className="space-y-4">
              {/* Botão Geral Liga / Desliga para Mensagem de Renovação */}
              <div className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                formData.enableRenewalWhatsAppMessage ?? true
                  ? 'bg-blue-50/80 border-blue-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    formData.enableRenewalWhatsAppMessage ?? true
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Power className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Envio de Mensagem de Renovação
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono ${
                        formData.enableRenewalWhatsAppMessage ?? true
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}>
                        {(formData.enableRenewalWhatsAppMessage ?? true) ? 'Ligado' : 'Desligado'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Quando ativado, o modal de renovação vem pronto para disparar a confirmação de renovação no WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      const current = formData.enableRenewalWhatsAppMessage ?? true;
                      const updated = {
                        ...formData,
                        enableRenewalWhatsAppMessage: !current,
                      };
                      setFormData(updated);
                      onSaveSettings(updated);
                    }}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      (formData.enableRenewalWhatsAppMessage ?? true) ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-xs ${
                        (formData.enableRenewalWhatsAppMessage ?? true) ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Texto do Modelo de Renovação
                </label>
                {formData.renewalMessageTemplate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, renewalMessageTemplate: '' })}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Deixar em Branco
                  </button>
                )}
              </div>

              {/* Tag Insertion Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Inserir Tags:</span>
                {['{nome}', '{vencimento}', '{valor}', '{empresa}'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleInsertTag(t, 'renewalMessageTemplate')}
                    className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-mono font-bold border border-slate-200 shadow-2xs transition-colors"
                  >
                    +{t}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={formData.renewalMessageTemplate ?? ''}
                onChange={(e) => setFormData({ ...formData, renewalMessageTemplate: e.target.value })}
                placeholder="Ex: Olá {nome}, seu plano foi renovado com sucesso! Seu novo vencimento é {vencimento}. Obrigado pela confiança!"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none leading-relaxed font-mono"
              />
            </div>
          )}

          {activeTemplateTab === 'reminder' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Texto de Lembrete Preventivo (3 Dias Antes)
                </label>
                {formData.reminderMessageTemplate && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, reminderMessageTemplate: '' })}
                    className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Deixar em Branco
                  </button>
                )}
              </div>

              {/* Tag Insertion Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mr-1">Inserir Tags:</span>
                {['{nome}', '{vencimento}', '{valor}', '{empresa}'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleInsertTag(t, 'reminderMessageTemplate')}
                    className="px-2 py-1 bg-white hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-lg text-[11px] font-mono font-bold border border-slate-200 shadow-2xs transition-colors"
                  >
                    +{t}
                  </button>
                ))}
              </div>

              <textarea
                rows={5}
                value={formData.reminderMessageTemplate ?? ''}
                onChange={(e) => setFormData({ ...formData, reminderMessageTemplate: e.target.value })}
                placeholder="Ex: Olá {nome}, estamos passando para lembrar que sua fatura vence em {vencimento}. Qualquer dúvida estamos à disposição!"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none leading-relaxed font-mono"
              />
            </div>
          )}

          {/* Live WhatsApp Bubble Preview */}
          <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                Pré-visualização da Mensagem de Texto
              </span>
              <button
                type="button"
                onClick={handleTestAutomatedSend}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                📱 Testar Envio no WhatsApp
              </button>
            </div>

            <div className="bg-[#EFEAE2] p-4 rounded-xl shadow-inner max-w-lg">
              <div className="bg-white text-slate-800 text-xs p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-2 leading-relaxed font-sans relative">
                <p className="whitespace-pre-wrap">{getPreviewText()}</p>
                <div className="text-[10px] text-slate-400 text-right font-mono flex items-center justify-end gap-1 pt-1">
                  12:45 <Check className="w-3.5 h-3.5 text-blue-500 inline" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Salvar Modelos de Mensagem
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
