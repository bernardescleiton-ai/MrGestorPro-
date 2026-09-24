import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  FileText,
  Phone,
  Mail,
  FileEdit,
  Sparkles,
  Wand2,
  CheckCircle2,
  Users,
  Upload,
  Trash2,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  Check,
  Search,
  Filter,
  CheckSquare,
  Square,
  Ban,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { Client, BatchSavePayload } from '../types';
import {
  ParsedBulkClient,
  parseClientText,
  parseBulkClients,
  isDuplicateClientName,
  normalizeNameForComparison,
  cleanClientName,
  isDateString,
  parseDateAndTimeString,
  addOffsetToCurrentDate,
  formatForDateTimeInput,
} from '../utils/clientParser';
import { formatDateTimeBR } from '../utils/formatters';

export type { ParsedBulkClient };
export {
  parseClientText,
  parseBulkClients,
  isDuplicateClientName,
  normalizeNameForComparison,
  cleanClientName,
  isDateString,
  parseDateAndTimeString,
  addOffsetToCurrentDate,
};

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: Omit<Client, 'id' | 'createdAt'>, editId?: string) => void;
  onSaveBatch?: (payload: Omit<Client, 'id' | 'createdAt'>[] | BatchSavePayload) => void;
  onDeleteClient?: (clientId: string) => void;
  clientToEdit?: Client | null;
  clients?: Client[];
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveBatch,
  onDeleteClient,
  clientToEdit,
  clients,
}) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single client state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [autoOrganizedAlert, setAutoOrganizedAlert] = useState<string | null>(null);

  // Bulk import state
  const [bulkInput, setBulkInput] = useState('');
  const [parsedBulkList, setParsedBulkList] = useState<ParsedBulkClient[]>([]);
  const [bulkFilter, setBulkFilter] = useState<'all' | 'new' | 'system_duplicate' | 'batch_duplicate' | 'selected'>('all');
  const [bulkSearchQuery, setBulkSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const duplicateFound = useMemo(() => {
    return isDuplicateClientName(name, clients || [], clientToEdit?.id);
  }, [name, clients, clientToEdit]);

  const bulkStats = useMemo(() => {
    let toCreate = 0;
    let toUpdate = 0;
    let ignored = 0;
    let selectedCount = 0;
    let systemDups = 0;
    let batchDups = 0;
    let brandNew = 0;

    for (const item of parsedBulkList) {
      const isSelected = item.selected !== false;
      if (isSelected) {
        selectedCount++;
        if (item.action === 'create') toCreate++;
        else if (item.action === 'update') toUpdate++;
        else if (item.action === 'ignore') ignored++;
      } else {
        ignored++;
      }

      if (item.comparison?.isExisting) systemDups++;
      else if (item.comparison?.isBatchDuplicate) batchDups++;
      else brandNew++;
    }

    return {
      total: parsedBulkList.length,
      selectedCount,
      toCreate,
      toUpdate,
      ignored,
      systemDups,
      batchDups,
      brandNew,
    };
  }, [parsedBulkList]);

  const filteredBulkList = useMemo(() => {
    return parsedBulkList.filter((item) => {
      const query = bulkSearchQuery.trim().toLowerCase();
      if (query) {
        const matchName = item.name.toLowerCase().includes(query);
        const matchPhone = item.phone.toLowerCase().includes(query);
        if (!matchName && !matchPhone) return false;
      }

      if (bulkFilter === 'all') return true;
      if (bulkFilter === 'selected') return item.selected !== false && item.action !== 'ignore';
      if (bulkFilter === 'new') return !item.comparison?.isExisting && !item.comparison?.isBatchDuplicate;
      if (bulkFilter === 'system_duplicate') return Boolean(item.comparison?.isExisting);
      if (bulkFilter === 'batch_duplicate') return Boolean(item.comparison?.isBatchDuplicate);
      return true;
    });
  }, [parsedBulkList, bulkFilter, bulkSearchQuery]);

  useEffect(() => {
    if (clientToEdit) {
      setMode('single');
      setName(clientToEdit.name || '');
      setPhone(clientToEdit.phone || '');
      setDueDate(formatForDateTimeInput(clientToEdit.dueDate));
      setNotes(clientToEdit.notes || '');
    } else {
      setMode('single');
      setName('');
      setPhone('');
      setDueDate('');
      setNotes('');
    }
    setPasteInput('');
    setBulkInput('');
    setParsedBulkList([]);
    setBulkFilter('all');
    setBulkSearchQuery('');
    setAutoOrganizedAlert(null);
    setErrorMsg(null);
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAutoOrganize = () => {
    if (!pasteInput.trim()) {
      alert('Por favor, cole as informações do cliente no campo de texto.');
      return;
    }
    const parsed = parseClientText(pasteInput);
    if (parsed.name) setName(parsed.name);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.dueDate) setDueDate(formatForDateTimeInput(parsed.dueDate));
    if (parsed.notes) setNotes(parsed.notes);

    const filledCount = [parsed.name, parsed.phone, parsed.dueDate, parsed.notes].filter(Boolean).length;
    if (filledCount > 0) {
      setAutoOrganizedAlert(`${filledCount} campos organizados com sucesso!`);
      setTimeout(() => setAutoOrganizedAlert(null), 4000);
    } else {
      alert('Não foi possível identificar dados automaticamente no texto.');
    }
  };

  const handleAnalyzeBulk = () => {
    setErrorMsg(null);
    if (!bulkInput.trim()) {
      alert('Por favor, cole a lista de clientes no campo abaixo.');
      return;
    }
    const results = parseBulkClients(bulkInput);
    if (results.length === 0) {
      alert('Nenhum cliente válido foi identificado no texto colado. Verifique o formato.');
      return;
    }

    const safeClients = clients || [];
    const analyzedList: ParsedBulkClient[] = [];
    const seenPhonesInBatch = new Map<string, number>();
    const seenNamesInBatch = new Map<string, number>();

    results.forEach((item, idx) => {
      const cleanPhoneDigits = item.phone ? item.phone.replace(/\D/g, '') : '';
      const phoneNoDDI = cleanPhoneDigits.replace(/^55/, '');
      const normName = normalizeNameForComparison(item.name);

      // Check if duplicate within the current pasted batch
      let isBatchDuplicate = false;
      let batchDuplicateIndex: number | undefined;

      if (phoneNoDDI && phoneNoDDI.length >= 8 && seenPhonesInBatch.has(phoneNoDDI)) {
        isBatchDuplicate = true;
        batchDuplicateIndex = seenPhonesInBatch.get(phoneNoDDI);
      } else if (normName && seenNamesInBatch.has(normName)) {
        isBatchDuplicate = true;
        batchDuplicateIndex = seenNamesInBatch.get(normName);
      }

      // Check if matches existing client in the system
      const systemMatch = isDuplicateClientName(item.name, safeClients, undefined, item.phone);
      const isExisting = Boolean(systemMatch);

      const phoneChanged = Boolean(isExisting && systemMatch && item.phone && item.phone.trim() !== (systemMatch.phone || '').trim());
      const dueDateChanged = Boolean(isExisting && systemMatch && item.dueDate && item.dueDate.trim() !== (systemMatch.dueDate || '').trim());
      const notesChanged = Boolean(isExisting && systemMatch && item.notes && item.notes.trim() !== (systemMatch.notes || '').trim());

      let initialAction: 'create' | 'update' | 'ignore' = 'create';
      let duplicateType: 'none' | 'system_duplicate' | 'batch_duplicate' = 'none';

      if (isExisting) {
        initialAction = 'update';
        duplicateType = 'system_duplicate';
      } else if (isBatchDuplicate) {
        initialAction = 'create';
        duplicateType = 'batch_duplicate';
      }

      analyzedList.push({
        id: `bulk-${idx}-${Date.now()}`,
        name: item.name,
        phone: item.phone,
        dueDate: item.dueDate,
        notes: item.notes,
        action: initialAction,
        selected: true,
        comparison: {
          isExisting,
          existingClientId: systemMatch?.id,
          existingClientName: systemMatch?.name,
          phoneChanged,
          oldPhone: systemMatch?.phone || '',
          newPhone: item.phone,
          dueDateChanged,
          oldDueDate: systemMatch?.dueDate || '',
          newDueDate: item.dueDate,
          notesChanged,
          isBatchDuplicate,
          batchDuplicateIndex,
          duplicateType,
        },
      });

      if (phoneNoDDI && phoneNoDDI.length >= 8 && !seenPhonesInBatch.has(phoneNoDDI)) {
        seenPhonesInBatch.set(phoneNoDDI, idx);
      }
      if (normName && !seenNamesInBatch.has(normName)) {
        seenNamesInBatch.set(normName, idx);
      }
    });

    setParsedBulkList(analyzedList);
  };

  const handleToggleItemSelect = (id?: string) => {
    if (!id) return;
    setParsedBulkList(prev =>
      prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSetItemAction = (id?: string, action?: 'create' | 'update' | 'ignore') => {
    if (!id || !action) return;
    setParsedBulkList(prev =>
      prev.map(item => (item.id === id ? { ...item, action, selected: action !== 'ignore' } : item))
    );
  };

  const handleUpdateItemField = (id: string | undefined, field: 'name' | 'phone' | 'dueDate', value: string) => {
    if (!id) return;
    setParsedBulkList(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveBulkItem = (id?: string) => {
    if (!id) return;
    setParsedBulkList(prev => prev.filter(item => item.id !== id));
  };

  const handleSelectAll = (select: boolean) => {
    setParsedBulkList(prev => prev.map(item => ({ ...item, selected: select })));
  };

  const handleSetAllToCreate = () => {
    setParsedBulkList(prev => prev.map(item => ({ ...item, action: 'create', selected: true })));
  };

  const handleSetAllExistingToUpdate = () => {
    setParsedBulkList(prev =>
      prev.map(item => ({
        ...item,
        action: item.comparison?.isExisting ? 'update' : item.action === 'ignore' ? 'create' : item.action,
        selected: true,
      }))
    );
  };

  const handleIgnoreAllDuplicates = () => {
    setParsedBulkList(prev =>
      prev.map(item => {
        if (item.comparison?.isBatchDuplicate || item.comparison?.isExisting) {
          return { ...item, action: 'ignore', selected: false };
        }
        return item;
      })
    );
  };

  const handleSubmitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedItems = parsedBulkList.filter(item => item.selected !== false && item.action !== 'ignore');
    if (selectedItems.length === 0) {
      alert('Nenhum cliente selecionado para salvar. Selecione pelo menos um cliente marcando sua caixa de seleção e definindo a ação como "Cadastrar Novo" ou "Atualizar Existente".');
      return;
    }

    const toCreate: Omit<Client, 'id' | 'createdAt'>[] = [];
    const toUpdate: { id: string; data: Partial<Client> }[] = [];

    for (const item of selectedItems) {
      if (item.action === 'update' && item.comparison?.existingClientId) {
        const updateData: Partial<Client> = {};
        if (item.name && item.name.trim()) updateData.name = item.name.trim();
        if (item.phone !== undefined) updateData.phone = item.phone.trim();
        if (item.dueDate !== undefined) updateData.dueDate = item.dueDate.trim();
        if (item.notes !== undefined) updateData.notes = item.notes.trim();
        toUpdate.push({
          id: item.comparison.existingClientId,
          data: updateData,
        });
      } else {
        // action === 'create' or user explicitly chose to create as a new client
        toCreate.push({
          name: item.name.trim(),
          phone: item.phone.trim(),
          dueDate: item.dueDate.trim(),
          notes: item.notes.trim(),
        });
      }
    }

    if (onSaveBatch) {
      onSaveBatch({ toCreate, toUpdate });
    } else {
      for (const c of toCreate) onSave(c);
      for (const u of toUpdate) onSave(u.data as any, u.id);
    }
    onClose();
  };

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor, preencha o Nome do cliente.');
      return;
    }

    const trimmedName = name.trim();
    const safeClients = clients || [];
    const duplicate = isDuplicateClientName(trimmedName, safeClients, clientToEdit?.id, phone);
    const targetEditId = clientToEdit ? clientToEdit.id : (duplicate ? duplicate.id : undefined);

    const finalDueDate = dueDate ? formatForDateTimeInput(dueDate) : undefined;

    onSave(
      {
        name: trimmedName,
        phone: phone.trim(),
        dueDate: finalDueDate,
        notes: notes.trim(),
      },
      targetEditId
    );
    onClose();
  };

  const isBulkReviewing = mode === 'bulk' && !clientToEdit && parsedBulkList.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${
          isBulkReviewing ? 'max-w-4xl' : 'max-w-2xl'
        } overflow-hidden border border-slate-100 max-h-[92vh] flex flex-col transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              {clientToEdit ? <FileEdit className="w-5 h-5" /> : <Users className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-800">
                {clientToEdit ? 'Editar Cliente' : 'Cadastrar Clientes'}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {clientToEdit ? 'Atualize os dados do cliente' : 'Adicione ou importe clientes em qualquer formato'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Only for New Client) */}
        {!clientToEdit && (
          <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 shrink-0 gap-1">
            <button
              type="button"
              onClick={() => {
                setMode('single');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                mode === 'single'
                  ? 'bg-white text-blue-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <User className="w-4 h-4" /> Cliente Único
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('bulk');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                mode === 'bulk'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <Upload className="w-4 h-4" /> Importar e Revisar em Massa
            </button>
          </div>
        )}

        {/* Global Modal Alert Banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-4 bg-rose-100 border-2 border-rose-300 text-rose-950 rounded-xl text-xs font-bold flex items-start justify-between shrink-0 shadow-md animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="whitespace-pre-wrap leading-relaxed">{errorMsg}</div>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 hover:bg-rose-200 rounded-lg text-rose-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* BULK IMPORT AND UPDATE MODE */}
        {mode === 'bulk' && !clientToEdit ? (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {parsedBulkList.length === 0 ? (
              /* Paste Input View */
              <div className="bg-indigo-50/80 p-5 rounded-2xl border border-indigo-200 text-indigo-900 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Aceita qualquer formato de lista (mesmo com duplicados):</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Cole sua lista de clientes copiada do <strong>WhatsApp, Excel, Bloco de Notas ou qualquer formato</strong>. Antes de salvar, todos os clientes serão exibidos na tela para você conferir e <strong>determinar exatamente o que fazer com cada cliente ou duplicado</strong> (cadastrar como novo, atualizar existente ou ignorar).
                </p>
                <textarea
                  rows={8}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder={`Exemplos de formatos aceitos:\n\n1111paulo\n12/12/2026\n4899812312\n\n2222joão\n14/12/2016\n51988247311\n\nCarlos Silva, (48) 99999-1111, 25/08/2026\nMaria Santos - 48988882222 - 30/08/2026`}
                  className="w-full p-3 bg-white border border-indigo-300 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={handleAnalyzeBulk}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-4 h-4" /> Processar e Revisar Lista de Clientes
                </button>
              </div>
            ) : (
              /* Interactive Review & Duplicate Determination Screen */
              <div className="space-y-4">
                {/* Stats & Quick Actions Toolbar */}
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                        Revisão de Importação ({bulkStats.total} clientes)
                      </span>
                    </div>
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-bold">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                        {bulkStats.toCreate} novos
                      </span>
                      {bulkStats.toUpdate > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                          {bulkStats.toUpdate} atualizar
                        </span>
                      )}
                      {(bulkStats.systemDups > 0 || bulkStats.batchDups > 0) && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          {bulkStats.systemDups + bulkStats.batchDups} duplicados/conflitos
                        </span>
                      )}
                      {bulkStats.ignored > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
                          {bulkStats.ignored} ignorados
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Filter Tabs & Search */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setBulkFilter('all')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors ${
                          bulkFilter === 'all'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Todos ({bulkStats.total})
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkFilter('new')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors ${
                          bulkFilter === 'new'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                        }`}
                      >
                        Novos ({bulkStats.brandNew})
                      </button>
                      {bulkStats.systemDups > 0 && (
                        <button
                          type="button"
                          onClick={() => setBulkFilter('system_duplicate')}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors ${
                            bulkFilter === 'system_duplicate'
                              ? 'bg-sky-600 text-white shadow-xs'
                              : 'bg-white text-sky-700 border border-sky-200 hover:bg-sky-50'
                          }`}
                        >
                          Existentes ({bulkStats.systemDups})
                        </button>
                      )}
                      {bulkStats.batchDups > 0 && (
                        <button
                          type="button"
                          onClick={() => setBulkFilter('batch_duplicate')}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors ${
                            bulkFilter === 'batch_duplicate'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          Duplicados no Lote ({bulkStats.batchDups})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setBulkFilter('selected')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors ${
                          bulkFilter === 'selected'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                        }`}
                      >
                        Marcados ({bulkStats.selectedCount})
                      </button>
                    </div>

                    <div className="relative flex-1 sm:max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={bulkSearchQuery}
                        onChange={(e) => setBulkSearchQuery(e.target.value)}
                        placeholder="Buscar por nome ou telefone..."
                        className="w-full pl-8 pr-3 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Batch Controls Toolbar */}
                  <div className="flex items-center justify-between flex-wrap gap-1.5 pt-2 border-t border-slate-200 text-xs">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSelectAll(true)}
                        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                        title="Marcar todos os clientes"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Marcar Todos
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectAll(false)}
                        className="px-2 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                        title="Desmarcar todos"
                      >
                        <Square className="w-3.5 h-3.5 text-slate-400" /> Desmarcar Todos
                      </button>
                      <button
                        type="button"
                        onClick={handleSetAllToCreate}
                        className="px-2 py-1 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                        title="Definir todos para cadastrar como novos clientes"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-emerald-600" /> Todos p/ Novo
                      </button>
                      {bulkStats.systemDups > 0 && (
                        <button
                          type="button"
                          onClick={handleSetAllExistingToUpdate}
                          className="px-2 py-1 bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-800 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                          title="Atualizar dados dos clientes já existentes"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-sky-600" /> Atualizar Existentes
                        </button>
                      )}
                      {(bulkStats.systemDups > 0 || bulkStats.batchDups > 0) && (
                        <button
                          type="button"
                          onClick={handleIgnoreAllDuplicates}
                          className="px-2 py-1 bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                          title="Ignorar todos os duplicados"
                        >
                          <Ban className="w-3.5 h-3.5 text-amber-600" /> Ignorar Duplicados
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setParsedBulkList([]);
                        setBulkInput('');
                      }}
                      className="px-2.5 py-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg font-semibold transition-colors"
                    >
                      ↺ Colar Outra Lista
                    </button>
                  </div>
                </div>

                {/* List of Clients to Review */}
                <div className="max-h-[50vh] overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white shadow-xs">
                  {filteredBulkList.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs">
                      Nenhum cliente encontrado para o filtro selecionado.
                    </div>
                  ) : (
                    filteredBulkList.map((item, idx) => {
                      const comp = item.comparison;
                      const isSelected = item.selected !== false;
                      const isActionCreate = item.action === 'create';
                      const isActionUpdate = item.action === 'update';
                      const isActionIgnore = item.action === 'ignore' || !isSelected;

                      return (
                        <div
                          key={item.id || idx}
                          className={`p-3.5 flex flex-col gap-2.5 transition-colors ${
                            isActionIgnore
                              ? 'bg-slate-50/70 opacity-60'
                              : isActionUpdate
                              ? 'bg-sky-50/30 hover:bg-sky-50/60 border-l-4 border-l-sky-500'
                              : comp?.isBatchDuplicate
                              ? 'bg-amber-50/20 hover:bg-amber-50/40 border-l-4 border-l-amber-500'
                              : 'bg-white hover:bg-emerald-50/20 border-l-4 border-l-emerald-500'
                          }`}
                        >
                          {/* Top Row: Checkbox, Index, Badges, Action Selector, Delete */}
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleItemSelect(item.id)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                title="Marcar para salvar"
                              />
                              <span className="text-[10px] font-mono text-slate-400 font-bold">
                                #{idx + 1}
                              </span>

                              {/* Status Badges */}
                              {comp?.isExisting ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 text-sky-600" />
                                  Já Cadastrado no Sistema ({comp.existingClientName || 'Cliente'})
                                </span>
                              ) : comp?.isBatchDuplicate ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Duplicado no Lote Colado
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                  <UserPlus className="w-3 h-3 text-emerald-600" />
                                  Novo Cliente
                                </span>
                              )}
                            </div>

                            {/* Action Segmented Selector */}
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => handleSetItemAction(item.id, 'create')}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all ${
                                  isActionCreate && isSelected
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-emerald-700'
                                }`}
                              >
                                + Cadastrar Novo
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetItemAction(item.id, 'update')}
                                disabled={!comp?.isExisting}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all ${
                                  isActionUpdate && isSelected
                                    ? 'bg-sky-600 text-white shadow-xs'
                                    : comp?.isExisting
                                    ? 'text-slate-600 hover:text-sky-700'
                                    : 'text-slate-300 cursor-not-allowed'
                                }`}
                                title={comp?.isExisting ? 'Atualizar cadastro existente' : 'Sem cliente correspondente no sistema'}
                              >
                                🔄 Atualizar Existente
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetItemAction(item.id, 'ignore')}
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all ${
                                  isActionIgnore
                                    ? 'bg-slate-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-rose-600'
                                }`}
                              >
                                🚫 Ignorar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveBulkItem(item.id)}
                                className="p-1 text-rose-500 hover:bg-rose-100 rounded-lg transition-colors ml-1"
                                title="Remover este item da lista"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Editable Fields: Nome, WhatsApp, Vencimento */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            {/* Nome */}
                            <div>
                              <label className="text-[10px] text-slate-400 font-mono block mb-0.5">Nome do Cliente:</label>
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateItemField(item.id, 'name', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            {/* WhatsApp */}
                            <div>
                              <label className="text-[10px] text-slate-400 font-mono block mb-0.5">WhatsApp:</label>
                              <input
                                type="text"
                                value={item.phone}
                                onChange={(e) => handleUpdateItemField(item.id, 'phone', e.target.value)}
                                placeholder="DDD + Número"
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            {/* Vencimento */}
                            <div>
                              <label className="text-[10px] text-slate-400 font-mono block mb-0.5">Vencimento:</label>
                              <input
                                type="datetime-local"
                                value={formatForDateTimeInput(item.dueDate)}
                                onChange={(e) => handleUpdateItemField(item.id, 'dueDate', e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          {/* Diff changes if updating existing client */}
                          {isActionUpdate && comp?.isExisting && (comp.phoneChanged || comp.dueDateChanged) && (
                            <div className="p-2 bg-sky-50 rounded-lg border border-sky-200 text-[11px] text-sky-900 flex items-center flex-wrap gap-3">
                              {comp.phoneChanged && (
                                <div className="flex items-center gap-1 font-mono">
                                  <span className="text-slate-500">Telefone:</span>
                                  <span className="line-through text-slate-400">{comp.oldPhone || 'Vazio'}</span>
                                  <ArrowRight className="w-3 h-3 text-sky-600 inline" />
                                  <span className="font-bold text-emerald-700">{item.phone}</span>
                                </div>
                              )}
                              {comp.dueDateChanged && (
                                <div className="flex items-center gap-1 font-mono">
                                  <span className="text-slate-500">Vencimento:</span>
                                  <span className="line-through text-slate-400">
                                    {comp.oldDueDate ? formatDateTimeBR(comp.oldDueDate) : 'Vazio'}
                                  </span>
                                  <ArrowRight className="w-3 h-3 text-sky-600 inline" />
                                  <span className="font-bold text-emerald-700">
                                    {item.dueDate ? formatDateTimeBR(item.dueDate) : 'Sem data'}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-600">
                    Total selecionado: <strong>{bulkStats.selectedCount}</strong> de <strong>{bulkStats.total}</strong> ({bulkStats.toCreate} novos, {bulkStats.toUpdate} atualizações)
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitBulk}
                      disabled={bulkStats.selectedCount === 0}
                      className={`px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 ${
                        bulkStats.selectedCount > 0
                          ? 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'
                          : 'bg-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar e Salvar {bulkStats.selectedCount} Clientes
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* SINGLE CLIENT MODE */
          <form onSubmit={handleSubmitSingle} className="p-6 space-y-4 overflow-y-auto flex-1">
            {!clientToEdit && (
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 p-4 rounded-xl border-2 border-blue-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
                  <span>Preenchimento Inteligente (Cole aqui):</span>
                </div>

                <textarea
                  rows={3}
                  value={pasteInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPasteInput(val);
                    if (val.trim()) {
                      const parsed = parseClientText(val);
                      if (parsed.name) setName(parsed.name);
                      if (parsed.phone) setPhone(parsed.phone);
                      if (parsed.dueDate) setDueDate(parsed.dueDate);
                      if (parsed.notes) setNotes(parsed.notes);
                    }
                  }}
                  placeholder={`Cole aqui: Nome, WhatsApp e Vencimento.\nExemplo:\nJoão Carlos\n(48) 99888-7766\n25/08/2026 14:30`}
                  className="w-full p-3 bg-white border border-blue-300 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 shadow-inner"
                />

                <button
                  type="button"
                  onClick={handleAutoOrganize}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-md transition-all active:scale-[0.98]"
                >
                  <Wand2 className="w-4 h-4" />
                  Organizar nos Campos Automaticamente
                </button>

                {autoOrganizedAlert && (
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 text-xs rounded-lg font-bold flex items-center gap-2 border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{autoOrganizedAlert}</span>
                  </div>
                )}
              </div>
            )}

            {duplicateFound && !clientToEdit && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Já existe um cliente cadastrado com o nome <strong>"{duplicateFound.name}"</strong>. Ao salvar, os dados serão atualizados.
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                WhatsApp / Telefone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: (48) 99999-8888 ou 48999998888"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Data de Vencimento
                </span>
                {dueDate && (
                  <span className="text-[11px] text-indigo-600 font-mono font-semibold">
                    {formatDateTimeBR(dueDate)}
                  </span>
                )}
              </label>
              <input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-slate-500 font-mono">Atalhos rápidos:</span>
                <button
                  type="button"
                  onClick={() => setDueDate(addOffsetToCurrentDate(0, 0))}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono transition-colors"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(addOffsetToCurrentDate(0, 1))}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono transition-colors"
                >
                  Amanhã
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(addOffsetToCurrentDate(1, 0))}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono transition-colors"
                >
                  +1 Mês
                </button>
                <button
                  type="button"
                  onClick={() => setDueDate(addOffsetToCurrentDate(3, 0))}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-mono transition-colors"
                >
                  +3 Meses
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Observações
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Informações de login, plano contratado, servidor..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-xs"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              {clientToEdit && onDeleteClient ? (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteClient(clientToEdit.id);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Excluir este cliente permanentemente"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  Excluir Cliente
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {clientToEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

