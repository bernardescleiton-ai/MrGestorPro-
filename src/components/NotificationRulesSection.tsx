import React from 'react';
import { Bell, Smartphone, Zap, Globe, ExternalLink } from 'lucide-react';
import type { CompanySettings, NotificationRules } from '../types';
export const NotificationRulesSection: React.FC<{ formData: CompanySettings; currentRules: NotificationRules; onToggleRule: (key: keyof NotificationRules) => void; onSelectWhatsAppMethod: (method: 'direct_app' | 'web' | 'wame') => void; }> = ({ formData, currentRules, onToggleRule, onSelectWhatsAppMethod }) => (
<>
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
                onChange={() => onToggleRule('notifyOnDueDate')}
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
                onChange={() => onToggleRule('notify1DayBefore')}
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
                onChange={() => onToggleRule('notify3DaysBefore')}
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
                onChange={() => onToggleRule('notify1DayAfter')}
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
                onChange={() => onToggleRule('notify3DaysAfter')}
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
              onClick={() => onSelectWhatsAppMethod('direct_app')}
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
              onClick={() => onSelectWhatsAppMethod('web')}
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
              onClick={() => onSelectWhatsAppMethod('wame')}
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
</>
);
