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

  const trimmedRaw = rawText.trim();
  const clientEntries: ParsedBulkClient[] = [];

  // Strategy 1: Paragraphs separated by blank lines (e.g. \n\n)
  if (trimmedRaw.includes('\n\n') || trimmedRaw.includes('\r\n\r\n')) {
    const blocks = trimmedRaw.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
    if (blocks.length > 1) {
      for (const block of blocks) {
        const parsed = parseClientText(block);
        const finalName = cleanClientName(parsed.name || block.split('\n')[0]);
        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: parsed.phone || '',
            dueDate: parsed.dueDate || '',
            notes: parsed.notes || '',
          });
        }
      }
      if (clientEntries.length > 0) {
        return clientEntries;
      }
    }
  }

  // Strategy 2: Labeled blocks with "Nome:" or "Cliente:"
  const hasMultipleNameLabels = (trimmedRaw.match(/^(?:nome|cliente|empresa)\s*[:=-]/gim) || []).length > 1;
  if (hasMultipleNameLabels) {
    const lines = trimmedRaw.split('\n').map((l) => l.trim()).filter(Boolean);
    let currentBlock: string[] = [];
    for (const line of lines) {
      if (/^(?:nome|cliente|empresa)\s*[:=-]/i.test(line) && currentBlock.length > 0) {
        const parsed = parseClientText(currentBlock.join('\n'));
        const finalName = cleanClientName(parsed.name);
        if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
          clientEntries.push({
            name: finalName,
            phone: parsed.phone || '',
            dueDate: parsed.dueDate || '',
            notes: parsed.notes || '',
          });
        }
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) {
      const parsed = parseClientText(currentBlock.join('\n'));
      const finalName = cleanClientName(parsed.name);
      if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
        clientEntries.push({
          name: finalName,
          phone: parsed.phone || '',
          dueDate: parsed.dueDate || '',
          notes: parsed.notes || '',
        });
      }
    }
    if (clientEntries.length > 0) {
      return clientEntries;
    }
  }

  // Strategy 3: Line-by-line and sliding window parsing
  const lines = trimmedRaw.split('\n').map((l) => l.trim()).filter(Boolean);
  let i = 0;
  while (i < lines.length) {
    const l1 = lines[i];
    const l2 = lines[i + 1] || '';
    const l3 = lines[i + 2] || '';

    // If single line has delimiters or contains name + date + optional phone
    const hasDelimiter = /[,;\t|]/.test(l1) || /\s+-\s+/.test(l1);
    const parsedSingle = parseClientText(l1);
    const singleHasDateOrPhone = Boolean(parsedSingle.dueDate || parsedSingle.phone);

    // If l1 contains both a name and a date or phone (e.g. "João Silva - 15/10/2026 - 11999999999" or "João Silva 15/10/2026")
    if ((hasDelimiter || singleHasDateOrPhone) && parsedSingle.name && !isDateString(parsedSingle.name) && !isPhoneNumber(parsedSingle.name)) {
      const finalName = cleanClientName(parsedSingle.name);
      if (finalName) {
        clientEntries.push({
          name: finalName,
          phone: parsedSingle.phone || '',
          dueDate: parsedSingle.dueDate || '',
          notes: parsedSingle.notes || '',
        });
        i += 1;
        continue;
      }
    }

    const l1Date = isDateString(l1);
    const l2Date = isDateString(l2);
    const l3Date = isDateString(l3);

    const l1Phone = isPhoneNumber(l1);
    const l2Phone = isPhoneNumber(l2);
    const l3Phone = isPhoneNumber(l3);

    const l1Name = !l1Date && !l1Phone;
    const l2Name = l2 ? !l2Date && !l2Phone : false;
    const l3Name = l3 ? !l3Date && !l3Phone : false;

    // --- CASE 1: 3-line block with 1 Name, 1 Date, 1 Phone (in ANY order) ---
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

    // --- CASE 3: Single line containing Name ---
    if (!l1Date && !l1Phone) {
      const finalName = cleanClientName(parsedSingle.name || l1);

      if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
        clientEntries.push({
          name: finalName,
          phone: parsedSingle.phone || '',
          dueDate: parsedSingle.dueDate || '',
          notes: parsedSingle.notes || '',
        });
      }
    }

    i += 1;
  }

  return clientEntries;
}
