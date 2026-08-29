import React, { useState } from 'react';
import { Bell, MessageSquare, Phone, Calendar, Clock, AlertTriangle, CheckCircle2, Send, Copy, Smartphone, ShieldCheck, Zap } from 'lucide-react';
import { Client, Charge, CompanySettings } from '../types';
import { brl, dateBR, todayStr, normalizePhone, formatDateTimeBR, getDefaultMessage, encodeForWhatsApp } from '../utils/formatters';
import {
  getNotificationPermissionStatus,
  requestDeviceNotificationPermission,
  sendTestNotification,
  triggerOverdueDeviceNotifications,
  isAndroidWebView,
} from '../utils/notifications';

interface NotificationsViewProps {
  clients: Client[];
  charges: Charge[];
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  onSendWhatsApp?: (client: Client, charge?: Charge) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  clients,
  charges,
  settings,
  onSaveSettings,
  onSendWhatsApp,
}) => {
  const [managerPhone, setManagerPhone] = useState(settings.managerPhone || '');
  const [savedMsg, setSavedMsg] = useState(false);
  const [devicePermStatus, setDevicePermStatus] = useState<'granted' | 'denied' | 'default' | 'unsupported'>(() => getNotificationPermissionStatus());
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResultMsg, setTriggerResultMsg] = useState<string | null>(null);

  const handleEnableDeviceNotifications = async () => {
    const granted = await requestDeviceNotificationPermission();
    const newStatus = getNotificationPermissionStatus();
    setDevicePermStatus(newStatus);
    if (granted) {
      setTriggerResultMsg('Notificações no celular ativadas com sucesso!');
      setTimeout(() => setTriggerResultMsg(null), 4000);
    } else {
      alert('A permissão de notificação não foi liberada pelo seu celular/navegador. Verifique as configurações do sistema.');
    }
  };

  const handleTestDeviceNotification = async () => {
    const ok = await sendTestNotification();
    if (ok) {
      setTriggerResultMsg('Notificação de teste disparada para a barra do celular!');
      setTimeout(() => setTriggerResultMsg(null), 4000);
    }
  };

  const handleTriggerOverdueNow = async () => {
    setIsTriggering(true);
    setTriggerResultMsg(null);
    try {
      const res = await triggerOverdueDeviceNotifications({
        clients,
        charges,
        settings,
        sentLogs: [],
        updatedAt: Date.now(),
      });
      setDevicePermStatus(getNotificationPermissionStatus());
      setTriggerResultMsg(res.message);
      setTimeout(() => setTriggerResultMsg(null), 6000);
    } catch (e) {
      alert('Ocorreu um erro ao disparar as notificações para o celular.');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSaveManagerPhone = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      managerPhone: managerPhone.trim(),
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const [filterType, setFilterType] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');

  // Calculate dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatDateKey = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const targetToday = formatDateKey(today);

  // Calculate delay info for overdue items up to 2 years
  function getOverdueInfo(dueDateStr: string, todayDate: Date) {
    let datePart = dueDateStr;
    if (dueDateStr.includes('T')) {
      datePart = dueDateStr.split('T')[0];
    }
    const [y, m, d] = datePart.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    targetDate.setHours(0, 0, 0, 0);

    const todayZero = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
    const diffMs = todayZero.getTime() - targetDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 3600 * 24));

    if (diffDays <= 0) {
      return { diffDays, delayLabel: '', isOverdue: false };
    }

    let delayLabel = '';
    if (diffDays >= 365) {
      const years = Math.floor(diffDays / 365);
      const remMonths = Math.floor((diffDays % 365) / 30);
      if (years === 1) {
        delayLabel = remMonths > 0 ? `1 ano e ${remMonths}m` : `1 ano`;
      } else {
        delayLabel = remMonths > 0 ? `${years} anos e ${remMonths}m` : `${years} anos`;
      }
    } else if (diffDays >= 30) {
      const months = Math.floor(diffDays / 30);
      delayLabel = `${months} ${months === 1 ? 'mês' : 'meses'}`;
    } else {
      delayLabel = `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    }

    return { diffDays, delayLabel: `Atrasado há ${delayLabel}`, isOverdue: true };
  }

  // Check client due dates and charge due dates
  interface AlertItem {
    id: string;
    clientName: string;
    clientPhone: string;
    description: string;
    amount?: number;
    dueDateStr: string;
    type: 'overdue' | 'today' | 'upcoming';
    categoryLabel: string;
    clientObj?: Client;
    chargeObj?: Charge;
    clientMessage: string;
    diffDays: number;
  }

  const alertItems: AlertItem[] = [];

  // Check clients with dueDate (YYYY-MM-DDTHH:mm or YYYY-MM-DD)
  clients.forEach((client) => {
    if (!client.dueDate) return;
    const clientDatePart = client.dueDate.split('T')[0];
    const clientMessage = getDefaultMessage(client, null, settings);
    const { diffDays, delayLabel, isOverdue } = getOverdueInfo(client.dueDate, today);

    if (isOverdue && diffDays <= 730) {
      alertItems.push({
        id: `client-overdue-${client.id}`,
        clientName: client.name,
        clientPhone: client.phone,
        description: `Vencimento de Cliente (${delayLabel})`,
        dueDateStr: client.dueDate,
        type: 'overdue',
        categoryLabel: `⚠️ ${delayLabel.toUpperCase()}`,
        clientObj: client,
        clientMessage,
        diffDays,
      });
    } else if (clientDatePart === targetToday || diffDays === 0) {
      alertItems.push({
        id: `client-today-${client.id}`,
        clientName: client.name,
        clientPhone: client.phone,
        description: 'Vencimento de Cliente (Hoje)',
        dueDateStr: client.dueDate,
        type: 'today',
        categoryLabel: '🚨 Vence HOJE',
        clientObj: client,
        clientMessage,
        diffDays: 0,
      });
    } else if (diffDays < 0) {
      const daysAhead = Math.abs(diffDays);
      let label = `Faltam ${daysAhead} dia(s)`;
      if (daysAhead === 1) label = 'Vence amanhã (1 dia)';

      alertItems.push({
        id: `client-future-${client.id}`,
        clientName: client.name,
        clientPhone: client.phone,
        description: `Vencimento do Cliente (${label})`,
        dueDateStr: client.dueDate,
        type: 'upcoming',
        categoryLabel: `📅 ${label.toUpperCase()}`,
        clientObj: client,
        clientMessage,
        diffDays,
      });
    }
  });

  // Check charges (unpaid charges)
  charges.forEach((charge) => {
    if (charge.paid) return;
    const client = clients.find((c) => c.id === charge.clientId);
    const clientName = client ? client.name : 'Cliente desconhecido';
    const clientPhone = client ? client.phone : '';
    const clientMessage = client ? getDefaultMessage(client, charge, settings) : '';
    const { diffDays, delayLabel, isOverdue } = getOverdueInfo(charge.dueDate, today);

    if (isOverdue && diffDays <= 730) {
      alertItems.push({
        id: `charge-overdue-${charge.id}`,
        clientName,
        clientPhone,
        description: charge.note ? `Cobrança: ${charge.note}` : `Cobrança (${delayLabel})`,
        amount: charge.amount,
        dueDateStr: charge.dueDate,
        type: 'overdue',
        categoryLabel: `⚠️ ${delayLabel.toUpperCase()}`,
        clientObj: client,
        chargeObj: charge,
        clientMessage,
        diffDays,
      });
    } else if (charge.dueDate === targetToday || diffDays === 0) {
      alertItems.push({
        id: `charge-today-${charge.id}`,
        clientName,
        clientPhone,
        description: charge.note ? `Cobrança: ${charge.note}` : 'Cobrança pendente',
        amount: charge.amount,
        dueDateStr: charge.dueDate,
        type: 'today',
        categoryLabel: '🚨 Vence HOJE',
        clientObj: client,
        chargeObj: charge,
        clientMessage,
        diffDays: 0,
      });
    } else if (diffDays < 0) {
      const daysAhead = Math.abs(diffDays);
      let label = `Faltam ${daysAhead} dia(s)`;
      if (daysAhead === 1) label = 'Vence amanhã (1 dia)';

      alertItems.push({
        id: `charge-future-${charge.id}`,
        clientName,
        clientPhone,
        description: charge.note ? `Cobrança: ${charge.note}` : `Cobrança (${label})`,
        amount: charge.amount,
        dueDateStr: charge.dueDate,
        type: 'upcoming',
        categoryLabel: `📅 ${label.toUpperCase()}`,
        clientObj: client,
        chargeObj: charge,
        clientMessage,
        diffDays,
      });
    }
  });

  // Sort: upcoming future dates at top (3 days before, 1 day before), then today, then overdue below (1 day after, etc.)
  alertItems.sort((a, b) => (b.dueDateStr || '').localeCompare(a.dueDateStr || ''));

  const groupOverdue = alertItems.filter((i) => i.type === 'overdue');
  const groupToday = alertItems.filter((i) => i.type === 'today');
  const groupUpcoming = alertItems.filter((i) => i.type === 'upcoming');

  const filteredItems = alertItems.filter((item) => {
    if (filterType === 'overdue') return item.type === 'overdue';
    if (filterType === 'today') return item.type === 'today';
    if (filterType === 'upcoming') return item.type === 'upcoming';
    return true;
  });

  const sendToManagerWhatsApp = (item?: AlertItem) => {
    const phoneToUse = managerPhone || settings.phone;
    const cleanPhone = normalizePhone(phoneToUse);
    if (!cleanPhone) {
      alert('Por favor, configure o Celular do Gestor primeiro.');
      return;
    }

    let text = '';
    if (item) {
      text = `🚨 *ALERTA DE GESTÃO - GESTOR_CLIENTES*\n\n*Status:* ${item.categoryLabel}\n*Cliente:* ${item.clientName}\n*Contato:* ${item.clientPhone || 'Não informado'}\n*Detalhe:* ${item.description}${item.amount ? '\n*Valor:* ' + brl(item.amount) : ''}\n*Vencimento:* ${item.dueDateStr.includes('T') ? formatDateTimeBR(item.dueDateStr) : dateBR(item.dueDateStr)}\n\n💬 *MENSAGEM DEFINIDA PARA ENVIAR AO CLIENTE:*\n${item.clientMessage}`;
    } else {
      // Summary of all alerts
      if (alertItems.length === 0) {
        alert('Nenhum alerta pendente para hoje, em 3 dias ou vencido ontem.');
        return;
      }
      text = `🚨 *RESUMO DE ALERTAS DE VENCIMENTO - GESTOR*\n\nTotal de alertas: ${alertItems.length}\n\n` +
        alertItems.map((ai, idx) => `${idx + 1}. *[${ai.categoryLabel}]*\n   • Cliente: ${ai.clientName}\n   • Tel: ${ai.clientPhone || '—'}\n   • ${ai.description}${ai.amount ? ' (' + brl(ai.amount) + ')' : ''}\n   • Vencimento: ${ai.dueDateStr}\n   • 💬 *Mensagem ao Cliente:* "${ai.clientMessage}"`).join('\n\n');
    }

    const encoded = encodeForWhatsApp(text);
    window.open(`https://wa.me/55${cleanPhone}?text=${encoded}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Alertas e Notificações do Gestor</h1>
          <p className="text-slate-500 text-xs font-mono mt-0.5">
            Monitoramento automático: 3 dias antes, no dia do vencimento e clientes em atraso (até 2 anos).
          </p>
        </div>
        {alertItems.length > 0 && (
          <button
            onClick={() => sendToManagerWhatsApp()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> Enviar Resumo para meu WhatsApp
          </button>
        )}
      </div>

      {/* Configuration Card for Device Status Bar / Mobile Notification Shade */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-md border border-indigo-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-800/60">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-bold shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-white text-base">Notificações Nativas na Barra do Celular</h2>
                {devicePermStatus === 'granted' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <ShieldCheck className="w-3 h-3" /> ATIVADO NA BARRA DE STATUS
                  </span>
                ) : devicePermStatus === 'denied' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    <AlertTriangle className="w-3 h-3" /> BLOQUEADO PELO NAVEGADOR
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    <Bell className="w-3 h-3" /> PENDENTE DE AUTORIZAÇÃO
                  </span>
                )}
              </div>
              <p className="text-indigo-200/80 text-xs mt-1">
                Receba os alertas de clientes em atraso e vencimentos diretamente no <strong>painel de notificações / barra de rolagem</strong> do seu celular com som e vibração.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {devicePermStatus !== 'granted' ? (
              <button
                onClick={handleEnableDeviceNotifications}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
              >
                <Bell className="w-4 h-4" /> Ativar no Celular Agora
              </button>
            ) : (
              <button
                onClick={handleTestDeviceNotification}
                className="px-3.5 py-2 bg-indigo-600/80 hover:bg-indigo-600 text-white font-semibold text-xs rounded-xl border border-indigo-400/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" /> Testar Notificação
              </button>
            )}

            {groupOverdue.length > 0 && (
              <button
                onClick={handleTriggerOverdueNow}
                disabled={isTriggering}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Zap className="w-4 h-4 text-slate-950" />
                {isTriggering ? 'Disparando...' : 'Disparar Alertas de Atrasados na Barra'}
              </button>
            )}
          </div>
        </div>

        {triggerResultMsg && (
          <div className="mt-3 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{triggerResultMsg}</span>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-indigo-800/40 flex flex-col gap-2 text-xs text-indigo-200/90">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <Smartphone className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Aviso sobre envio de notificações em arquivos .APK (Android):</span>
          </div>
          <p className="text-[11px] text-indigo-200/80 leading-relaxed">
            Se você instalou o app através de um arquivo <strong>.APK gerado por criadores de WebView</strong> (como Website2APK, Kodular ou Android Studio), o sistema operacional Android (versões 13, 14 e 15) bloqueia por padrão as notificações de navegadores internos a menos que o APK possua a permissão nativa habilitada.
          </p>
          <div className="bg-indigo-950/80 p-3 rounded-xl border border-indigo-700/50 space-y-1.5 text-[11px]">
            <p className="font-bold text-white">✅ Como fazer as notificações funcionarem 100% no celular:</p>
            <ul className="list-disc list-inside space-y-1 text-indigo-200/90">
              <li>
                <strong>Método Recomendado (PWA / Web App):</strong> Abra o site no Chrome do celular, toque nos 3 pontinhos e selecione <strong>"Adicionar à Tela Inicial"</strong> ou <strong>"Instalar Aplicativo"</strong>. Ele cria um App nativo no celular que envia notificações na barra sem nenhuma restrição!
              </li>
              <li>
                <strong>Para Geradores de APK (Android Studio / WebView):</strong> No manifesto do APK (`AndroidManifest.xml`), adicione a permissão:
                <code className="block my-1 p-1 bg-black/50 text-emerald-300 rounded font-mono text-[10px] overflow-x-auto">
                  &lt;uses-permission android:name="android.permission.POST_NOTIFICATIONS" /&gt;
                </code>
                E certifique-se de ativar o suporte a <strong>WebChromeClient / Web Notifications</strong> nas configurações do gerador de APK.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Configuration Card for Manager WhatsApp */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Configuração do Celular do Gestor</h2>
            <p className="text-slate-500 text-xs font-mono">Número onde você deseja receber os alertas e notificações via WhatsApp.</p>
          </div>
        </div>

        <form onSubmit={handleSaveManagerPhone} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={managerPhone}
              onChange={(e) => setManagerPhone(e.target.value)}
              placeholder="Ex: (48) 99999-9999"
              className="w-full bg-slate-100 border-none rounded-lg px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs flex items-center justify-center gap-2"
          >
            Salvar Número
          </button>
        </form>
        {savedMsg && (
          <div className="mt-2 text-xs text-emerald-600 font-mono font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Número do gestor salvo com sucesso!
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterType('overdue')}
          className={`cursor-pointer rounded-xl border p-5 shadow-2xs transition-all ${
            filterType === 'overdue' ? 'bg-rose-100/80 border-rose-400 ring-2 ring-rose-400/30' : 'bg-rose-50/40 border-rose-200 hover:bg-rose-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Atrasados (Até 2 Anos)
            </span>
            <span className="w-7 h-7 rounded-full bg-rose-200 text-rose-900 flex items-center justify-center font-bold text-xs font-mono">
              {groupOverdue.length}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{groupOverdue.length} clientes</div>
          <p className="text-xs text-slate-500 mt-1">Com vencimento pendente em atraso</p>
        </div>

        <div
          onClick={() => setFilterType('today')}
          className={`cursor-pointer rounded-xl border p-5 shadow-2xs transition-all ${
            filterType === 'today' ? 'bg-blue-100/80 border-blue-400 ring-2 ring-blue-400/30' : 'bg-blue-50/40 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Hoje (Vencimento)
            </span>
            <span className="w-7 h-7 rounded-full bg-blue-200 text-blue-900 flex items-center justify-center font-bold text-xs font-mono">
              {groupToday.length}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{groupToday.length} clientes</div>
          <p className="text-xs text-slate-500 mt-1">Vencem no dia de hoje</p>
        </div>

        <div
          onClick={() => setFilterType('upcoming')}
          className={`cursor-pointer rounded-xl border p-5 shadow-2xs transition-all ${
            filterType === 'upcoming' ? 'bg-amber-100/80 border-amber-400 ring-2 ring-amber-400/30' : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> A Vencer (Futuros)
            </span>
            <span className="w-7 h-7 rounded-full bg-amber-200 text-amber-900 flex items-center justify-center font-bold text-xs font-mono">
              {groupUpcoming.length}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">{groupUpcoming.length} clientes</div>
          <p className="text-xs text-slate-500 mt-1">Com vencimento futuro cadastrado</p>
        </div>
      </div>

      {/* Alert Items List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Fila de Alertas ({filteredItems.length})
            </h2>
            <span className="text-xs text-slate-400 font-mono">• Hoje ({dateBR(targetToday)})</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl overflow-x-auto text-[11px] font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({alertItems.length})
            </button>
            <button
              onClick={() => setFilterType('overdue')}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'overdue' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:bg-rose-100/60'
              }`}
            >
              Atrasados ({groupOverdue.length})
            </button>
            <button
              onClick={() => setFilterType('today')}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'today' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-700 hover:bg-blue-100/60'
              }`}
            >
              Hoje ({groupToday.length})
            </button>
            <button
              onClick={() => setFilterType('upcoming')}
              className={`px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                filterType === 'upcoming' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              Futuros ({groupUpcoming.length})
            </button>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-mono">
            Nenhum alerta encontrado para o filtro selecionado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredItems.map((item) => {
              let badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
              if (item.type === 'upcoming') badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
              if (item.type === 'overdue') badgeColor = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';

              return (
                <div key={item.id} className="p-6 flex flex-col gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}`}>
                          {item.categoryLabel}
                        </span>
                        <span className="text-xs font-mono text-slate-500 font-semibold">
                          Vencimento: {item.dueDateStr.includes('T') ? formatDateTimeBR(item.dueDateStr) : dateBR(item.dueDateStr)}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{item.clientName}</h3>
                      <p className="text-xs text-slate-600 font-mono">
                        {item.description} {item.amount ? `• ${brl(item.amount)}` : ''} {item.clientPhone ? `• WhatsApp: ${item.clientPhone}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {item.clientObj && onSendWhatsApp && (
                        <button
                          onClick={() => onSendWhatsApp(item.clientObj!, item.chargeObj)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 active:scale-95"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Enviar WhatsApp
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pre-defined message snippet for this client */}
                  {item.clientMessage && (
                    <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-emerald-600" /> Mensagem pré-definida para este cliente:
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(item.clientMessage);
                            alert('Mensagem copiada para a área de transferência!');
                          }}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Copy className="w-3 h-3" /> Copiar Texto
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 italic font-sans whitespace-pre-wrap leading-relaxed">
                        "{item.clientMessage}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
