import React, { useState, useEffect } from 'react';
import {
  Bell,
  MessageSquare,
  Sparkles,
  Save,
  CheckCircle2,
  XCircle,
  Tag,
  Eye,
  Check,
  Send,
  AlertTriangle,
  Clock,
  Calendar,
  AlertCircle,
  Power,
  Zap,
  Globe,
  ExternalLink,
  Smartphone,
  Image as ImageIcon,
  Layers,
  FileText,
  Upload,
  Trash2,
  ZoomIn,
  Info
} from 'lucide-react';
import { CompanySettings, NotificationRules, MessageSendMode } from '../types';
import { defaultNotificationRules } from '../utils/notifications';
import { processTemplateImage, downloadImage } from '../utils/imageHelper';
import { sendAutomatedWhatsApp } from '../utils/automatedSender';

interface NoticesConfigViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
}

export const NoticesConfigView: React.FC<NoticesConfigViewProps> = ({ settings, onSaveSettings }) => {
  const [formData, setFormData] = useState<CompanySettings>(settings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'standard' | 'renewal' | 'reminder'>('standard');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [zoomPreview, setZoomPreview] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (!isTyping) {
      setFormData(settings);
    }
  }, [settings]);

  const handleImageFile = async (file: File) => {
    setImageError(null);
    setUploadingImage(true);
    try {
      const processed = await processTemplateImage(file);
      const updated: CompanySettings = {
        ...formData,
        messageTemplateImage: processed.dataUrl,
        messageTemplateImageName: processed.name,
        // Auto select image_and_text if mode was previously text_only or unset
        messageSendMode:
          formData.messageSendMode === 'text_only' || !formData.messageSendMode
            ? 'image_and_text'
            : formData.messageSendMode,
      };
      setFormData(updated);
      onSaveSettings(updated);
    } catch (err: any) {
      setImageError(err?.message || 'Erro ao processar imagem (.jpg ou .png).');
    } finally {
      setUploadingImage(false);
    }
  };

  const currentRules: NotificationRules = formData.notificationRules || defaultNotificationRules;

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
      id: 'teste_envio_automatico',
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
          Avisos & Modelos do WhatsApp
        </h1>
        <p className="text-slate-500 text-xs font-mono mt-0.5">
          Configure os gatilhos de alerta para o administrador e personalize os modelos de mensagens automáticas para os clientes.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          Configurações de avisos e mensagens salvas com sucesso!
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
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  No dia do vencimento
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Dispara no dia exato em que o prazo do cliente expira.
                </p>
              </div>
            </label>

            {/* 1 dia antes */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify1DayBefore
                ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify1DayBefore}
                onChange={() => handleToggleRule('notify1DayBefore')}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  1 dia antes (Véspera)
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Alerta preventivo 24h antes do vencimento para antecipar cobranças.
                </p>
              </div>
            </label>

            {/* 3 dias antes */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify3DaysBefore
                ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify3DaysBefore}
                onChange={() => handleToggleRule('notify3DaysBefore')}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  3 dias antes
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Lembrete de vencimento aproximando-se em 3 dias.
                </p>
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
                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  1 dia de atraso (Ontem)
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Alerta imediato quando o cliente venceu no dia anterior.
                </p>
              </div>
            </label>

            {/* 3 dias de atraso */}
            <label className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
              currentRules.notify3DaysAfter
                ? 'bg-red-50/70 border-red-300 ring-2 ring-red-400/20'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
              <input
                type="checkbox"
                checked={currentRules.notify3DaysAfter}
                onChange={() => handleToggleRule('notify3DaysAfter')}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-slate-300 mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-bold text-xs text-red-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  3 dias de atraso
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Alerta para casos de inadimplência prolongada de 3+ dias.
                </p>
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
              onClick={() => {
                const updated = { ...formData, whatsappMethod: 'direct_app' as const };
                setFormData(updated);
                onSaveSettings(updated);
              }}
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
                      Recomendado (Ultra Rápido)
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    ⚡ App Direto (WhatsApp / Business)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Abre o aplicativo do <strong>WhatsApp ou WhatsApp Business</strong> diretamente no seu aparelho sem passar por páginas do navegador.
                  </p>
                </div>
              </div>
            </button>

            {/* WhatsApp Web */}
            <button
              type="button"
              onClick={() => {
                const updated = { ...formData, whatsappMethod: 'web' as const };
                setFormData(updated);
                onSaveSettings(updated);
              }}
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
                    Abre direto no <code>web.whatsapp.com</code> sem passar pelo <code>wa.me</code>. Excelente se você usa no computador.
                  </p>
                </div>
              </div>
            </button>

            {/* Universal wa.me */}
            <button
              type="button"
              onClick={() => {
                const updated = { ...formData, whatsappMethod: 'wame' as const };
                setFormData(updated);
                onSaveSettings(updated);
              }}
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
                    Utiliza o link padrão <code>wa.me</code> do WhatsApp com tela do navegador.
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
                Modelos de Mensagem do WhatsApp para os Clientes
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
            <div className="space-y-6">
              {/* 1. Escolha do Modo de Envio (Foto, Texto ou Foto e Texto Juntos) */}
              <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Modo de Envio do Aviso de Vencimento
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Escolha como deseja enviar este aviso: foto com texto, apenas foto ou somente o texto.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-slate-200 text-slate-700 self-start sm:self-auto">
                    {formData.messageSendMode === 'image_only'
                      ? 'Apenas Foto Ativo'
                      : formData.messageSendMode === 'text_only'
                      ? 'Apenas Texto Ativo'
                      : 'Foto e Texto Juntos Ativo'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Option 1: Foto e Texto Juntos */}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, messageSendMode: 'image_and_text' as MessageSendMode };
                      setFormData(updated);
                      onSaveSettings(updated);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      (formData.messageSendMode ?? (formData.messageTemplateImage ? 'image_and_text' : 'text_only')) === 'image_and_text'
                        ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-700">
                        <Layers className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800">
                        Recomendado
                      </span>
                    </div>
                    <span className="text-xs font-bold block text-slate-900">Foto e Texto Juntos</span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Envia o flyer/arte com o texto contendo dados do cliente, vencimento e chave PIX.
                    </p>
                  </button>

                  {/* Option 2: Apenas Foto */}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, messageSendMode: 'image_only' as MessageSendMode };
                      setFormData(updated);
                      onSaveSettings(updated);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      formData.messageSendMode === 'image_only'
                        ? 'bg-blue-50/90 border-blue-500 text-blue-950 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="p-2 rounded-xl bg-blue-100/80 text-blue-700">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-200/60 text-blue-800">
                        Flyer / Cartaz
                      </span>
                    </div>
                    <span className="text-xs font-bold block text-slate-900">Apenas Foto</span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Envia somente a foto/flyer de aviso sem texto acompanhando.
                    </p>
                  </button>

                  {/* Option 3: Apenas Texto */}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...formData, messageSendMode: 'text_only' as MessageSendMode };
                      setFormData(updated);
                      onSaveSettings(updated);
                    }}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      formData.messageSendMode === 'text_only'
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className={`p-2 rounded-xl ${formData.messageSendMode === 'text_only' ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-700'}`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${formData.messageSendMode === 'text_only' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                        Tradicional
                      </span>
                    </div>
                    <span className={`text-xs font-bold block ${formData.messageSendMode === 'text_only' ? 'text-white' : 'text-slate-900'}`}>
                      Apenas Texto
                    </span>
                    <p className={`text-[11px] mt-1 leading-snug ${formData.messageSendMode === 'text_only' ? 'text-slate-300' : 'text-slate-500'}`}>
                      Envia somente a mensagem de texto tradicional, sem anexo de foto.
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Campo de Imagem Template (.jpg, .jpeg, .png) */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-600" />
                      Imagem / Flyer do Aviso de Vencimento (.jpg e .png)
                    </label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Adicione uma foto, flyer ou arte de cobrança para enviar aos clientes.
                    </p>
                  </div>
                  {formData.messageTemplateImage && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...formData,
                          messageTemplateImage: '',
                          messageTemplateImageName: '',
                          messageSendMode: formData.messageSendMode === 'image_only' ? 'text_only' : formData.messageSendMode,
                        };
                        setFormData(updated);
                        onSaveSettings(updated);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remover Foto
                    </button>
                  )}
                </div>

                {imageError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{imageError}</span>
                  </div>
                )}

                {/* Se não houver imagem carregada: Dropzone */}
                {!formData.messageTemplateImage ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleImageFile(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
                      isDragOver
                        ? 'border-emerald-500 bg-emerald-50/60 scale-[1.01]'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
                    }`}
                  >
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-slate-800">
                          Arraste e solte sua imagem aqui ou clique para selecionar
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 font-mono">
                          Formatos aceitos: <strong>.JPG</strong>, <strong>.JPEG</strong> e <strong>.PNG</strong>
                        </p>
                      </div>

                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs active:scale-95">
                        <Upload className="w-4 h-4" />
                        <span>{uploadingImage ? 'Processando Imagem...' : 'Escolher Imagem (.jpg / .png)'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                          className="hidden"
                          disabled={uploadingImage}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  /* Se já houver imagem carregada: Card de Preview */
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center shadow-xs">
                        <img
                          src={formData.messageTemplateImage}
                          alt="Template de Aviso"
                          className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                          onClick={() => setZoomPreview(true)}
                        />
                        <button
                          type="button"
                          onClick={() => setZoomPreview(true)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                          title="Ampliar Imagem"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 truncate block max-w-[200px] sm:max-w-xs">
                            {formData.messageTemplateImageName || 'flyer-vencimento.jpg'}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full shrink-0">
                            Pronta para Envio
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono">
                          Formatos .JPG e .PNG suportados • Otimizada automaticamente
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setZoomPreview(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <ZoomIn className="w-3.5 h-3.5" /> Ver Ampliada
                          </button>
                          <span className="text-slate-300">•</span>
                          <button
                            type="button"
                            onClick={() => downloadImage(formData.messageTemplateImage!, formData.messageTemplateImageName || 'aviso.jpg')}
                            className="text-xs text-slate-600 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            Baixar Imagem
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <label className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Trocar Imagem</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Banner e Configuração de Envio com Foto */}
              {formData.messageTemplateImage && formData.messageSendMode !== 'text_only' && (
                <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl space-y-4 shadow-2xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                            Envio de Aviso com Foto Configurado
                          </h4>
                          <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-extrabold rounded-full">
                            Ativo
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                          • <strong>No Computador / WhatsApp Web:</strong> O app copia a foto para a área de transferência e abre a conversa com o texto. Basta teclar <strong>Ctrl + V</strong> (Colar) para enviar a imagem na hora!<br />
                          • <strong>No Celular:</strong> O app abre o compartilhamento do aparelho já com a foto anexada e a mensagem pronta.<br />
                          • <strong>Cartaz Oficial Online:</strong> A mensagem enviada também inclui o link direto para o cliente abrir o cartaz oficial com os dados de pagamento.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestAutomatedSend}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer shrink-0 self-stretch sm:self-auto justify-center"
                    >
                      <MessageSquare className="w-4 h-4 fill-white" />
                      <span>📱 Testar Envio Agora</span>
                    </button>
                  </div>

                  {/* Alternador de Modo de Envio: Direto vs Janela de Confirmação */}
                  <div className="pt-2 border-t border-emerald-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-950">
                      Ao tocar no WhatsApp na lista de clientes:
                    </span>
                    <div className="inline-flex rounded-xl bg-emerald-200/60 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...formData, autoSendDirect: true };
                          setFormData(updated);
                          onSaveSettings(updated);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          formData.autoSendDirect !== false
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-emerald-900 hover:bg-emerald-200'
                        }`}
                      >
                        ⚡ Envio Direto (1 Clique)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...formData, autoSendDirect: false };
                          setFormData(updated);
                          onSaveSettings(updated);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          formData.autoSendDirect === false
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'text-emerald-900 hover:bg-emerald-200'
                        }`}
                      >
                        🖼️ Abrir Janela com Prévia da Foto
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Área de Criação de Texto Padrão */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Texto Padrão de Cobrança / Aviso de Vencimento
                    </label>
                    {formData.messageSendMode === 'image_only' && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full">
                        Texto Inativo (Modo Apenas Foto ativo)
                      </span>
                    )}
                  </div>
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
                      className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-mono font-bold border border-slate-200 shadow-2xs transition-colors"
                    >
                      +{t}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={4}
                  value={formData.messageTemplate ?? ''}
                  onChange={(e) => {
                    const updated = { ...formData, messageTemplate: e.target.value };
                    setFormData(updated);
                  }}
                  placeholder="Ex: Olá {nome}, seu plano vence em {vencimento}. Valor: {valor}. Chave PIX: {pix}. Atenciosamente, {empresa}."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none leading-relaxed font-mono"
                />
              </div>
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
                      Quando ativado, o modal de renovação vem pronto para disparar a confirmação de renovação no WhatsApp. Se desativado, o envio automático fica desligado.
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
                rows={4}
                value={formData.renewalMessageTemplate ?? ''}
                onChange={(e) => setFormData({ ...formData, renewalMessageTemplate: e.target.value })}
                placeholder="Ex: Olá {nome}, seu plano foi renovado com sucesso! Seu novo vencimento é {vencimento}. Obrigado pela confiança!"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none leading-relaxed font-mono"
              />
            </div>
          )}

          {activeTemplateTab === 'reminder' && (
            <div className="space-y-3">
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
                    className="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-mono font-bold border border-slate-200 shadow-2xs transition-colors"
                  >
                    +{t}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
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
                Pré-visualização do WhatsApp
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {activeTemplateTab === 'standard' && formData.messageSendMode === 'image_only'
                  ? 'Exibição: Apenas Foto'
                  : activeTemplateTab === 'standard' && (formData.messageSendMode === 'image_and_text' || (!formData.messageSendMode && formData.messageTemplateImage))
                  ? 'Exibição: Foto + Texto Juntos'
                  : 'Exibição: Mensagem de Texto'}
              </span>
            </div>

            <div className="bg-[#EFEAE2] p-4 rounded-xl shadow-inner max-w-lg">
              <div className="bg-white text-slate-800 text-xs p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-2 leading-relaxed font-sans relative">
                {/* Standard template with image */}
                {activeTemplateTab === 'standard' && formData.messageTemplateImage && formData.messageSendMode !== 'text_only' && (
                  <div className="rounded-xl overflow-hidden border border-slate-200/60 bg-slate-100 relative group">
                    <img
                      src={formData.messageTemplateImage}
                      alt="Banner Preview"
                      className="w-full max-h-56 object-contain rounded-xl cursor-pointer"
                      onClick={() => setZoomPreview(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setZoomPreview(true)}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <ZoomIn className="w-3 h-3" />
                      <span>Ampliar</span>
                    </button>
                  </div>
                )}

                {/* Text portion (if not image_only) */}
                {!(activeTemplateTab === 'standard' && formData.messageSendMode === 'image_only') && (
                  <p className="whitespace-pre-wrap">{getPreviewText()}</p>
                )}

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
              Salvar Modelos de Avisos
            </button>
          </div>
        </form>
      </div>

      {/* Lightbox Zoom Modal */}
      {zoomPreview && formData.messageTemplateImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setZoomPreview(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={formData.messageTemplateImage}
              alt="Ampliada"
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoomPreview(false)}
              className="mt-3 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold backdrop-blur-xs cursor-pointer"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
