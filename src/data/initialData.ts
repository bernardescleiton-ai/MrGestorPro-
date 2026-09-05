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
    messageSendMode: 'text_only',
    messageTemplateImage: '',
    messageTemplateImageName: '',
    renewalMessageTemplate: '',
    reminderMessageTemplate: '',
    enableRenewalWhatsAppMessage: true,
    whatsappMethod: 'direct_app'
  },
  clients: [],
  charges: [],
  sentLogs: []
};
