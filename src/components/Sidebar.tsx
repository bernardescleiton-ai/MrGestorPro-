import React from 'react';
import {
  Home,
  Users,
  Calendar,
  Clock,
  User,
  Bell,
  Sliders,
} from 'lucide-react';
import { SectionType } from '../types';

interface SidebarProps {
  activeSection: SectionType;
  onSelectSection: (section: SectionType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSelectSection,
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

  const mobileNavItems: { id: SectionType; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home className="w-5 h-5 sm:w-6 sm:h-6" /> },
    { id: 'clients', label: 'Clientes', icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" /> },
    { id: 'due', label: 'Vencimentos', icon: <Clock className="w-5 h-5 sm:w-6 sm:h-6" /> },
    { id: 'profile', label: 'Meu Perfil', icon: <User className="w-5 h-5 sm:w-6 sm:h-6" /> },
    { id: 'notices', label: 'Avisos', icon: <Bell className="w-5 h-5 sm:w-6 sm:h-6" /> },
    { id: 'settings', label: 'Config', icon: <Sliders className="w-5 h-5 sm:w-6 sm:h-6" /> },
  ];

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
      </aside>

      {/* Mobile Bottom Navigation Bar with Tactile 3D App Tiles */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 z-40 shadow-[0_-12px_32px_rgba(0,0,0,0.8)] px-1.5 sm:px-3 py-2 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-6 gap-1 sm:gap-1.5 w-full max-w-lg mx-auto">
          {mobileNavItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                className={`w-full min-h-[64px] sm:min-h-[70px] flex flex-col items-center justify-center py-2 px-0.5 rounded-2xl transition-all duration-150 cursor-pointer select-none ${
                  isActive
                    ? 'bg-gradient-to-b from-blue-500 via-blue-600 to-indigo-700 text-white border-t-2 border-t-blue-200 border-x border-blue-400 border-b-[4px] border-b-indigo-950 shadow-[0_6px_16px_rgba(37,99,235,0.45)] ring-1 ring-blue-300/40 active:translate-y-1 active:border-b-2 active:shadow-xs'
                    : 'bg-gradient-to-b from-slate-800 via-slate-850 to-slate-900 text-slate-300 hover:text-white border-t-2 border-t-slate-600/80 border-x border-slate-700/80 border-b-[4px] border-b-slate-950 shadow-[0_5px_12px_rgba(0,0,0,0.6)] hover:from-slate-750 active:translate-y-1 active:border-b-2 active:shadow-xs'
                }`}
              >
                {isActive && (
                  <span className="w-3.5 h-0.5 bg-white/90 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.9)] mb-0.5" />
                )}
                <div className={`transition-transform duration-150 ${isActive ? 'scale-110 drop-shadow-sm text-white' : 'text-slate-300'}`}>
                  {item.icon}
                </div>
                <span
                  className={`text-[9px] sm:text-[10px] mt-1 tracking-tight truncate max-w-full leading-none ${
                    isActive ? 'font-black text-white drop-shadow-xs' : 'font-bold text-slate-300'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

