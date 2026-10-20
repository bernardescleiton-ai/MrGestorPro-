import React from 'react';
import { AppLayout } from './components/AppLayout';
import { useAppData } from './hooks/useAppData';
import { useRestorePoints } from './hooks/useRestorePoints';
import { useCloudSync } from './hooks/useCloudSync';
import { useClientActions } from './hooks/useClientActions';
import { useChargeActions } from './hooks/useChargeActions';
import { useMessagingActions } from './hooks/useMessagingActions';
import { removeClientsBatchTombstone } from './lib/offlineSyncManager';

export default function App() {
  const app = useAppData();
  const { restorePoints, createRestorePoint, handleDeleteRestorePoint, importExternalRestorePoint } = useRestorePoints(app.dataRef);

  useCloudSync({
    data: app.data,
    dataRef: app.dataRef,
    setRawData: app.setRawData,
    setSyncTrigger: app.setSyncTrigger,
    syncTrigger: app.syncTrigger,
    isRemoteUpdate: app.isRemoteUpdate,
    hasFetchedCloud: app.hasFetchedCloud,
    lastSavedDataJsonRef: app.lastSavedDataJsonRef,
    setSyncError: app.setSyncError,
  });

  const clientActions = useClientActions({
    data: app.data,
    setData: app.setData,
    generateUUID: app.generateUUID,
    setClientToEdit: app.setClientToEdit,
    setIsClientModalOpen: app.setIsClientModalOpen,
    setRenewalClient: app.setRenewalClient,
    setIsRenewalModalOpen: app.setIsRenewalModalOpen,
    setRenewalToast: app.setRenewalToast,
    setConfirmModal: app.setConfirmModal,
    historyClient: app.historyClient,
    setHistoryClient: app.setHistoryClient,
    setLiveToast: app.setLiveToast,
  });

  const chargeActions = useChargeActions({
    data: app.data,
    setData: app.setData,
    generateUUID: app.generateUUID,
    setActiveSection: app.setActiveSection,
    setChargeDefaultClientId: app.setChargeDefaultClientId,
    setIsChargeModalOpen: app.setIsChargeModalOpen,
    setConfirmModal: app.setConfirmModal,
  });

  const { handleSendWhatsApp, recordSentMessage } = useMessagingActions({
    data: app.data,
    setData: app.setData,
    generateUUID: app.generateUUID,
  });

  const handleImportData = (newData: { settings: Parameters<typeof chargeActions.handleSaveSettings>[0]; clients: import('./types').Client[]; charges: import('./types').Charge[] }) => {
    if (newData.clients && newData.clients.length > 0) {
      removeClientsBatchTombstone(newData.clients.map((c) => c.id));
    }
    app.setData((prev) => ({ ...prev, settings: newData.settings || prev.settings, clients: newData.clients || prev.clients, charges: newData.charges || prev.charges }));
  };

  return (
    <AppLayout
      {...app}
      {...clientActions}
      {...chargeActions}
      handleSendWhatsApp={handleSendWhatsApp}
      recordSentMessage={recordSentMessage}
      restorePoints={restorePoints}
      createRestorePoint={createRestorePoint}
      handleDeleteRestorePoint={handleDeleteRestorePoint}
      importExternalRestorePoint={importExternalRestorePoint}
      handleImportData={handleImportData}
    />
  );
}
