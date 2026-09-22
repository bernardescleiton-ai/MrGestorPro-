import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Download, FileText, Table, FileCode, Users, Share2 } from 'lucide-react';
import { Client } from '../types';
import { dateBR, formatPhoneNumber, deduplicateClients, formatClientsListForCopy } from '../utils/formatters';

export type ExportFormat = 'detailed' | 'single-line' | 'pipe' | 'csv' | 'json';

interface ExportClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClients: Client[];
  onShowToast?: (title: string, message: string) => void;
}

export const ExportClientsModal: React.FC<ExportClientsModalProps> = ({
  isOpen,
  onClose,
  selectedClients,
  onShowToast,
}) => {
  const [format, setFormat] = useState<ExportFormat>('detailed');
  const [copied, setCopied] = useState(false);

  const uniqueClients = useMemo(() => deduplicateClients(selectedClients), [selectedClients]);

  const generatedContent = useMemo(() => {
    if (!uniqueClients || uniqueClients.length === 0) return '';

    switch (format) {
      case 'detailed': {
        return formatClientsListForCopy(uniqueClients);
      }

      case 'single-line': {
        return uniqueClients
          .map((c) => {
            const cleanName = (c.name || '').trim();
            const dateStr = c.dueDate ? dateBR(c.dueDate.split('T')[0]) : '';
            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            return `${cleanName} - ${cleanPhone} - ${dateStr}`;
          })
          .join('\n');
      }

      case 'pipe': {
        return uniqueClients
          .map((c) => {
            const cleanName = (c.name || '').trim();
            const dateStr = c.dueDate ? dateBR(c.dueDate.split('T')[0]) : '';
            const cleanPhone = (c.phone || '').replace(/\D/g, '');
            return `${cleanName} | ${cleanPhone} | ${dateStr}`;
          })
          .join('\n');
      }

      case 'csv': {
        const header = 'Nome,Telefone,Data de Vencimento';
        const rows = uniqueClients.map((c) => {
          const nameSafe = `"${(c.name || '').replace(/"/g, '""')}"`;
          const cleanPhone = (c.phone || '').replace(/\D/g, '');
          const phoneSafe = `"${cleanPhone.replace(/"/g, '""')}"`;
          const dateStr = c.dueDate ? dateBR(c.dueDate.split('T')[0]) : '';
          const dateSafe = `"${dateStr.replace(/"/g, '""')}"`;
          return `${nameSafe},${phoneSafe},${dateSafe}`;
        });
        return [header, ...rows].join('\n');
      }

      case 'json': {
        const data = uniqueClients.map((c) => ({
          name: (c.name || '').trim(),
          phone: (c.phone || '').replace(/\D/g, ''),
          dueDate: c.dueDate ? dateBR(c.dueDate.split('T')[0]) : '',
        }));
        return JSON.stringify(data, null, 2);
      }

      default:
        return '';
    }
  }, [uniqueClients, format]);


  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedContent);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = generatedContent;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopied(true);
      if (onShowToast) {
        onShowToast('Copiado com Sucesso!', `${selectedClients.length} cliente(s) copiado(s) para a área de transferência.`);
      }
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleDownload = () => {
    try {
      const now = new Date();
      const dateTag = now.toISOString().slice(0, 10);
      const isCsv = format === 'csv';
      const isJson = format === 'json';
      const ext = isCsv ? 'csv' : isJson ? 'json' : 'txt';
      const mimeType = isCsv ? 'text/csv;charset=utf-8;' : isJson ? 'application/json;charset=utf-8;' : 'text/plain;charset=utf-8;';
      const filename = `dados_clientes_${dateTag}.${ext}`;

      const blob = new Blob([generatedContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (onShowToast) {
        onShowToast('Download Iniciado', `Arquivo ${filename} gerado com os dados dos ${selectedClients.length} clientes selecionados.`);
      }
    } catch (err) {
      console.error('Falha ao baixar arquivo:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-slate-800">Copiar & Gerar Arquivo de Clientes</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                  {selectedClients.length} {selectedClients.length === 1 ? 'cliente' : 'clientes'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Dados com Nome, Telefone e Data de Vencimento prontos para cópia ou download
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-200/60 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Format Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
              Selecione o Formato do Arquivo / Texto:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFormat('detailed')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  format === 'detailed'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Lista Detalhada</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Ideal para WhatsApp ou bloco de notas</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('single-line')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  format === 'single-line'
                    ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Nome - Tel - Venc</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Linha por linha compacto</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  format === 'csv'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Planilha CSV</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Compatível com Excel e Google Planilhas</span>
              </button>

              <button
                type="button"
                onClick={() => setFormat('pipe')}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  format === 'pipe'
                    ? 'bg-purple-50 border-purple-500 text-purple-900 ring-2 ring-purple-500/20'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <FileCode className="w-3.5 h-3.5 text-purple-600" />
                  <span>Padrão Pipe (|)</span>
                </div>
                <span className="text-[10px] text-slate-500 mt-1">Pronto para importar em outros sistemas</span>
              </button>
            </div>
          </div>

          {/* Preview Container */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                <span>Prévia dos Dados ({selectedClients.length} clientes)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {generatedContent.length} caracteres • {generatedContent.split('\n').length} linhas
              </span>
            </div>
            <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-900 shadow-inner">
              <textarea
                readOnly
                value={generatedContent}
                rows={10}
                className="w-full p-4 text-xs font-mono text-emerald-400 bg-transparent resize-none outline-none leading-relaxed selection:bg-blue-500 selection:text-white"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <div className="text-xs text-slate-500 font-mono">
            {selectedClients.length} cliente{selectedClients.length > 1 ? 's' : ''} com Nome, Telefone e Vencimento
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4 text-blue-600" />}
              <span>{copied ? 'Dados Copiados!' : 'Copiar Dados'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Arquivo ({format === 'csv' ? '.csv' : 'txt'})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
