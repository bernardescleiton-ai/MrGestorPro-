import React from 'react';
import {
  Home,
  Users,
  Calendar,
  Clock,
  RefreshCw,
  User,
  Bell,
  Sliders,
  Sparkles
} from 'lucide-react';
import { SectionType } from '../types';

interface SidebarProps {
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  syncError?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
  onSync,
  isSyncing = false,
  syncError = null,
}) => {
  const mainNavItems: { id: SectionType; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home className="w-4 h-4" /> },
    { id: 'clients', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'due', label: 'Vencimentos', icon: <Clock className="w-4 h-4" /> },
    { id: 'charges', label: 'Histórico', icon: <Calendar className="w-4 h-4" /> },
  ];

  const configNavItems: { id: SectionType; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Meu Perfil', icon: <User className="w-4 h-4" /> },
    { id: 'notices', label: 'Avisos & WhatsApp', icon: <Bell className="w-4 h-4" /> },
    { id: 'settings', label: 'Config & Backup', icon: <Sliders className="w-4 h-4" /> },
  ];

  const allNavItems = [...mainNavItems, ...configNavItems];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0F172A] text-slate-100 border-r border-slate-800 fixed inset-y-0 left-0 z-20">
        {/* Brand */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <img
              src="/icon-192.png"
              alt="MrGestor Logo"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover shadow-md shadow-blue-500/20 border border-blue-400/30"
            />
            <div>
              <span className="text-white font-extrabold tracking-tight text-base block leading-tight">MrGestor</span>
              <span className="text-[10px] text-blue-400 font-mono font-medium">Gestão & Cobrança</span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3.5 space-y-6 overflow-y-auto pt-4 pb-4">
          {/* 1. SEÇÃO PRINCIPAL */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2.5 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              Principal
            </div>
            {mainNavItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all text-left text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.02]'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* 2. SEÇÃO CONFIGURAÇÕES & DADOS */}
          <div className="space-y-1 pt-2 border-t border-slate-800/60">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2.5 mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              Configurações & Dados
            </div>
            {configNavItems.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectSection(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all text-left text-xs font-semibold ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm font-bold scale-[1.02]'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span className={`${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Sync Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex justify-between text-[11px] text-slate-400 mb-2 font-mono">
            <span>Sincronização Nuvem</span>
            {syncError ? (
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Local
              </span>
            ) : (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                Tempo Real
              </span>
            )}
          </div>

          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
            <div className={`h-full w-full ${syncError ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <div
              className="text-[10px] text-slate-400 font-mono tracking-tight truncate max-w-[130px]"
              title={syncError || 'Nuvem conectada e sincronizada'}
            >
              {syncError ? '💾 Salvo no Dispositivo' : '⚡ Nuvem Sincronizada'}
            </div>
            {onSync && (
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                title="Sincronizar dados agora"
                className="flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-2 py-1 rounded transition-all active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
            )}
          </div>
          {syncError && (
            <div className="mt-1.5 text-[9.5px] text-amber-400/90 leading-tight bg-amber-500/10 p-1.5 rounded border border-amber-500/20 font-sans">
              {syncError.includes('Cota') || syncError.includes('Quota')
                ? '⏳ Cota diária gratuita em pausa. Seus dados estão 100% salvos no dispositivo.'
                : syncError}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar with Scrollable / Segmented Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0F172A]/95 backdrop-blur-md text-slate-300 border-t border-slate-800/80 flex items-center justify-around px-1 py-1.5 z-40 shadow-2xl overflow-x-auto">
        {allNavItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              className={`flex-1 min-w-[52px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all min-h-[44px] active:scale-95 ${
                isActive
                  ? 'text-white bg-blue-600/90 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="text-[9px] mt-0.5 tracking-tight truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
