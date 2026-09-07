import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { CompanySettings, NotificationRules } from '../types';
import { NotificationRulesSection } from './NotificationRulesSection';
import { MessageTemplatesSection } from './MessageTemplatesSection';
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
      <NotificationRulesSection
        formData={formData}
        currentRules={currentRules}
        onToggleRule={handleToggleRule}
        onSelectWhatsAppMethod={handleSelectWhatsAppMethod}
      />
      <MessageTemplatesSection
        formData={formData}
        setFormData={setFormData}
        activeTemplateTab={activeTemplateTab}
        setActiveTemplateTab={setActiveTemplateTab}
        onInsertTag={handleInsertTag}
        onTestAutomatedSend={handleTestAutomatedSend}
        getPreviewText={getPreviewText}
        onSubmit={handleSubmit}
        onSaveSettings={onSaveSettings}
      />
    </div>
  );
};
