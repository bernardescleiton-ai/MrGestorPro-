import { AppData } from '../types';

export const initialAppData: AppData = {
  settings: {
    name: 'MrGestor',
    phone: '',
    email: '',
    pixKey: '',
    address: '',
    signature: 'Atenciosamente, Equipe Financeira',
    messageTemplate: '',
    renewalMessageTemplate: '',
    reminderMessageTemplate: '',
    enableRenewalWhatsAppMessage: true,
    whatsappMethod: 'direct_app'
  },
  clients: [],
  charges: [],
  sentLogs: []
};
