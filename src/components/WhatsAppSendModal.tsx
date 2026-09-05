import React, { useState } from 'react';
import {
  X,
  MessageSquare,
  Image as ImageIcon,
  FileText,
  Layers,
  Copy,
  Check,
  Download,
  ExternalLink,
  Share2,
  AlertCircle,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { Client, Charge, CompanySettings, MessageSendMode } from '../types';
import { getDefaultMessage, openWhatsAppLink, formatDateTimeBR, dateBR } from '../utils/formatters';
import {
  copyImageToClipboard,
  copyTextToClipboard,
  downloadImage,
} from '../utils/imageHelper';
import { sendAutomatedWhatsApp } from '../utils/automatedSender';

interface WhatsAppSendModalProps {
  isOpen: boolean;
  client: Client | null;
  charge?: Charge | null;
  settings: CompanySettings;
  onClose: () => void;
  onConfirmSent: (client: Client, charge: Charge | null | undefined, messageText: string) => void;
}

export const WhatsAppSendModal: React.FC<WhatsAppSendModalProps> = ({
  isOpen,
  client,
  charge,
  settings,
  onClose,
  onConfirmSent,
}) => {
  if (!isOpen || !client) return null;

  // Initial send mode from settings, or fallback to 'image_and_text' if image exists, otherwise 'text_only'
  const initialMode: MessageSendMode =
    settings.messageSendMode || (settings.messageTemplateImage ? 'image_and_text' : 'text_only');

  const [selectedMode, setSelectedMode] = useState<MessageSendMode>(initialMode);
  const [copiedImage, setCopiedImage] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [zoomImage, setZoomImage] = useState(false);
  const [noticeToast, setNoticeToast] = useState<string | null>(null);

  const hasImage = Boolean(settings.messageTemplateImage);
  const imageSrc = settings.messageTemplateImage || '';
  const imageName = settings.messageTemplateImageName || 'aviso-vencimento.jpg';

  // Compute personalized text
  const fullText = getDefaultMessage(client, charge, settings);
  const textToSend = selectedMode === 'image_only' ? '' : fullText;

  const showToastNotice = (msg: string) => {
    setNoticeToast(msg);
    setTimeout(() => setNoticeToast(null), 4500);
  };

  const handleCopyImage = async () => {
    if (!imageSrc) return;
    const ok = await copyImageToClipboard(imageSrc);
    if (ok) {
      setCopiedImage(true);
      showToastNotice('✅ Foto copiada para a área de transferência! No WhatsApp, basta pressionar Ctrl + V.');
      setTimeout(() => setCopiedImage(false), 3000);
    } else {
      showToastNotice('⚠️ Não foi possível copiar direto. Use o botão de Baixar Foto para anexar.');
    }
  };

  const handleCopyText = async () => {
    if (!fullText) return;
    const ok = await copyTextToClipboard(fullText);
    if (ok) {
      setCopiedText(true);
      showToastNotice('✅ Texto da mensagem copiado!');
      setTimeout(() => setCopiedText(false), 2500);
    }
  };

  const handleDownload = () => {
    if (!imageSrc) return;
    downloadImage(imageSrc, imageName);
    showToastNotice('📥 Imagem baixada com sucesso!');
  };

  // Primary automated sending handler
  const handleProceedSend = async () => {
    setIsSending(true);

    try {
      const result = await sendAutomatedWhatsApp({
        client,
        charge,
        settings: {
          ...settings,
          messageSendMode: selectedMode,
        },
        onConfirmSent,
      });

      if (!result.aborted) {
        onClose();
      }
    } catch (err) {
      console.warn('Proceed send error:', err);
      openWhatsAppLink(client.phone, textToSend, settings);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const dueLabel = charge
    ? charge.dueTime
      ? `${dateBR(charge.dueDate)} às ${charge.dueTime}`
      : dateBR(charge.dueDate)
    : client.dueDate
    ? formatDateTimeBR(client.dueDate)
    : 'A definir';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                Enviar Aviso no WhatsApp
                <span className="text-[11px] font-medium bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {selectedMode === 'image_and_text' && 'Foto + Texto'}
                  {selectedMode === 'image_only' && 'Apenas Foto'}
                  {selectedMode === 'text_only' && 'Apenas Texto'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cliente: <strong className="text-white">{client.name}</strong> • Tel: {client.phone || '—'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Notification Toast Message */}
          {noticeToast && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2 animate-fadeIn">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{noticeToast}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Escolha como deseja enviar este aviso:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMode('image_and_text')}
                disabled={!hasImage}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  selectedMode === 'image_and_text'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : hasImage
                    ? 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    : 'border-slate-200 bg-slate-100/60 text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Layers className={`w-4 h-4 ${selectedMode === 'image_and_text' ? 'text-emerald-600' : 'text-slate-500'}`} />
                  {selectedMode === 'image_and_text' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">Foto e Texto</span>
                  <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">Imagem + Legenda</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('image_only')}
                disabled={!hasImage}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  selectedMode === 'image_only'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                    : hasImage
                    ? 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                    : 'border-slate-200 bg-slate-100/60 text-slate-400 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <ImageIcon className={`w-4 h-4 ${selectedMode === 'image_only' ? 'text-blue-600' : 'text-slate-500'}`} />
                  {selectedMode === 'image_only' && (
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">Apenas Foto</span>
                  <span className="text-[10px] text-slate-500 hidden sm:block mt-0.5">Somente a Arte</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMode('text_only')}
                className={`p-2.5 sm:p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  selectedMode === 'text_only'
                    ? 'border-slate-800 bg-slate-900 text-white ring-2 ring-slate-800/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <FileText className={`w-4 h-4 ${selectedMode === 'text_only' ? 'text-white' : 'text-slate-500'}`} />
                  {selectedMode === 'text_only' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  )}
                </div>
                <div>
                  <span className="text-xs font-bold block leading-tight">Apenas Texto</span>
                  <span className={`text-[10px] hidden sm:block mt-0.5 ${selectedMode === 'text_only' ? 'text-slate-300' : 'text-slate-500'}`}>
                    Mensagem Padrão
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* WhatsApp Preview Bubble */}
          <div className="bg-[#EFEAE2] p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-inner">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Pré-visualização do Envio</span>
              <span className="text-emerald-700 font-medium">Vencimento: {dueLabel}</span>
            </div>

            <div className="bg-white rounded-2xl rounded-tl-xs p-3 shadow-xs max-w-md space-y-2 text-slate-800">
              {/* Image if mode requires it */}
              {(selectedMode === 'image_and_text' || selectedMode === 'image_only') && hasImage && (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200/60 bg-slate-100">
                  <img
                    src={imageSrc}
                    alt="Template de Cobrança"
                    className="w-full max-h-56 object-contain cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => setZoomImage(true)}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={handleCopyImage}
                      title="Copiar Imagem (Ctrl+V)"
                      className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-[10px] backdrop-blur-xs flex items-center gap-1 cursor-pointer shadow-xs"
                    >
                      {copiedImage ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="text-[10px]">Copiar Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownload}
                      title="Baixar Imagem"
                      className="p-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-lg text-[10px] backdrop-blur-xs cursor-pointer shadow-xs"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {/* Text if mode requires it */}
              {(selectedMode === 'image_and_text' || selectedMode === 'text_only') && (
                <div className="pt-1">
                  <p className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-slate-800">
                    {fullText}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono pt-1">
                <span>Hoje</span>
                <span className="text-blue-500 font-bold">✓✓</span>
              </div>
            </div>
          </div>

          {/* Fast Helper Tip */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-950 leading-relaxed">
              {selectedMode !== 'text_only' && hasImage ? (
                <span>
                  <strong>⚡ Envio 100% Automatizado:</strong> Ao clicar no botão abaixo, o aplicativo já anexa a foto e preenche a mensagem automaticamente no WhatsApp para enviar na hora. Sem precisar baixar arquivos nem buscar em anexos manualmente!
                </span>
              ) : (
                <span>
                  <strong>Envio em texto:</strong> O WhatsApp abrirá diretamente com a mensagem formatada para o cliente.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5">
            {hasImage && selectedMode !== 'text_only' && (
              <>
                <button
                  type="button"
                  onClick={handleCopyImage}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  {copiedImage ? 'Foto Copiada!' : 'Copiar Foto'}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center transition-colors cursor-pointer"
                  title="Baixar imagem no computador/celular"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </>
            )}

            {selectedMode !== 'image_only' && (
              <button
                type="button"
                onClick={handleCopyText}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                {copiedText ? 'Texto Copiado!' : 'Copiar Texto'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleProceedSend}
              disabled={isSending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 fill-white" />
              <span>⚡ Enviar Foto e Mensagem Agora</span>
              <ExternalLink className="w-3.5 h-3.5 text-emerald-200" />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setZoomImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img src={imageSrc} alt="Zoom" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            <button
              type="button"
              onClick={() => setZoomImage(false)}
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
