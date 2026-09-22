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

  // Strategy 1: Explicit labels with "Nome:" or "Cliente:"
  const hasMultipleNameLabels = (trimmedRaw.match(/^(?:nome|cliente|empresa)\s*[:=-]/gim) || []).length > 1;
  if (hasMultipleNameLabels) {
    const lines = trimmedRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
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

  // Strategy 2: Universal streaming finite-state parser
  const allLines = trimmedRaw.split(/\r?\n/).map((l) => l.trim());

  let currentName = '';
  let currentDate = '';
  let currentPhone = '';
  let currentNotes = '';

  const commitCurrent = () => {
    const finalName = cleanClientName(currentName);
    if (finalName && !isDateString(finalName) && !isPhoneNumber(finalName)) {
      clientEntries.push({
        name: finalName,
        phone: currentPhone || '',
        dueDate: currentDate || '',
        notes: currentNotes || '',
      });
    }
    currentName = '';
    currentDate = '';
    currentPhone = '';
    currentNotes = '';
  };

  for (let idx = 0; idx < allLines.length; idx++) {
    const line = allLines[idx];

    // Blank line indicates boundary
    if (!line) {
      if (currentName) {
        commitCurrent();
      }
      continue;
    }

    // Check if line is a single-line CSV / TSV / Delimited entry with multiple fields
    const hasDelimiter = /[,;\t|]/.test(line) || /\s+-\s+/.test(line);
    const parsedSingle = parseClientText(line);
    const singleHasDateOrPhone = Boolean(parsedSingle.dueDate || parsedSingle.phone);

    if (hasDelimiter || (singleHasDateOrPhone && parsedSingle.name && !isDateString(parsedSingle.name) && !isPhoneNumber(parsedSingle.name))) {
      const finalName = cleanClientName(parsedSingle.name);
      if (finalName && (parsedSingle.dueDate || parsedSingle.phone || hasDelimiter)) {
        if (currentName) {
          commitCurrent();
        }
        clientEntries.push({
          name: finalName,
          phone: parsedSingle.phone || '',
          dueDate: parsedSingle.dueDate || '',
          notes: parsedSingle.notes || '',
        });
        continue;
      }
    }

    // Labeled fields
    if (/^(?:nome|cliente|empresa)\s*[:=-]/i.test(line)) {
      if (currentName) {
        commitCurrent();
      }
      const val = line.replace(/^(?:nome|cliente|empresa)\s*[:=-]\s*/i, '').trim();
      currentName = cleanClientName(val);
      continue;
    }

    if (/^(?:vencimento|venc|vence|data|validade)\s*[:=-]/i.test(line)) {
      const val = line.replace(/^(?:vencimento|venc|vence|data|validade)\s*[:=-]\s*/i, '').trim();
      const parsedDate = parseDateAndTimeString(val);
      if (currentDate) {
        commitCurrent();
      }
      currentDate = parsedDate;
      continue;
    }

    if (/^(?:whatsapp|whats|wpp|telefone|tel|celular|cel|fone|phone|mobile)\s*[:=-]/i.test(line)) {
      const parsedPh = extractPhoneNumber(line);
      if (currentPhone) {
        commitCurrent();
      }
      currentPhone = parsedPh;
      continue;
    }

    // Unlabelled lines:
    const isDate = isDateString(line);
    const isPhone = isPhoneNumber(line);

    if (isDate) {
      if (currentDate) {
        commitCurrent();
      }
      currentDate = parseDateAndTimeString(line);
    } else if (isPhone) {
      if (currentPhone) {
        commitCurrent();
      }
      currentPhone = extractPhoneNumber(line);
    } else {
      // It's a Name line
      if (currentName) {
        commitCurrent();
      }
      currentName = cleanClientName(line);
    }
  }

  // Commit last client if pending
  if (currentName) {
    commitCurrent();
  }

  return clientEntries;
}
