import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle,
  AlertCircle,
  XCircle,
  Download,
  Upload,
  Database,
  Copy,
  Check,
  Camera,
  RotateCcw,
  History,
  Trash2,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  Sliders,
  X,
  AlertTriangle
} from 'lucide-react';
import { CompanySettings, Client, Charge, SystemRestorePoint } from '../types';
import {
  getNotificationPermissionStatus,
  requestDeviceNotificationPermission,
  sendTestNotification
} from '../utils/notifications';

interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  clients: Client[];
  charges: Charge[];
  onImportData?: (newData: { settings: CompanySettings; clients: Client[]; charges: Charge[] }) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  syncError?: string | null;
}

interface ToastFeedback {
  message: string;
  type: 'success' | 'error' | 'info';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  clients,
  charges,
  onImportData,
  onSync,
  isSyncing = false,
  syncError = null,
}) => {
  const [permStatus, setPermStatus] = useState(getNotificationPermissionStatus());
  const [importCodeInput, setImportCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [restorePointName, setRestorePointName] = useState('');
  const [toast, setToast] = useState<ToastFeedback | null>(null);

  // Custom in-app dialog states
  const [pointToDelete, setPointToDelete] = useState<SystemRestorePoint | null>(null);
  const [pointToRestore, setPointToRestore] = useState<SystemRestorePoint | null>(null);

  const [restorePoints, setRestorePoints] = useState<SystemRestorePoint[]>(() => {
    try {
      const saved = localStorage.getItem('gc_v1_restore_points');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setPermStatus(getNotificationPermissionStatus());
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const handleCreateRestorePoint = () => {
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const defaultTitle = restorePointName.trim() || `Ponto Manual - ${dateFormatted}`;

    const newPoint: SystemRestorePoint = {
      id: `rp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: defaultTitle,
      createdAt: now.toISOString(),
      clientsCount: clients.length,
      chargesCount: charges.length,
      data: {
        clients: JSON.parse(JSON.stringify(clients)),
        charges: JSON.parse(JSON.stringify(charges)),
        settings: JSON.parse(JSON.stringify(settings)),
      },
    };

    const updated = [newPoint, ...restorePoints];
    setRestorePoints(updated);
    try {
      localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving restore point:', e);
    }
    setRestorePointName('');
    showToast(`Ponto de restauração "${newPoint.name}" criado com sucesso!`, 'success');
  };

  const handleConfirmRestore = () => {
    if (!pointToRestore) return;
    if (onImportData) {
      onImportData({
        settings: pointToRestore.data.settings || settings,
        clients: pointToRestore.data.clients || [],
        charges: pointToRestore.data.charges || [],
      });
      showToast(`Sistema restaurado para o ponto "${pointToRestore.name}" com sucesso!`, 'success');
    }
    setPointToRestore(null);
  };

  const handleConfirmDelete = () => {
    if (!pointToDelete) return;
    const targetId = pointToDelete.id;
    const targetName = pointToDelete.name;
    const updated = restorePoints.filter((rp) => rp.id !== targetId);
    setRestorePoints(updated);
    try {
      localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
    } catch (e) {
      console.error('Error deleting restore point:', e);
    }
    setPointToDelete(null);
    showToast(`Ponto "${targetName}" excluído do histórico!`, 'info');
  };

  const handleDownloadRestorePoint = (point: SystemRestorePoint) => {
    const jsonStr = JSON.stringify(point.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ponto_restauracao_${point.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Download do arquivo JSON iniciado.`, 'info');
  };

  const handleExportJSON = () => {
    const dataToExport = {
      settings,
      clients,
      charges,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrgestor_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Download do backup completo iniciado.`, 'info');
  };

  const handleCopyBackupCode = () => {
    const dataToExport = {
      settings,
      clients,
      charges,
    };
    const code = btoa(unescape(encodeURIComponent(JSON.stringify(dataToExport))));
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    showToast('Código de backup copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiedCode(false), 3000);
  };

  const handleImportFromText = () => {
    if (!importCodeInput.trim()) {
      showToast('Cole o código de backup ou JSON para importar.', 'error');
      return;
    }
    try {
      let decodedStr = importCodeInput.trim();
      if (!decodedStr.startsWith('{')) {
        decodedStr = decodeURIComponent(escape(atob(decodedStr)));
      }
      const parsed = JSON.parse(decodedStr);
      if (parsed && (parsed.clients || parsed.charges || parsed.settings)) {
        if (onImportData) {
          onImportData({
            settings: parsed.settings || settings,
            clients: parsed.clients || [],
            charges: parsed.charges || [],
          });
          showToast('Dados importados e sincronizados com sucesso!', 'success');
          setImportCodeInput('');
        }
      } else {
        showToast('Formato de backup inválido.', 'error');
      }
    } catch {
      showToast('Erro ao decodificar backup. Verifique se o código está correto.', 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && (parsed.clients || parsed.charges || parsed.settings)) {
          if (onImportData) {
            onImportData({
              settings: parsed.settings || settings,
              clients: parsed.clients || [],
              charges: parsed.charges || [],
            });
            showToast('Backup JSON restaurado com sucesso!', 'success');
          }
        }
      } catch {
        showToast('Erro ao ler arquivo JSON de backup.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleRequestPermission = async () => {
    const granted = await requestDeviceNotificationPermission();
    setPermStatus(getNotificationPermissionStatus());
    if (granted) {
      showToast('Permissão concedida! As notificações foram ativadas.', 'success');
    } else {
      showToast('Permissão negada ou não permitida pelo navegador.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-3 max-w-md ${
            toast.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toast.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {toast.type === 'info' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
          <p className="text-xs font-semibold leading-snug flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-slate-300 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Sliders className="w-6 h-6 text-blue-600" />
          Configurações & Backup de Dados
        </h1>
        <p className="text-slate-500 text-xs font-mono mt-0.5">
          Gerencie a sincronia em nuvem, crie pontos de restauração instantâneos e configure as permissões de notificação do celular.
        </p>
      </div>

      {/* 1. Permissão de Notificação do Celular */}
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
                  onClick={handleRequestPermission}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95 whitespace-nowrap"
                >
                  Permitir Notificações
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  sendTestNotification();
                  showToast('Alerta de teste enviado!', 'info');
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95 whitespace-nowrap"
              >
                Testar Alerta Agora
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Pontos de Restauração do Sistema */}
      <div className="bg-white rounded-2xl border border-blue-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between bg-blue-50/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-2xs">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                Pontos de Restauração Instantânea
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[11px] font-extrabold font-mono">
                  {restorePoints.length} salvos
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Pontos automáticos são gerados no máximo 1 vez por dia. Pontos adicionais são criados manualmente.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Create New Restore Point Box */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Criar Ponto de Restauração Agora
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Sua base atual possui <strong>{clients.length} clientes</strong> e <strong>{charges.length} cobranças</strong>.
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={restorePointName}
                onChange={(e) => setRestorePointName(e.target.value)}
                placeholder="Nome do ponto (Ex: Antes de cadastrar novos clientes)..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={handleCreateRestorePoint}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 shrink-0"
              >
                <Camera className="w-4 h-4" />
                Criar Ponto de Restauração
              </button>
            </div>
          </div>

          {/* List of Restore Points */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-4 h-4 text-blue-600" />
              Histórico de Pontos de Restauração
            </h3>

            {restorePoints.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <HardDrive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">Nenhum ponto de restauração foi criado ainda.</p>
                <p className="text-[11px] text-slate-400 mt-1">Clique no botão acima para salvar a versão atual do sistema.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {restorePoints.map((point) => {
                  const isAuto = point.name.toLowerCase().includes('automático') || point.name.toLowerCase().includes('automatico');
                  return (
                    <div
                      key={point.id}
                      className="p-3.5 bg-slate-50/80 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-800">{point.name}</span>
                          {isAuto ? (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200/80 px-2 py-0.5 rounded-full font-mono font-bold">
                              Automático (1/dia)
                            </span>
                          ) : (
                            <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-200/80 px-2 py-0.5 rounded-full font-mono font-bold">
                              Manual
                            </span>
                          )}
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono font-semibold">
                            {new Date(point.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>👥 {point.clientsCount} clientes</span>
                          <span>•</span>
                          <span>📋 {point.chargesCount} cobranças</span>
                        </div>
                      </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPointToRestore(point)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
                        title="Restaurar o sistema para os dados deste ponto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restaurar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadRestorePoint(point)}
                        className="p-1.5 text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
                        title="Baixar arquivo JSON deste ponto"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setPointToDelete(point)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition-colors active:scale-90"
                        title="Excluir ponto de restauração"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Sincronia na Nuvem & Backup de Dados */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Sincronização na Nuvem e Backup de Dados
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Exporte, copie ou importe seus clientes e cobranças entre dispositivos ou links
              </p>
            </div>
          </div>

          {onSync && (
            <button
              type="button"
              onClick={onSync}
              disabled={isSyncing}
              className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Nuvem'}
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Export Options */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">1. Exportar Dados deste Dispositivo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCopyBackupCode}
                className="flex items-center justify-center gap-2 p-3 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-all shadow-2xs active:scale-95"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                {copiedCode ? 'Código de Backup Copiado!' : 'Copiar Código de Backup'}
              </button>

              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-2 p-3 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-all shadow-2xs active:scale-95"
              >
                <Download className="w-4 h-4" />
                Baixar Arquivo JSON (.json)
              </button>
            </div>
          </div>

          {/* Import Options */}
          <div className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">2. Importar / Restaurar Backup no Dispositivo</h3>
            <p className="text-xs text-slate-500">
              Cole o código de backup gerado ou selecione um arquivo JSON para carregar os clientes e cobranças neste dispositivo/link.
            </p>

            <div className="space-y-3">
              <textarea
                rows={3}
                value={importCodeInput}
                onChange={(e) => setImportCodeInput(e.target.value)}
                placeholder="Cole o código de backup ou JSON aqui..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-slate-500" />
                  Carregar Arquivo .json
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleImportFromText}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95"
                >
                  Restaurar e Aplicar Dados
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Excluir Ponto de Restauração */}
      {pointToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Excluir Ponto de Restauração</h3>
                <p className="text-xs text-slate-500 font-mono">Confirmação de exclusão</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
              <div className="font-bold text-xs text-slate-800">{pointToDelete.name}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                📅 Criado em: {new Date(pointToDelete.createdAt).toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                👥 {pointToDelete.clientsCount} clientes • 📋 {pointToDelete.chargesCount} cobranças
              </div>
            </div>

            <p className="text-slate-600 text-xs leading-relaxed">
              Tem certeza que deseja excluir permanentemente este ponto de restauração do seu histórico?
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPointToDelete(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95"
              >
                Sim, Excluir Ponto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Restaurar Sistema a partir de Ponto */}
      {pointToRestore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">Restaurar Sistema</h3>
                <p className="text-xs text-slate-500 font-mono">Retornar ao estado salvo</p>
              </div>
            </div>

            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1.5">
              <div className="font-bold text-xs text-emerald-950">{pointToRestore.name}</div>
              <div className="text-[11px] text-emerald-800 font-mono">
                📅 Data do Ponto: {new Date(pointToRestore.createdAt).toLocaleString('pt-BR')}
              </div>
              <div className="text-[11px] text-emerald-800 font-mono">
                👥 {pointToRestore.clientsCount} clientes no ponto • 📋 {pointToRestore.chargesCount} cobranças
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Os dados atuais do sistema serão substituídos pelos dados salvos neste ponto de restauração.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPointToRestore(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95"
              >
                Confirmar Restauração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
