import React from 'react';
import { Trash2 } from 'lucide-react';
import type { AppData, Client, Charge, CompanySettings, SystemRestorePoint, SectionType } from '../types';
import { Sidebar } from './Sidebar';
import { DashboardView } from './DashboardView';
import { ClientsView, ClientFilterType } from './ClientsView';
import { ChargesView } from './ChargesView';
import { DueView, DueTabFilter } from './DueView';
import { SettingsView } from './SettingsView';
import { ProfileView } from './ProfileView';
import { NoticesConfigView } from './NoticesConfigView';
import { ClientModal } from './ClientModal';
import { ChargeModal } from './ChargeModal';
import { ClientHistoryModal } from './ClientHistoryModal';
import { RenewalModal } from './RenewalModal';
import { RenewalSuccessToast, RenewalToastData } from './RenewalSuccessToast';
import { SendMessageModal } from './SendMessageModal';
import type { LiveToast, ConfirmModal } from '../hooks/useAppData';
import { logger } from '../lib/logger';
export interface AppLayoutProps {
  data: AppData; activeSection: SectionType; dueTabFilter: DueTabFilter; clientStatusFilter: ClientFilterType;
  liveToast?: LiveToast | null; renewalToast: RenewalToastData | null; isClientModalOpen: boolean; clientToEdit: Client | null;
  isChargeModalOpen: boolean; chargeDefaultClientId?: string; historyClient: Client | null; renewalClient: Client | null;
  isRenewalModalOpen: boolean; confirmModal: ConfirmModal; restorePoints: SystemRestorePoint[]; isSyncing: boolean; syncError: string | null;
  setActiveSection: React.Dispatch<React.SetStateAction<SectionType>>; setClientStatusFilter: React.Dispatch<React.SetStateAction<ClientFilterType>>;
  setLiveToast: React.Dispatch<React.SetStateAction<LiveToast | null>>; setRenewalToast: React.Dispatch<React.SetStateAction<RenewalToastData | null>>;
  setIsClientModalOpen: React.Dispatch<React.SetStateAction<boolean>>; setIsChargeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setHistoryClient: React.Dispatch<React.SetStateAction<Client | null>>; setIsRenewalModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModal>>;
  handleManualSync: () => Promise<void>; handleNavigate: (section: SectionType, tab?: DueTabFilter, clientFilter?: ClientFilterType) => void;
  handleOpenNewClient: () => void; handleOpenEditClient: (client: Client) => void; handleUpdateClientPhone: (clientId: string, phone: string) => void;
  handleDeleteClient: (clientId: string) => void; handleDeleteBatch: (ids: string[]) => void; handleSendWhatsApp: (client: Client, charge?: Charge) => Promise<void>;
  recordSentMessage: (client: Client, charge: Charge | null | undefined, messageText: string) => void;
  handleOpenRenewClient: (client: Client) => void; handleMarkPaid: (chargeId: string) => void; handleUndoPaid: (chargeId: string) => void;
  handleDeleteCharge: (chargeId: string) => void; handleDeleteSentLog: (id: string) => void; handleDeleteSentLogsBatch: (ids: string[]) => void;
  handleDeleteChargesBatch: (ids: string[]) => void; handleToggleMessageSent: (chargeId: string) => void; handleSaveSettings: (settings: CompanySettings) => void;
  handleSaveClient: (client: Omit<Client, 'id' | 'createdAt'>, editId?: string) => void; handleSaveBatch: (clients: Omit<Client, 'id' | 'createdAt'>[]) => void;
  handleSaveCharge: (charge: Omit<Charge, 'id' | 'createdAt' | 'paid'>) => void; handleOpenNewCharge: (clientId?: string) => void;
  handleConfirmRenewal: (args: { client: Client; months: number; customAmount: number; recordPaidCharge: boolean; sendWhatsApp: boolean; customDateStr?: string; customWhatsAppMessage?: string }) => void;
  handleSaveRenewalTemplate: (text: string) => void; createRestorePoint: (name?: string, isAuto?: boolean) => Promise<SystemRestorePoint | null>;
  handleDeleteRestorePoint: (id: string) => Promise<void>;
  importExternalRestorePoint?: (name: string | undefined, data: { clients?: Client[]; charges?: Charge[]; settings?: CompanySettings }) => Promise<SystemRestorePoint | null>;
  handleImportData: (newData: { settings: CompanySettings; clients: Client[]; charges: Charge[] }) => void;
}
export const AppLayout: React.FC<AppLayoutProps> = ({
  data, activeSection, dueTabFilter, clientStatusFilter, liveToast: _liveToast, renewalToast, isClientModalOpen, clientToEdit,
  isChargeModalOpen, chargeDefaultClientId, historyClient, renewalClient, isRenewalModalOpen, confirmModal, restorePoints, isSyncing, syncError,
  setActiveSection, setClientStatusFilter, setLiveToast: _setLiveToast, setRenewalToast, setIsClientModalOpen, setIsChargeModalOpen, setHistoryClient, setIsRenewalModalOpen, setConfirmModal,
  handleManualSync, handleNavigate, handleOpenNewClient, handleOpenEditClient, handleUpdateClientPhone, handleDeleteClient, handleDeleteBatch, handleSendWhatsApp, recordSentMessage, handleOpenRenewClient,
  handleMarkPaid, handleUndoPaid, handleDeleteCharge, handleDeleteSentLog, handleDeleteSentLogsBatch, handleDeleteChargesBatch, handleToggleMessageSent,
  handleSaveClient, handleSaveBatch, handleSaveCharge, handleOpenNewCharge, handleConfirmRenewal, handleSaveRenewalTemplate, handleSaveSettings, createRestorePoint, handleDeleteRestorePoint, importExternalRestorePoint, handleImportData,
}) => {
  const [messageModalState, setMessageModalState] = React.useState<{
    isOpen: boolean;
    client: Client | null;
    charge?: Charge | null;
  }>({ isOpen: false, client: null, charge: null });

  const handleTriggerWhatsApp = (client: Client, charge?: Charge) => {
    // A janela flutuante só deve aparecer se houver mídia/imagem anexada
    if (data.settings?.whatsappMedia) {
      setMessageModalState({ isOpen: true, client, charge });
    } else {
      // Sem imagem anexada, abre imediatamente o contato para mensagem de texto
      void handleSendWhatsApp(client, charge);
    }
  };

  const handleRequestDeleteRestorePoint = (point: SystemRestorePoint) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Ponto de Restauração',
      message: `Tem certeza que deseja excluir permanentemente o ponto de restauração "${point.name}" (${point.clientsCount} clientes, ${point.chargesCount} cobranças)?`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          await handleDeleteRestorePoint(point.id);
        } catch (err) {
          logger.error('Error deleting restore point:', err);
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden bg-[#0F172A] text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-xs">
            M
          </div>
          <span className="font-bold text-sm tracking-tight text-white">MrGestor</span>
        </div>
      </header>
      {/* Sidebar / Nav */}
      <Sidebar 
        activeSection={activeSection} 
        onSelectSection={(sec) => {
          if (sec === 'clients') setClientStatusFilter('all');
          setActiveSection(sec);
        }} 
      />
      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-3.5 sm:p-8 max-w-7xl w-full mx-auto pb-32 md:pb-12">
        {activeSection === 'dashboard' && (
          <DashboardView
            data={data}
            onNavigate={handleNavigate}
            onOpenNewClient={handleOpenNewClient}
            onMarkPaid={handleMarkPaid}
            onUndoPaid={handleUndoPaid}
            onSendWhatsApp={handleTriggerWhatsApp}
            onOpenRenewClient={handleOpenRenewClient}
            onOpenEditClient={handleOpenEditClient}
            onDeleteClient={handleDeleteClient}
            onDeleteCharge={handleDeleteCharge}
          />
        )}
        {activeSection === 'clients' && (
          <ClientsView
            clients={data.clients}
            charges={data.charges}
            initialStatusFilter={clientStatusFilter}
            onOpenNewClient={handleOpenNewClient}
            onOpenEditClient={handleOpenEditClient}
            onUpdatePhone={handleUpdateClientPhone}
            onDeleteClient={handleDeleteClient}
            onDeleteBatch={handleDeleteBatch}
            onOpenHistory={setHistoryClient}
            onSendWhatsApp={(client) => handleTriggerWhatsApp(client)}
            onOpenRenewClient={handleOpenRenewClient}
          />
        )}
        {activeSection === 'charges' && (
          <ChargesView
            clients={data.clients}
            charges={data.charges}
            settings={data.settings}
            sentLogs={data.sentLogs}
            onMarkPaid={handleMarkPaid}
            onUndoPaid={handleUndoPaid}
            onDeleteCharge={handleDeleteCharge}
            onSendWhatsApp={handleTriggerWhatsApp}
            onDeleteSentLog={handleDeleteSentLog}
            onDeleteSentLogsBatch={handleDeleteSentLogsBatch}
            onDeleteChargesBatch={handleDeleteChargesBatch}
            onToggleMessageSent={handleToggleMessageSent}
          />
        )}
        {activeSection === 'due' && (
          <DueView
            clients={data.clients}
            charges={data.charges}
            settings={data.settings}
            sentLogs={data.sentLogs}
            initialFilter={dueTabFilter}
            onMarkPaid={handleMarkPaid}
            onUndoPaid={handleUndoPaid}
            onSendWhatsApp={handleTriggerWhatsApp}
            onOpenRenewClient={handleOpenRenewClient}
            onOpenEditClient={handleOpenEditClient}
            onDeleteClient={handleDeleteClient}
            onDeleteClientsBatch={handleDeleteBatch}
            onDeleteCharge={handleDeleteCharge}
            onDeleteChargesBatch={handleDeleteChargesBatch}
          />
        )}
        {activeSection === 'profile' && (
          <ProfileView
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
          />
        )}
        {activeSection === 'notices' && (
          <NoticesConfigView
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
          />
        )}
        {activeSection === 'settings' && (
          <SettingsView
            settings={data.settings}
            onSaveSettings={handleSaveSettings}
            clients={data.clients}
            charges={data.charges}
            restorePoints={restorePoints}
            onCreateRestorePoint={(name) => createRestorePoint(name, false)}
            onDeleteRestorePoint={handleDeleteRestorePoint}
            onRequestDeleteRestorePoint={handleRequestDeleteRestorePoint}
            onImportExternalRestorePoint={importExternalRestorePoint}
            onSync={handleManualSync}
            isSyncing={isSyncing}
            syncError={syncError}
            onImportData={handleImportData}
          />
        )}
      </main>
      {/* Modals */}
      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSave={handleSaveClient}
        onSaveBatch={handleSaveBatch}
        onDeleteClient={handleDeleteClient}
        clientToEdit={clientToEdit}
        clients={data.clients}
      />
      <ChargeModal
        isOpen={isChargeModalOpen}
        onClose={() => setIsChargeModalOpen(false)}
        onSave={handleSaveCharge}
        clients={data.clients}
        defaultClientId={chargeDefaultClientId}
      />
      <ClientHistoryModal
        isOpen={!!historyClient}
        onClose={() => setHistoryClient(null)}
        client={historyClient}
        charges={data.charges}
        settings={data.settings}
        onMarkPaid={handleMarkPaid}
        onUndoPaid={handleUndoPaid}
        onSendWhatsApp={handleTriggerWhatsApp}
        onOpenRenewClient={handleOpenRenewClient}
        onDeleteCharge={handleDeleteCharge}
        onDeleteClient={handleDeleteClient}
        onNewChargeForClient={(clientId) => {
          setHistoryClient(null);
          handleOpenNewCharge(clientId);
        }}
      />
      <RenewalModal
        isOpen={isRenewalModalOpen}
        client={renewalClient}
        settings={data.settings}
        onClose={() => setIsRenewalModalOpen(false)}
        onConfirmRenewal={handleConfirmRenewal}
        onSaveRenewalTemplate={handleSaveRenewalTemplate}
        onSaveSettings={handleSaveSettings}
      />
      {/* Floating Renewal Confirmation Toast */}
      <RenewalSuccessToast
        toast={renewalToast}
        settings={data.settings}
        onClose={() => setRenewalToast(null)}
      />
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">{confirmModal.title}</h3>
              </div>
            </div>
            <p className="text-slate-600 text-xs font-mono leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Send WhatsApp Composer Modal */}
      <SendMessageModal
        isOpen={messageModalState.isOpen}
        client={messageModalState.client}
        charge={messageModalState.charge}
        settings={data.settings}
        onClose={() => setMessageModalState({ isOpen: false, client: null, charge: null })}
        onSendConfirm={(client, charge, customText) => {
          recordSentMessage(client, charge, customText);
        }}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
};
