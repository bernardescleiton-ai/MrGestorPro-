import { Client, Charge, CompanySettings } from '../types';

export const brl = (v: number): string => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
};

export const dateBR = (s: string): string => {
  if (!s || typeof s !== 'string') return '';
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR');
};

export const todayStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizePhone = (p: string): string => {
  if (!p) return '';
  return p.replace(/\D/g, '');
};

export type ChargeStatus = 'pending' | 'paid' | 'late';

export const getChargeStatus = (c: Charge): ChargeStatus => {
  if (c.paid) return 'paid';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(c.dueDate + 'T12:00:00');
  return due < today ? 'late' : 'pending';
};

export const encodeForWhatsApp = (text: string): string => {
  if (!text) return '';
  return encodeURIComponent(text)
    .replace(/\*/g, '%2A')
    .replace(/_/g, '%5F')
    .replace(/~/g, '%7E')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/!/g, '%21');
};

export const calculateRenewalDueDate = (currentDueDate: string | undefined, monthsToAdd: number): string => {
  const now = new Date();
  let baseDate = new Date();
  let hours = String(now.getHours()).padStart(2, '0');
  let minutes = String(now.getMinutes()).padStart(2, '0');

  if (currentDueDate) {
    const parsed = new Date(currentDueDate);
    if (!isNaN(parsed.getTime())) {
      hours = String(parsed.getHours()).padStart(2, '0');
      minutes = String(parsed.getMinutes()).padStart(2, '0');

      // If current due date is in the future, add months to that future date.
      // If current due date is in the past (overdue), renew starting from TODAY's date so the client stays active in the current month!
      if (parsed > now) {
        baseDate = new Date(parsed.getTime());
      } else {
        baseDate = new Date(now.getTime());
      }
    }
  }

  const nextDate = new Date(baseDate.getTime());
  nextDate.setMonth(nextDate.getMonth() + monthsToAdd);

  const year = nextDate.getFullYear();
  const month = String(nextDate.getMonth() + 1).padStart(2, '0');
  const day = String(nextDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const getDefaultMessage = (client: Client, charge: Charge | null | undefined, settings: CompanySettings): string => {
  const template = settings?.messageTemplate !== undefined && settings?.messageTemplate !== null 
    ? settings.messageTemplate 
    : 'Olá, {nome}! Tudo bem?\n\nPassando para lembrar que seu vencimento está agendado para o dia *{vencimento}*.{nota}';

  if (!template || !template.trim()) {
    return settings?.signature || '';
  }

  const dueStr = charge ? (charge.dueTime ? `${dateBR(charge.dueDate)} às ${charge.dueTime}` : dateBR(charge.dueDate)) : (client.dueDate ? formatDateTimeBR(client.dueDate) : 'a definir');
  const noteText = charge?.note ? `\nObservação: ${charge.note}` : '';
  const amountText = charge?.amount ? `R$ ${charge.amount.toFixed(2).replace('.', ',')}` : '';

  let msg = template;

  // 1. Case-insensitive braced tags replacement
  msg = msg
    .replace(/{nome}|{cliente}/gi, () => client.name || '')
    .replace(/{vencimento}|{venc}|{data}/gi, () => dueStr || '')
    .replace(/{valor}|{quantia}/gi, () => amountText || '')
    .replace(/{nota}|{observacao}/gi, () => noteText || '');

  // 2. Unbraced tag fallbacks if user typed *vencimento* or *nome* without braces
  if (msg.includes('*vencimento*')) {
    msg = msg.replace(/\*vencimento\*/gi, () => `*${dueStr}*`);
  }
  if (msg.includes('*nome*') || msg.includes('*cliente*')) {
    msg = msg.replace(/\*nome\*|\*cliente\*/gi, () => `*${client.name}*`);
  }

  if (settings?.signature) {
    msg += `\n\n${settings.signature}`;
  }
  return msg;
};

export const openWhatsAppLink = (phoneInput: string, text: string, settings?: CompanySettings) => {
  const phone = normalizePhone(phoneInput);
  if (!phone) {
    alert('Cliente sem WhatsApp cadastrado.');
    return;
  }

  const fullPhone = phone.length <= 11 && !phone.startsWith('55') ? `55${phone}` : phone;
  const encodedText = text ? encodeForWhatsApp(text) : '';
  const method = settings?.whatsappMethod || 'direct_app';

  if (method === 'web') {
    const textParam = encodedText ? `&text=${encodedText}` : '';
    window.open(`https://web.whatsapp.com/send?phone=${fullPhone}${textParam}`, '_blank');
    return;
  }

  if (method === 'wame') {
    const textParam = encodedText ? `?text=${encodedText}` : '';
    window.open(`https://wa.me/${fullPhone}${textParam}`, '_blank');
    return;
  }

  // Method 'direct_app' (Default - Ultra fast direct app launch for WhatsApp & WhatsApp Business)
  const textParam = encodedText ? `&text=${encodedText}` : '';
  const appUrl = `whatsapp://send?phone=${fullPhone}${textParam}`;

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Direct OS handler on Mobile (Android / iOS)
    window.location.href = appUrl;
  } else {
    // Desktop: Try direct protocol scheme
    try {
      const a = document.createElement('a');
      a.href = appUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      }, 500);
    } catch {
      window.open(`https://web.whatsapp.com/send?phone=${fullPhone}${textParam}`, '_blank');
    }
  }
};

export const openWhatsApp = (client: Client, charge: Charge | null | undefined, settings: CompanySettings) => {
  const text = getDefaultMessage(client, charge, settings);
  openWhatsAppLink(client.phone, text, settings);
};

export const openDirectWhatsApp = (client: Client, settings: CompanySettings) => {
  const template = settings?.messageTemplate !== undefined && settings?.messageTemplate !== null 
    ? settings.messageTemplate 
    : 'Olá, {nome}! Tudo bem?\n\nPassando para lembrar sobre o seu vencimento cadastrado para: *{vencimento}*.';

  let msg = '';
  if (template && template.trim()) {
    const dueDateFormatted = client.dueDate ? formatDateTimeBR(client.dueDate) : 'a definir';
    msg = template
      .replace(/{nome}|{cliente}/gi, () => client.name || '')
      .replace(/{vencimento}|{venc}|{data}/gi, () => dueDateFormatted || '')
      .replace(/{valor}|{quantia}/gi, () => '')
      .replace(/{nota}|{observacao}/gi, () => '');

    if (msg.includes('*vencimento*')) {
      msg = msg.replace(/\*vencimento\*/gi, () => `*${dueDateFormatted}*`);
    }
    if (msg.includes('*nome*') || msg.includes('*cliente*')) {
      msg = msg.replace(/\*nome\*|\*cliente\*/gi, () => `*${client.name}*`);
    }

    if (settings?.signature) {
      msg += `\n\n${settings.signature}`;
    }
  } else if (settings?.signature) {
    msg = settings.signature;
  }

  openWhatsAppLink(client.phone, msg, settings);
};

export const formatDateTimeBR = (isoStr?: string): string => {
  if (!isoStr) return '—';
  const [datePart, timePart] = isoStr.split('T');
  if (!datePart) return isoStr;
  const formattedDate = dateBR(datePart);
  return timePart ? `${formattedDate} às ${timePart}` : formattedDate;
};

export const getDaysUntilDue = (dueDateStr?: string): number | null => {
  if (!dueDateStr || typeof dueDateStr !== 'string') return null;
  const datePart = dueDateStr.split('T')[0];
  if (!datePart) return null;
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;

  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueReset = new Date(y, m - 1, d);

  const diffMs = dueReset.getTime() - todayReset.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

export const getClientStatusBadge = (dueDateStr?: string) => {
  if (!dueDateStr || typeof dueDateStr !== 'string') {
    return {
      label: 'Sem Vencimento',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
  }

  const datePart = dueDateStr.split('T')[0];
  if (!datePart) {
    return {
      label: 'Sem Vencimento',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
  }
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) {
    return {
      label: 'Sem Vencimento',
      className: 'bg-slate-100 text-slate-600 border border-slate-200',
    };
  }

  const today = new Date();
  const todayReset = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueReset = new Date(y, m - 1, d);

  const diffMs = dueReset.getTime() - todayReset.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return {
      label: 'Vence Hoje',
      className: 'bg-amber-100 text-amber-800 border border-amber-300 font-bold',
    };
  } else if (diffDays > 0) {
    const label = diffDays === 1 ? 'Vence em 1 dia' : `Vence em ${diffDays} dias`;
    return {
      label,
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold',
    };
  } else {
    const overdueDays = Math.abs(diffDays);
    const label = overdueDays === 1 ? 'Atrasado (1 dia)' : `Atrasado (${overdueDays} dias)`;
    return {
      label,
      className: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
    };
  }
};


