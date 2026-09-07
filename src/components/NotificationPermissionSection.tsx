import React from 'react';
import { Smartphone, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

export const NotificationPermissionSection: React.FC<{
  permStatus: string;
  onRequestPermission: () => void;
  onTestNotification: () => void;
}> = ({ permStatus, onRequestPermission, onTestNotification }) => (
<>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Permissão de Notificação do Celular / Navegador
              </h2>
              <p className="text-xs text-slate-500 font-mono">Alertas nativos na tela do dispositivo sobre clientes e prazos</p>
            </div>
          </div>

          {/* Status badge */}
          {permStatus === 'granted' && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" /> Ativo no Dispositivo
            </span>
          )}
          {permStatus === 'default' && (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" /> Permissão Pendente
            </span>
          )}
          {(permStatus === 'denied' || permStatus === 'unsupported') && (
            <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-xs font-bold flex items-center gap-1.5">
              <XCircle className="w-4 h-4 text-rose-600" /> Inativo / Bloqueado
            </span>
          )}
        </div>

        <div className="p-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0 mt-0.5">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Receber Alertas Direto no Dispositivo</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Permite que o aplicativo avise você com notificações push e sons quando houver vencimentos no dia ou clientes em atraso.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {permStatus !== 'granted' && (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95 whitespace-nowrap"
                >
                  Permitir Notificações
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onTestNotification();
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95 whitespace-nowrap"
              >
                Testar Alerta Agora
              </button>
            </div>
          </div>
        </div>
      </div>

</>
);
