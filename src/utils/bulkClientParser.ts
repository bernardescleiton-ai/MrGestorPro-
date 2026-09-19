import {
  isDateString,
  isPhoneNumber,
  cleanClientName,
  extractPhoneNumber,
  parseDateAndTimeString,
  parseClientText,
  ParsedBulkClient,
} from './clientParser';

export function parseBulkClients(rawText: string): ParsedBulkClient[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const clientEntries: ParsedBulkClient[] = [];

  let i = 0;
  while (i < lines.length) {
    const l1 = lines[i];
    const l2 = lines[i + 1] || '';
    const l3 = lines[i + 2] || '';

    const l1Date = isDateString(l1);
    const l2Date = isDateString(l2);
    const l3Date = isDateString(l3);

    const l1Phone = isPhoneNumber(l1);
    const l2Phone = isPhoneNumber(l2);
    const l3Phone = isPhoneNumber(l3);

    const l1Name = !l1Date && !l1Phone;
    const l2Name = l2 ? !l2Date && !l2Phone : false;
    const l3Name = l3 ? !l3Date && !l3Phone : false;

    // --- CASE 1: 3-line block with 1 Name, 1 Date, 1 Phone (in ANY order among l1, l2, l3) ---
    const window3 = [
      { text: l1, isDate: l1Date, isPhone: l1Phone, isName: l1Name },
      { text: l2, isDate: l2Date, isPhone: l2Phone, isName: l2Name },
      { text: l3, isDate: l3Date, isPhone: l3Phone, isName: l3Name },
    ];

    const datesIn3 = window3.filter((x) => x.isDate);
    const phonesIn3 = window3.filter((x) => x.isPhone);
    const namesIn3 = window3.filter((x) => x.isName);

    if (namesIn3.length === 1 && datesIn3.length === 1 && phonesIn3.length === 1) {
      const rawNameStr = namesIn3[0].text;
      const finalName = cleanClientName(rawNameStr);
      const dueDate = parseDateAndTimeString(datesIn3[0].text);
      const phone = extractPhoneNumber(phonesIn3[0].text);

      if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
        clientEntries.push({
          name: finalName,
          phone: phone,
          dueDate: dueDate,
          notes: '',
        });
      }
      i += 3;
      continue;
    }

    // --- CASE 2: 2-line block with (Name and Date) OR (Name and Phone) ---
    if (l2) {
      if (l1Name && l2Date) {
        const finalName = cleanClientName(l1);
        const dueDate = parseDateAndTimeString(l2);
        const phone = extractPhoneNumber(l1);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: dueDate,
            notes: '',
          });
        }
        i += 2;
        continue;
      }

      if (l1Date && l2Name) {
        const finalName = cleanClientName(l2);
        const dueDate = parseDateAndTimeString(l1);
        const phone = extractPhoneNumber(l2);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: dueDate,
            notes: '',
          });
        }
        i += 2;
        continue;
      }

      if (l1Name && l2Phone) {
        const finalName = cleanClientName(l1);
        const phone = extractPhoneNumber(l2);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: '',
            notes: '',
          });
        }
        i += 2;
        continue;
      }

      if (l1Phone && l2Name) {
        const finalName = cleanClientName(l2);
        const phone = extractPhoneNumber(l1);

        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: phone,
            dueDate: '',
            notes: '',
          });
        }
        i += 2;
        continue;
      }
    }

    // --- CASE 3: Single line containing Name, or Name + Date + Phone combined ---
    if (!l1Date && !l1Phone) {
      const parsed = parseClientText(l1);
      const finalName = cleanClientName(parsed.name || l1);

      if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
        clientEntries.push({
          name: finalName,
          phone: parsed.phone || '',
          dueDate: parsed.dueDate || '',
          notes: parsed.notes || '',
        });
      }
    }

    i += 1;
  }

  return clientEntries;
}
