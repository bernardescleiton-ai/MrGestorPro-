import React from 'react';
import { AppLayout } from './components/AppLayout';
import { useAppData } from './hooks/useAppData';
import { useRestorePoints } from './hooks/useRestorePoints';
import { useCloudSync } from './hooks/useCloudSync';
import { useClientActions } from './hooks/useClientActions';
import { useChargeActions } from './hooks/useChargeActions';
import { useMessagingActions } from './hooks/useMessagingActions';

export default function App() {
  const app = useAppData();
  const { restorePoints, createRestorePoint, handleDeleteRestorePoint } = useRestorePoints(app.dataRef);

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
    setLiveToast: app.setLiveToast,
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
      handleImportData={handleImportData}
    />
  );
}
