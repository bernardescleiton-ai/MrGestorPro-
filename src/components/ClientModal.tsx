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
  clientToEdit?: Client | null;
  clients?: Client[];
}

export const ClientModal: React.FC<ClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveBatch,
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
  const [batchDuplicatesMerged, setBatchDuplicatesMerged] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const duplicateFound = useMemo(() => {
    return isDuplicateClientName(name, clients || [], clientToEdit?.id);
  }, [name, clients, clientToEdit]);

  const bulkCounts = useMemo(() => {
    let toCreate = 0;
    let toUpdate = 0;
    let withDueDateChange = 0;
    let withPhoneChange = 0;

    for (const item of parsedBulkList) {
      if (item.action === 'update') {
        toUpdate++;
        if (item.comparison?.dueDateChanged) withDueDateChange++;
        if (item.comparison?.phoneChanged) withPhoneChange++;
      } else {
        toCreate++;
      }
    }
    return { toCreate, toUpdate, withDueDateChange, withPhoneChange, total: parsedBulkList.length };
  }, [parsedBulkList]);

  useEffect(() => {
    if (clientToEdit) {
      setMode('single');
      setName(clientToEdit.name || '');
      setPhone(clientToEdit.phone || '');
      setDueDate(clientToEdit.dueDate || '');
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
    setBatchDuplicatesMerged(0);
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
    if (parsed.dueDate) setDueDate(parsed.dueDate);
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
    const uniqueList: ParsedBulkClient[] = [];
    const seenNamesInBatch = new Map<string, number>();
    let mergedCount = 0;

    for (const item of results) {
      const normName = normalizeNameForComparison(item.name);
      if (!normName) continue;

      // Duplicate within the pasted batch: merge into a single item
      if (seenNamesInBatch.has(normName)) {
        mergedCount++;
        const existingIdx = seenNamesInBatch.get(normName)!;
        const prevItem = uniqueList[existingIdx];

        const mergedPhone = item.phone || prevItem.phone;
        const mergedDueDate = item.dueDate || prevItem.dueDate;
        const mergedNotes = item.notes || prevItem.notes;

        const dup = isDuplicateClientName(prevItem.name, safeClients);
        const isExisting = Boolean(dup);
        const phoneChanged = Boolean(isExisting && dup && mergedPhone && mergedPhone.trim() !== (dup.phone || '').trim());
        const dueDateChanged = Boolean(isExisting && dup && mergedDueDate && mergedDueDate.trim() !== (dup.dueDate || '').trim());
        const notesChanged = Boolean(isExisting && dup && mergedNotes && mergedNotes.trim() !== (dup.notes || '').trim());

        uniqueList[existingIdx] = {
          name: dup ? dup.name : prevItem.name,
          phone: mergedPhone,
          dueDate: mergedDueDate,
          notes: mergedNotes,
          action: isExisting ? 'update' : 'create',
          comparison: {
            isExisting,
            existingClientId: dup?.id,
            existingClientName: dup?.name,
            phoneChanged,
            oldPhone: dup?.phone || '',
            newPhone: mergedPhone,
            dueDateChanged,
            oldDueDate: dup?.dueDate || '',
            newDueDate: mergedDueDate,
            notesChanged,
          },
        };
        continue;
      }

      // Check against existing clients in the system
      const dup = isDuplicateClientName(item.name, safeClients);
      const isExisting = Boolean(dup);
      const phoneChanged = Boolean(isExisting && dup && item.phone && item.phone.trim() !== (dup.phone || '').trim());
      const dueDateChanged = Boolean(isExisting && dup && item.dueDate && item.dueDate.trim() !== (dup.dueDate || '').trim());
      const notesChanged = Boolean(isExisting && dup && item.notes && item.notes.trim() !== (dup.notes || '').trim());

      const analyzedItem: ParsedBulkClient = {
        name: dup ? dup.name : item.name,
        phone: item.phone,
        dueDate: item.dueDate,
        notes: item.notes,
        action: isExisting ? 'update' : 'create',
        comparison: {
          isExisting,
          existingClientId: dup?.id,
          existingClientName: dup?.name,
          phoneChanged,
          oldPhone: dup?.phone || '',
          newPhone: item.phone,
          dueDateChanged,
          oldDueDate: dup?.dueDate || '',
          newDueDate: item.dueDate,
          notesChanged,
        },
      };

      seenNamesInBatch.set(normName, uniqueList.length);
      uniqueList.push(analyzedItem);
    }

    setParsedBulkList(uniqueList);
    setBatchDuplicatesMerged(mergedCount);

    if (uniqueList.length === 0) {
      setErrorMsg('Não foi possível identificar dados válidos na lista colada.');
    }
  };

  const handleRemoveBulkItem = (index: number) => {
    setParsedBulkList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmitBulk = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedBulkList.length === 0) {
      alert('Analise e organize a lista de clientes antes de salvar.');
      return;
    }

    const safeClients = clients || [];
    const toCreate: Omit<Client, 'id' | 'createdAt'>[] = [];
    const toUpdate: { id: string; data: Partial<Client> }[] = [];

    for (const item of parsedBulkList) {
      if (item.action === 'update' && item.comparison?.existingClientId) {
        const updateData: Partial<Client> = {};
        if (item.phone && item.phone.trim()) updateData.phone = item.phone.trim();
        if (item.dueDate && item.dueDate.trim()) updateData.dueDate = item.dueDate.trim();
        if (item.notes && item.notes.trim()) updateData.notes = item.notes.trim();
        toUpdate.push({
          id: item.comparison.existingClientId,
          data: updateData,
        });
      } else {
        const existing = isDuplicateClientName(item.name, safeClients);
        if (existing) {
          const updateData: Partial<Client> = {};
          if (item.phone && item.phone.trim()) updateData.phone = item.phone.trim();
          if (item.dueDate && item.dueDate.trim()) updateData.dueDate = item.dueDate.trim();
          if (item.notes && item.notes.trim()) updateData.notes = item.notes.trim();
          toUpdate.push({
            id: existing.id,
            data: updateData,
          });
        } else {
          toCreate.push({
            name: item.name.trim(),
            phone: item.phone.trim(),
            dueDate: item.dueDate.trim(),
            notes: item.notes.trim(),
          });
        }
      }
    }

    if (toCreate.length === 0 && toUpdate.length === 0) {
      setErrorMsg('Nenhuma alteração para salvar.');
      return;
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
    const duplicate = isDuplicateClientName(trimmedName, safeClients, clientToEdit?.id);

    if (duplicate) {
      const msg = `⚠️ O cliente "${trimmedName}" não pode ser salvo porque já existe outro cliente cadastrado com este mesmo nome ("${duplicate.name}")!`;
      setErrorMsg(msg);
      alert(msg);
      return;
    }

    onSave(
      {
        name: trimmedName,
        phone: phone.trim(),
        dueDate: dueDate ? dueDate : undefined,
        notes: notes.trim(),
      },
      clientToEdit ? clientToEdit.id : undefined
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
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
                {clientToEdit ? 'Atualize os dados do cliente' : 'Adicione um ou vários clientes de uma só vez'}
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
              <Upload className="w-4 h-4" /> Importar e Atualizar em Massa
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
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-200 text-indigo-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Cadastrar Novos e Atualizar Existentes em Massa:</span>
              </div>
              <p className="text-xs text-slate-600 font-sans leading-relaxed">
                Cole abaixo sua lista copiada do Excel, WhatsApp ou Bloco de Notas. O sistema identifica e organiza o <strong>Nome</strong>, o <strong>WhatsApp</strong> e a <strong>Data de Vencimento</strong>: clientes novos serão cadastrados e <strong>clientes já existentes terão seu telefone e data de vencimento atualizados</strong>, com garantia de <strong>zero duplicidades</strong>.
              </p>
              <textarea
                rows={6}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                placeholder={`Exemplo de formato aceito:\nJoão Silva, (48) 99999-1111, 25/08/2026\nMaria Santos - 48988882222 - 30/08/2026 (se já cadastrada, atualiza seu vencimento e telefone)\nCarlos Souza    (11) 97777-3333    10/09/2026`}
                className="w-full p-3 bg-white border border-indigo-300 rounded-xl text-xs font-mono text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              />
              <button
                type="button"
                onClick={handleAnalyzeBulk}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" /> Analisar, Filtrar e Comparar Dados da Lista
              </button>
            </div>

            {parsedBulkList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Lista Processada ({parsedBulkList.length} clientes):</span>
                  </h3>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {bulkCounts.toCreate > 0 && (
                      <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <UserPlus className="w-3 h-3 text-emerald-600" />
                        {bulkCounts.toCreate} novos
                      </span>
                    )}
                    {bulkCounts.toUpdate > 0 && (
                      <span className="text-[10px] text-sky-800 bg-sky-100 border border-sky-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 text-sky-600" />
                        {bulkCounts.toUpdate} a atualizar
                      </span>
                    )}
                    {batchDuplicatesMerged > 0 && (
                      <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                        ⚡ {batchDuplicatesMerged} repetições unificadas
                      </span>
                    )}
                    <span className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-indigo-600" />
                      Zero Duplicidades
                    </span>
                  </div>
                </div>

                {bulkCounts.toUpdate > 0 && (
                  <div className="p-3 bg-sky-50/90 border border-sky-200 text-sky-900 rounded-xl text-xs flex items-start gap-2.5">
                    <RefreshCw className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>Mecanismo de Atualização Ativo:</strong> Identificamos {bulkCounts.toUpdate} cliente(s) que já possuem cadastro no sistema. Ao salvar, os dados novos de telefone e vencimento serão aplicados aos cadastros existentes sem criar nenhum cliente duplicado.
                    </div>
                  </div>
                )}

                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/50">
                  {parsedBulkList.map((item, idx) => {
                    const isUpdate = item.action === 'update';
                    const comp = item.comparison;
                    return (
                      <div
                        key={idx}
                        className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                          isUpdate
                            ? 'bg-sky-50/50 border-l-4 border-l-sky-500 hover:bg-sky-50/80'
                            : 'bg-white border-l-4 border-l-emerald-500 hover:bg-emerald-50/30'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                          {/* Nome */}
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] text-slate-400 font-mono">Nome:</span>
                              {isUpdate ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 border border-sky-200">
                                  Existente (Atualizar)
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Novo Cadastro
                                </span>
                              )}
                            </div>
                            <span className={`font-bold text-sm block truncate ${isUpdate ? 'text-sky-950' : 'text-slate-800'}`}>
                              {item.name}
                            </span>
                          </div>

                          {/* WhatsApp */}
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono block">WhatsApp</span>
                            {isUpdate && comp?.phoneChanged ? (
                              <div className="flex items-center gap-1 font-mono text-xs flex-wrap">
                                <span className="line-through text-slate-400">{comp.oldPhone || 'Sem número'}</span>
                                <ArrowRight className="w-3 h-3 text-sky-600 inline shrink-0" />
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">{item.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono text-xs">
                                {item.phone || (isUpdate && comp?.oldPhone) || 'Sem telefone'}
                                {isUpdate && !comp?.phoneChanged && item.phone && (
                                  <span className="text-[10px] text-slate-400 ml-1">(mantido)</span>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Vencimento */}
                          <div>
                            <span className="text-[10px] text-slate-400 font-mono block">Vencimento</span>
                            {isUpdate && comp?.dueDateChanged ? (
                              <div className="flex items-center gap-1 font-mono text-xs flex-wrap">
                                <span className="line-through text-slate-400">
                                  {comp.oldDueDate ? formatDateTimeBR(comp.oldDueDate) : 'Sem venc.'}
                                </span>
                                <ArrowRight className="w-3 h-3 text-sky-600 inline shrink-0" />
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                                  {item.dueDate ? formatDateTimeBR(item.dueDate) : 'Sem venc.'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-indigo-600 font-mono font-semibold text-xs">
                                {item.dueDate ? formatDateTimeBR(item.dueDate) : (isUpdate && comp?.oldDueDate ? formatDateTimeBR(comp.oldDueDate) : 'Sem vencimento')}
                                {isUpdate && !comp?.dueDateChanged && item.dueDate && (
                                  <span className="text-[10px] text-slate-400 ml-1 font-normal">(mantido)</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveBulkItem(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                          title="Remover este item da lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitBulk}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {bulkCounts.toCreate > 0 && bulkCounts.toUpdate > 0
                      ? `Salvar: ${bulkCounts.toCreate} Novo(s) e Atualizar ${bulkCounts.toUpdate} Existente(s)`
                      : bulkCounts.toCreate > 0
                      ? `Cadastrar Todos os ${bulkCounts.toCreate} Novos Clientes`
                      : `Atualizar os ${bulkCounts.toUpdate} Clientes Existentes`}
                  </button>
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

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                <span>Nome / Empresa *</span>
                {duplicateFound && (
                  <span className="text-rose-600 font-bold text-[11px] flex items-center gap-1 animate-pulse">
                    <AlertTriangle className="w-3.5 h-3.5" /> Nome Duplicado!
                  </span>
                )}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Ex: Ana Silva ou Empresa Ltda"
                className={`w-full px-3.5 py-2.5 rounded-xl border outline-none text-sm text-slate-800 transition-all ${
                  duplicateFound
                    ? 'border-rose-500 bg-rose-50/40 text-rose-950 font-semibold focus:ring-2 focus:ring-rose-500'
                    : 'border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                }`}
              />
              {duplicateFound && (
                <div className="mt-2 p-3 bg-rose-100/80 border-2 border-rose-300 text-rose-950 text-xs rounded-xl font-bold flex items-center gap-2.5 shadow-sm animate-in fade-in">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <p className="font-extrabold text-rose-900">⚠️ Cliente Já Cadastrado!</p>
                    <p className="font-normal text-[11px] text-rose-800 mt-0.5">
                      Já existe um cliente cadastrado como <strong>"{duplicateFound.name}"</strong>. Altere o nome para poder salvar.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center justify-between">
                  <span>WhatsApp <span className="text-slate-400 font-normal font-sans">(Nacional ou Estrangeiro)</span></span>
                  <span className="text-[10px] text-blue-600 font-semibold lowercase">🇧🇷 +55 • 🇺🇸 +1 • 🇵🇹 +351</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: (48) 99999-9999, +1 (555) 123-4567, +351 912 345 678"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                  Data e Hora de Vencimento
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min="2020-01-01T00:00"
                  max="2036-12-31T23:59"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-800 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Observações
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas importantes sobre o cliente..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-slate-800 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-600/25 transition-colors"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
