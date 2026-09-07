import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Sliders,
  X,
  AlertTriangle
} from 'lucide-react';
import { CompanySettings, Client, Charge, SystemRestorePoint } from '../types';
import { NotificationPermissionSection } from './NotificationPermissionSection';
import { SettingsDataSections } from './SettingsDataSections';
import {
  getNotificationPermissionStatus,
  requestDeviceNotificationPermission,
  sendTestNotification
} from '../utils/notifications';
import { logger } from '../lib/logger';
interface SettingsViewProps {
  settings: CompanySettings;
  onSaveSettings: (settings: CompanySettings) => void;
  clients: Client[];
  charges: Charge[];
  restorePoints?: SystemRestorePoint[];
  onCreateRestorePoint?: (name?: string) => Promise<SystemRestorePoint | null>;
  onDeleteRestorePoint?: (id: string) => Promise<void>;
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
  restorePoints: propRestorePoints,
  onCreateRestorePoint,
  onDeleteRestorePoint,
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
  const [isSavingPoint, setIsSavingPoint] = useState(false);
  // Custom in-app dialog states
  const [pointToDelete, setPointToDelete] = useState<SystemRestorePoint | null>(null);
  const [pointToRestore, setPointToRestore] = useState<SystemRestorePoint | null>(null);
  const [localRestorePoints, setLocalRestorePoints] = useState<SystemRestorePoint[]>(() => {
    try {
      const saved = localStorage.getItem('gc_v1_restore_points');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const restorePoints = propRestorePoints !== undefined ? propRestorePoints : localRestorePoints;
  useEffect(() => {
    setPermStatus(getNotificationPermissionStatus());
  }, []);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };
  const handleCreateRestorePoint = async () => {
    const titleToUse = restorePointName.trim();
    setIsSavingPoint(true);
    if (onCreateRestorePoint) {
      try {
        const created = await onCreateRestorePoint(titleToUse || undefined);
        if (created) {
          showToast(`Ponto de restauração "${created.name}" criado e sincronizado na nuvem!`, 'success');
        }
      } catch (err) {
        logger.error('Error creating restore point:', err);
        showToast('Erro ao sincronizar ponto na nuvem.', 'error');
      } finally {
        setIsSavingPoint(false);
        setRestorePointName('');
      }
      return;
    }
    // Fallback if no prop provided
    const now = new Date();
    const dateFormatted = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const defaultTitle = titleToUse || `Ponto Manual - ${dateFormatted}`;
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
    const updated = [newPoint, ...localRestorePoints];
    setLocalRestorePoints(updated);
    try {
      localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
    } catch (e) {
      logger.error('Error saving restore point:', e);
    }
    setRestorePointName('');
    setIsSavingPoint(false);
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
  const handleConfirmDelete = async () => {
    if (!pointToDelete) return;
    const targetId = pointToDelete.id;
    const targetName = pointToDelete.name;
    if (onDeleteRestorePoint) {
      try {
        await onDeleteRestorePoint(targetId);
      } catch (err) {
        logger.error('Error deleting point from cloud:', err);
      }
    } else {
      const updated = localRestorePoints.filter((rp) => rp.id !== targetId);
      setLocalRestorePoints(updated);
      try {
        localStorage.setItem('gc_v1_restore_points', JSON.stringify(updated));
      } catch (e) {
        logger.error('Error deleting restore point:', e);
      }
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
      <NotificationPermissionSection
        permStatus={permStatus}
        onRequestPermission={handleRequestPermission}
        onTestNotification={() => { sendTestNotification(); showToast('Alerta de teste enviado!', 'info'); }}
      />
      <SettingsDataSections
        clients={clients}
        charges={charges}
        restorePoints={restorePoints}
        restorePointName={restorePointName}
        setRestorePointName={setRestorePointName}
        isSavingPoint={isSavingPoint}
        handleCreateRestorePoint={handleCreateRestorePoint}
        handleDownloadRestorePoint={handleDownloadRestorePoint}
        settings={settings}
        copiedCode={copiedCode}
        importCodeInput={importCodeInput}
        setImportCodeInput={setImportCodeInput}
        handleCopyBackupCode={handleCopyBackupCode}
        handleExportJSON={handleExportJSON}
        handleImportFromText={handleImportFromText}
        handleFileUpload={handleFileUpload}
        onSync={onSync}
        isSyncing={isSyncing}
        syncError={syncError}
        pointToDelete={pointToDelete}
        pointToRestore={pointToRestore}
        handleConfirmDelete={handleConfirmDelete}
        handleConfirmRestore={handleConfirmRestore}
        setPointToDelete={setPointToDelete}
        setPointToRestore={setPointToRestore}
      />
    </div>
  );
};
