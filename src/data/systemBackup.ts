import { AppData } from '../types';

export const systemBackupSnapshot: AppData = {
  settings: {
    name: 'MrGestor',
    phone: '',
    address: '',
    signature: 'Atenciosamente, MrGestor',
    messageTemplate: ''
  },
  clients: [],
  charges: [],
  sentLogs: [],
  updatedAt: Date.now()
};
