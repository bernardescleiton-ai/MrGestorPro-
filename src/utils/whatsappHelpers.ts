import { CompanySettings } from '../types';
import { normalizePhone } from './formatters';

export const encodeForWhatsApp = (text: string): string => {
  if (!text) return '';
  return encodeURIComponent(text);
};

export const openWhatsAppLink = (phoneInput: string, text: string, settings?: CompanySettings): void => {
  const phone = normalizePhone(phoneInput);
  if (!phone) {
    alert('Cliente sem WhatsApp cadastrado.');
    return;
  }

  const fullPhone = phone.length <= 11 && !phone.startsWith('55') ? `55${phone}` : phone;
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
  const defaultTemplate = 'Olá, {nome}! Tudo bem?\n\nPassando para lembrar sobre o seu vencimento cadastrado para: *{vencimento}*.';
  const template = settings?.messageTemplate && settings.messageTemplate.trim()
    ? settings.messageTemplate 
    : defaultTemplate;

  const dueDateFormatted = client.dueDate ? formatDateTimeBR(client.dueDate) : 'a definir';
  let msg = template
    .replace(/{nome}|{cliente}/gi, () => client.name || '')
    .replace(/{vencimento}|{venc}|{data}/gi, () => dueDateFormatted || '')
    .replace(/{empresa}/gi, () => settings?.name || '')
    .replace(/{pix}/gi, () => settings?.pixKey || '')
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

  openWhatsAppLink(client.phone, msg, settings);
};
