export interface Client {
  id: string;
  name: string;
  phone: string;
  dueDate?: string; // YYYY-MM-DDTHH:mm
  notes?: string;
  createdAt: string;
}

export interface Charge {
  id: string;
  clientId: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm optional (ex: "01:35")
  note?: string;
  paid: boolean;
  paidAt?: string;
  messageSent?: boolean;
  messageSentAt?: string;
  createdAt: string;
}

export interface SentMessageLog {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  chargeId?: string;
  dueDate?: string;
  sentAt: string; // ISO string timestamp
  messageText: string;
  note?: string;
  status: 'enviado';
}

export interface NotificationRules {
  enabled: boolean;
  notifyOnDueDate: boolean; // No dia do vencimento
  notify1DayBefore: boolean; // 1 dia antes do vencimento
  notify3DaysBefore: boolean; // 3 dias antes do vencimento
  notify1DayAfter: boolean; // 1 dia após o vencimento (1 dia de atraso)
  notify3DaysAfter: boolean; // 3 dias após o vencimento (3 dias de atraso)
}

export interface CompanySettings {
  name: string;
  phone: string;
  email?: string;
  pixKey?: string;
  address: string;
  signature: string;
  messageTemplate?: string; // Template da mensagem de cobrança padrão
  renewalMessageTemplate?: string; // Template da mensagem de renovação
  reminderMessageTemplate?: string; // Template da mensagem de lembrete preventivo
  enableRenewalWhatsAppMessage?: boolean; // Liga/Desliga geral para mensagem de renovação
  whatsappMethod?: 'direct_app' | 'web' | 'wame'; // Método de abertura do WhatsApp (App direto, Web, ou wa.me)
  managerPhone?: string; // Celular do gestor para receber alertas
  notificationRules?: NotificationRules;
}

export interface SystemRestorePoint {
  id: string;
  name: string;
  createdAt: string;
  clientsCount: number;
  chargesCount: number;
  data: {
    clients: Client[];
    charges: Charge[];
    settings: CompanySettings;
  };
}

export interface AppData {
  clients: Client[];
  charges: Charge[];
  settings: CompanySettings;
  sentLogs?: SentMessageLog[];
  updatedAt?: number;
}

export type SectionType = 'dashboard' | 'clients' | 'due' | 'charges' | 'profile' | 'notices' | 'settings';
