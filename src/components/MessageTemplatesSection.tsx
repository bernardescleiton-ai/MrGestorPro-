import React from 'react';
import { MessageSquare, Save, XCircle, Eye, Check, Power, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { uploadWhatsAppMedia, deleteWhatsAppMedia } from '../lib/whatsappMedia';
import { MediaPreview } from './MediaPreview';
import type { CompanySettings } from '../types';
export const MessageTemplatesSection: React.FC<{ formData: CompanySettings; setFormData: React.Dispatch<React.SetStateAction<CompanySettings>>; activeTemplateTab: 'standard' | 'renewal' | 'reminder'; setActiveTemplateTab: (tab: 'standard' | 'renewal' | 'reminder') => void; onInsertTag: (tag: string, targetField: 'messageTemplate' | 'renewalMessageTemplate' | 'reminderMessageTemplate') => void; onTestAutomatedSend: () => void; getPreviewText: () => string; onSubmit: (e: React.FormEvent) => void; onSaveSettings: (settings: CompanySettings) => void; }> = ({ formData, setFormData, activeTemplateTab, setActiveTemplateTab, onInsertTag, onTestAutomatedSend, getPreviewText, onSubmit, onSaveSettings }) => {
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState('');

  const handleMediaUpload = async (file?: File) => {
    if (!file) return;
    setMediaError('');
    setMediaUploading(true);
    try {
      const uploaded = await uploadWhatsAppMedia(file, `wa-${crypto.randomUUID()}`);
      const previous = formData.whatsappMedia;
      const updated = { ...formData, whatsappMedia: uploaded };
      setFormData(updated);
      onSaveSettings(updated);
      if (previous && previous.id !== uploaded.id) {
        await deleteWhatsAppMedia(previous);
      }
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Não foi possível salvar a mídia.');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleRemoveMedia = async () => {
    const media = formData.whatsappMedia;
    const updated = { ...formData };
    delete updated.whatsappMedia;
    setFormData(updated);
    onSaveSettings(updated);
    if (media) await deleteWhatsAppMedia(media);
  };

  return (
<>
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
        <form onSubmit={onSubmit} className="p-6 space-y-6">
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
                    onClick={() => onInsertTag(t, 'messageTemplate')}
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
                    onClick={() => onInsertTag(t, 'renewalMessageTemplate')}
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
                    onClick={() => onInsertTag(t, 'reminderMessageTemplate')}
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
          {/* Media attachment - kept inside the existing message area */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-700">📎 Imagem ou vídeo</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Salve uma mídia para ela acompanhar o texto ao clicar em WhatsApp.</p>
              </div>
              <label className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${mediaUploading ? 'bg-slate-200 text-slate-400 cursor-wait' : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'}`}>
                📎 {mediaUploading ? 'Salvando...' : 'Anexar'}
                <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" disabled={mediaUploading} onChange={(e) => { void handleMediaUpload(e.target.files?.[0]); e.currentTarget.value = ''; }} className="hidden" />
              </label>
            </div>
            {formData.whatsappMedia && (
              <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-emerald-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-300 shrink-0 bg-slate-100 flex items-center justify-center shadow-2xs">
                    <MediaPreview media={formData.whatsappMedia} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{formData.whatsappMedia.type === 'image' ? '🖼️' : '🎥'} {formData.whatsappMedia.name}</p>
                    <p className="text-[10px] text-slate-400">{(formData.whatsappMedia.size / (1024 * 1024)).toFixed(2)} MB · pronto para compartilhar</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleRemoveMedia(); }}
                  className="px-2.5 py-1 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Excluir Imagem
                </button>
              </div>
            )}
            {mediaError && <p className="text-[11px] font-semibold text-rose-600">{mediaError}</p>}
          </div>
          {/* Live WhatsApp Bubble Preview */}
          <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                Pré-visualização da Mensagem de Texto
              </span>
              <button
                type="button"
                onClick={onTestAutomatedSend}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                📱 Testar Envio no WhatsApp
              </button>
            </div>
            <div className="bg-[#EFEAE2] p-4 rounded-xl shadow-inner max-w-lg">
              <div className="bg-white text-slate-800 text-xs p-3.5 rounded-2xl rounded-tl-xs shadow-xs space-y-2 leading-relaxed font-sans relative">
                {formData.whatsappMedia && (
                  <div className="rounded-xl overflow-hidden max-h-56 mb-2 border border-slate-200 bg-slate-100 flex items-center justify-center">
                    <MediaPreview media={formData.whatsappMedia} className="w-full max-h-56 object-cover" />
                  </div>
                )}
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
</>
  );
};
