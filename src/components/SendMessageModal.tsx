import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Copy, Download, Check, RefreshCw, Send, Paperclip, Trash2 } from 'lucide-react';
import type { Client, Charge, CompanySettings, WhatsAppMediaAttachment } from '../types';
import { getDefaultMessage, formatPhoneBR, normalizePhone } from '../utils/formatters';
import { copyMediaImageToClipboard, downloadMediaAttachment, sendWhatsAppMessage } from '../utils/whatsappMediaSender';
import { MediaPreview } from './MediaPreview';
import { uploadWhatsAppMedia, deleteWhatsAppMedia } from '../lib/whatsappMedia';

interface SendMessageModalProps {
  isOpen: boolean;
  client: Client | null;
  charge?: Charge | null;
  settings: CompanySettings;
  onClose: () => void;
  onSendConfirm: (client: Client, charge?: Charge, customText?: string) => void;
  onSaveSettings?: (settings: CompanySettings) => void;
}

export const SendMessageModal: React.FC<SendMessageModalProps> = ({
  isOpen,
  client,
  charge,
  settings,
  onClose,
  onSendConfirm,
  onSaveSettings,
}) => {
  const [messageText, setMessageText] = useState('');
  const [activeMedia, setActiveMedia] = useState<WhatsAppMediaAttachment | null>(settings.whatsappMedia || null);
  const [isCopyingImage, setIsCopyingImage] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (client && isOpen) {
      const initialText = getDefaultMessage(client, charge, settings);
      setMessageText(initialText);
      setActiveMedia(settings.whatsappMedia || null);
      setCopySuccess(false);
    }
  }, [client, charge, settings, isOpen]);

  if (!isOpen || !client) return null;
  // A janela flutuante só deve aparecer quando houver imagem/mídia anexada
  if (!settings.whatsappMedia && !activeMedia) return null;

  const formattedPhone = formatPhoneBR(client.phone);
  const isValidPhone = Boolean(normalizePhone(client.phone));

  const handleCopyImage = async () => {
    if (!activeMedia) return;
    setIsCopyingImage(true);
    const success = await copyMediaImageToClipboard(activeMedia);
    setIsCopyingImage(false);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

  const handleDownloadImage = () => {
    if (activeMedia) {
      void downloadMediaAttachment(activeMedia);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploading(true);
    try {
      const previous = activeMedia;
      const uploaded = await uploadWhatsAppMedia(file, `wa-${crypto.randomUUID()}`);
      setActiveMedia(uploaded);
      if (onSaveSettings) {
        onSaveSettings({ ...settings, whatsappMedia: uploaded });
      }
      if (previous && previous.id !== uploaded.id) {
        await deleteWhatsAppMedia(previous);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveMedia = async () => {
    const mediaToRemove = activeMedia;
    setActiveMedia(null);
    if (onSaveSettings) {
      const updated = { ...settings };
      delete updated.whatsappMedia;
      onSaveSettings(updated);
    }
    if (mediaToRemove) {
      await deleteWhatsAppMedia(mediaToRemove);
    }
    onClose();
  };

  const handleSend = async () => {
    if (!client) return;
    await sendWhatsAppMessage({
      phone: client.phone,
      text: messageText,
      settings,
      media: activeMedia,
    });
    onSendConfirm(client, charge, messageText);
    onClose();
  };

  const handleResetTemplate = () => {
    if (client) {
      setMessageText(getDefaultMessage(client, charge, settings));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 tracking-tight truncate">
                Enviar WhatsApp para {client.name}
              </h3>
              <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                <span>📱 {formattedPhone}</span>
                {charge && (
                  <>
                    <span>•</span>
                    <span className="text-emerald-700 font-semibold">
                      Vencimento: {new Date(charge.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Campo de Envio de Mensagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <span>Mensagem de Texto</span>
              </label>
              <button
                type="button"
                onClick={handleResetTemplate}
                className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 flex items-center gap-1 transition-colors"
                title="Recarregar modelo padrão com os dados do cliente"
              >
                <RefreshCw className="w-3 h-3" /> Restaurar Padrão
              </button>
            </div>
            <textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Digite a mensagem para o cliente..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none leading-relaxed font-sans shadow-2xs"
            />
          </div>

          {/* Campo de Envio de Mídia / Imagem Anexada */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Mídia Anexada ao Envio
                </span>
              </div>
            </div>

            {activeMedia ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 bg-white p-3 rounded-xl border border-emerald-200">
                <div className="w-20 h-20 rounded-xl overflow-hidden border border-emerald-300 bg-slate-100 shrink-0 flex items-center justify-center shadow-2xs">
                  <MediaPreview media={activeMedia} className="w-full h-full object-cover" />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {activeMedia.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {(activeMedia.size / (1024 * 1024)).toFixed(2)} MB • {activeMedia.type === 'image' ? 'Imagem' : 'Vídeo'}
                  </p>

                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {activeMedia.type === 'image' && (
                      <button
                        type="button"
                        onClick={handleCopyImage}
                        disabled={isCopyingImage}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                      >
                        {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copySuccess ? 'Copiada!' : 'Copiar Foto (Ctrl+V)'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadImage}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium border border-slate-200 flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" /> Baixar
                    </button>
                    <button
                      type="button"
                      onClick={() => { void handleRemoveMedia(); }}
                      className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-bold border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Excluir imagem anexada"
                    >
                      <Trash2 className="w-3 h-3 text-rose-600" /> Excluir Imagem
                    </button>
                    <label className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-[11px] font-medium border border-slate-200 cursor-pointer flex items-center gap-1 transition-colors">
                      <span>Trocar</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 bg-white/60 rounded-xl border border-dashed border-slate-300 space-y-2">
                <p className="text-xs text-slate-500">Nenhuma imagem anexada para este envio.</p>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                  <span>📎 Anexar Imagem ou Vídeo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>
            )}

            {activeMedia && (
              <div className="p-2.5 bg-emerald-100/60 border border-emerald-300/60 rounded-xl text-[11px] text-emerald-900 leading-relaxed flex items-start gap-2">
                <span className="text-sm">💡</span>
                <div>
                  <strong>Como a imagem é enviada:</strong> Por segurança do WhatsApp, links de internet não anexam arquivos automaticamente no chat. Ao clicar em <em>Abrir WhatsApp e Enviar</em>, a foto é <strong>copiada automaticamente</strong> para você. No WhatsApp, basta pressionar <strong className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-300">Ctrl + V</strong> (Colar) para anexá-la junto do texto!
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 rounded-xl text-xs font-bold border border-slate-200 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSend}
            disabled={!isValidPhone}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 ${
              isValidPhone
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Abrir WhatsApp e Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
