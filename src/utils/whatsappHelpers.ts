import { Client, CompanySettings } from '../types';
import { formatDateTimeBR, getDaysUntilDue, dateBR } from './dateFormatters';

const normalizePhoneDigits = (p: string): string => {
  if (!p) return '';
  return p.replace(/\D/g, '');
};

export const getWhatsAppFullPhone = (phoneInput: string): string => {
  if (!phoneInput) return '';
  const trimmed = String(phoneInput).trim();
  const digits = normalizePhoneDigits(trimmed);
  if (!digits) return '';

  const hasPlus = trimmed.startsWith('+') || trimmed.startsWith('00');

  // If explicit '+' or '00' international prefix, use digits directly
  if (hasPlus) {
    return digits.replace(/^00/, '');
  }

  // Already has Brazil DDI (55) with valid length (12 or 13 digits)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Portugal (DDI 351) with 12 digits (351 + 9 digits)
  if (digits.startsWith('351') && digits.length === 12) {
    return digits;
  }

  // UK (DDI 44) with 11-13 digits
  if (digits.startsWith('44') && digits.length >= 11 && digits.length <= 13) {
    return digits;
  }

  // Spain (DDI 34) with 11 digits
  if (digits.startsWith('34') && digits.length === 11) {
    return digits;
  }

  // France (DDI 33) with 11 digits
  if (digits.startsWith('33') && digits.length === 11) {
    return digits;
  }

  // Italy (DDI 39) with 12 digits
  if (digits.startsWith('39') && digits.length === 12) {
    return digits;
  }

  // Germany (DDI 49) with 12-14 digits
  if (digits.startsWith('49') && digits.length >= 12 && digits.length <= 14) {
    return digits;
  }

  // Argentina (DDI 54) with 12-13 digits
  if (digits.startsWith('54') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }

  // USA / Canada (DDI 1) with 11 digits (e.g. 1 + area code 200-999)
  if (digits.startsWith('1') && digits.length === 11 && (digits[1] !== '1' || digits[2] !== '9')) {
    return digits;
  }

  // Standard Brazilian 10 or 11 digits without 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  // Short Brazilian 8 or 9 digits
  if (digits.length === 8 || digits.length === 9) {
    return `55${digits}`;
  }

  return digits;
};

export const encodeForWhatsApp = (text: string): string => {
  if (!text) return '';
  return encodeURIComponent(text);
};

export const openWhatsAppLink = (phoneInput: string, text: string, settings?: CompanySettings): void => {
  const fullPhone = getWhatsAppFullPhone(phoneInput);
  if (!fullPhone) {
    alert('Cliente sem WhatsApp cadastrado.');
    return;
  }

  const encodedText = text ? encodeForWhatsApp(text) : '';
  const method = settings?.whatsappMethod || 'direct_app';

  if (method === 'web') {
    const targetUrl = `https://web.whatsapp.com/send?phone=${fullPhone}${encodedText ? `&text=${encodedText}` : ''}`;
    try {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 150);
    } catch {
      window.open(targetUrl, '_blank');
    }
    return;
  }

  if (method === 'wame') {
    const targetUrl = `https://wa.me/${fullPhone}${encodedText ? `?text=${encodedText}` : ''}`;
    try {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 150);
    } catch {
      window.open(targetUrl, '_blank');
    }
    return;
  }

  const nativeAppUrl = `whatsapp://send?phone=${fullPhone}${encodedText ? `&text=${encodedText}` : ''}`;
  try {
    const a = document.createElement('a');
    a.href = nativeAppUrl;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 200);
  } catch {
    window.location.href = nativeAppUrl;
  }
};

export const openDirectWhatsApp = (client: Client, settings: CompanySettings): void => {
  const fullDueDate = client.dueDate || '';
  const dueDiff = fullDueDate ? getDaysUntilDue(fullDueDate) : null;
  const isOverdue = dueDiff !== null && dueDiff < 0;
  const isOverdue5Days = dueDiff !== null && dueDiff <= -5;

  const legacySettings = settings as Record<string, string | undefined>;
  const customOverdue5 = settings?.overdue5DaysMessageTemplate?.trim() || legacySettings?.templateExpired?.trim() || legacySettings?.overdueMessageTemplate?.trim();
  const customStandard = settings?.messageTemplate?.trim() || legacySettings?.templateDue?.trim();

  let template = '';
  if (isOverdue5Days && customOverdue5) {
    template = customOverdue5;
  } else if (customStandard) {
    template = customStandard;
  } else if (isOverdue && customOverdue5) {
    template = customOverdue5;
  } else {
    if (isOverdue) {
      template = 'Olá {nome}! Tudo bem?\n\nPassando para avisar que o seu vencimento cadastrado para {vencimento} está pendente.\n\nChave PIX: {pix}\n\nAtenciosamente, {empresa}.';
    } else {
      template = 'Olá {nome}! Tudo bem?\n\nPassando para lembrar sobre o seu vencimento cadastrado para: {vencimento}.\n\nChave PIX: {pix}\n\nAtenciosamente, {empresa}.';
    }
  }

  const dueDateFormatted = fullDueDate
    ? (fullDueDate.includes('T') || fullDueDate.includes(':') ? formatDateTimeBR(fullDueDate) : dateBR(fullDueDate))
    : 'a definir';
  const empresaStr = settings?.name || '';
  const pixStr = settings?.pixKey || '';
  const phoneStr = settings?.phone || '';
  const addressStr = settings?.address || '';
  const noteText = client.notes || '';

  let msg = template
    .replace(/{nome}|{cliente}/gi, () => client.name || '')
    .replace(/{vencimento}|{venc}|{data}/gi, () => dueDateFormatted || '')
    .replace(/{empresa}/gi, () => empresaStr)
    .replace(/{pix}|{chavepix}|{chave_pix}/gi, () => pixStr)
    .replace(/{telefone}|{contato}|{whatsapp}/gi, () => phoneStr)
    .replace(/{endereco}/gi, () => addressStr)
    .replace(/{valor}|{quantia}/gi, () => '')
    .replace(/{nota}|{observacao}|{obs}/gi, () => noteText);

  if (msg.includes('*vencimento*')) {
    msg = msg.replace(/\*vencimento\*/gi, () => `*${dueDateFormatted}*`);
  }
  if (msg.includes('*nome*') || msg.includes('*cliente*')) {
    msg = msg.replace(/\*nome\*|\*cliente\*/gi, () => `*${client.name}*`);
  }
  if (msg.includes('*pix*')) {
    msg = msg.replace(/\*pix\*/gi, () => (pixStr ? `*${pixStr}*` : ''));
  }

  if (settings?.signature && settings.signature.trim() && !msg.includes(settings.signature.trim())) {
    msg += `\n\n${settings.signature.trim()}`;
  }

  openWhatsAppLink(client.phone, msg, settings);
};
