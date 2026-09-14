import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Download,
  Plus,
  ArrowUpRight,
  HelpCircle,
  FileCheck,
  PauseCircle,
  RotateCcw,
  Check,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { DisciplinaryProcedure, ProcedureDeadline } from '../types.ts';
import { formatDateBR, calculateDeadline } from '../lib/deadline-calculator.ts';
import { exportDeadlinesToCSV } from '../lib/csv-export.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface DeadlinesViewProps {
  deadlines: ProcedureDeadline[];
  procedures: DisciplinaryProcedure[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
}

export const DeadlinesView: React.FC<DeadlinesViewProps> = ({
  deadlines,
  procedures,
  loading,
  onRefresh,
  globalSearch = '',
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<number | null>(null);

  // Modal de Prorrogação / Suspensão
  const [extendingDeadline, setExtendingDeadline] = useState<ProcedureDeadline | null>(null);
  const [extensionForm, setExtensionForm] = useState({
    type: 'prorrogacao' as 'prorrogacao' | 'suspensao' | 'reabertura',
    newDate: '',
    legalBasis: '',
    reason: '',
  });

  // Modal de Novo Prazo
  const [isNewDeadlineModalOpen, setIsNewDeadlineModalOpen] = useState(false);
  const [newDeadlineForm, setNewDeadlineForm] = useState({
    procedureId: procedures[0]?.id || 0,
    title: 'Prazo Suplementar de Diligências',
    startDate: new Date().toISOString().split('T')[0],
    daysCount: '15',
    daysType: 'corridos' as 'corridos' | 'uteis',
    excludeStartDay: true,
    manualEndDate: '',
    manualJustification: '',
    responsible: '',
    confirmImmediately: false,
  });
  const [calculatedPreview, setCalculatedPreview] = useState<string>('');

  const today = new Date().toISOString().split('T')[0];

  // Cálculo prévio no formulário
  const handleRecalculatePreview = () => {
    if (!newDeadlineForm.startDate || !newDeadlineForm.daysCount) return;
    const res = calculateDeadline(
      newDeadlineForm.startDate,
      Number(newDeadlineForm.daysCount),
      newDeadlineForm.daysType,
      newDeadlineForm.excludeStartDay
    );
    setCalculatedPreview(res.breakdown);
  };

  const handleConfirmDeadline = async (dl: ProcedureDeadline) => {
    if (!confirm(`Deseja confirmar explicitamente o prazo "${dl.title}" com vencimento em ${formatDateBR(dl.calculatedEndDate)}?`)) {
      return;
    }

    try {
      await apiRequest(`/api/deadlines/${dl.id}/confirm`, token, { method: 'POST' });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao confirmar prazo: ${err.message}`);
    }
  };

  const handleCompleteDeadline = async (dl: ProcedureDeadline) => {
    if (!confirm(`Deseja marcar o prazo "${dl.title}" como concluído?`)) return;
    try {
      await apiRequest(`/api/deadlines/${dl.id}/complete`, token, { method: 'POST' });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleSaveExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingDeadline) return;

    try {
      await apiRequest(`/api/deadlines/${extendingDeadline.id}/extend`, token, {
        method: 'POST',
        body: JSON.stringify(extensionForm),
      });
      setExtendingDeadline(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao registrar prorrogação: ${err.message}`);
    }
  };

  const handleCreateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/procedures/${newDeadlineForm.procedureId}/deadlines`, token, {
        method: 'POST',
        body: JSON.stringify(newDeadlineForm),
      });
      setIsNewDeadlineModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao cadastrar prazo: ${err.message}`);
    }
  };

  // Filtragem
  const filteredDeadlines = deadlines.filter((dl) => {
    if (statusFilter === 'vencido' && dl.effectiveStatus !== 'vencido') return false;
    if (statusFilter === 'proximo' && dl.effectiveStatus !== 'proximo') return false;
    if (statusFilter === 'a_confirmar' && dl.effectiveStatus !== 'a_confirmar') return false;
    if (statusFilter === 'concluido' && dl.status !== 'concluido') return false;
    if (statusFilter === 'suspenso' && dl.status !== 'suspenso') return false;

    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const code = (dl.procedureCode || '').toLowerCase();
      const title = (dl.title || '').toLowerCase();
      const resp = (dl.responsible || '').toLowerCase();
      if (!code.includes(term) && !title.includes(term) && !resp.includes(term)) {
        return false;
      }
    }
    return true;
  });

  const countVencidos = deadlines.filter((d) => d.effectiveStatus === 'vencido').length;
  const countAConfirmar = deadlines.filter((d) => d.effectiveStatus === 'a_confirmar').length;
  const countProximos = deadlines.filter((d) => d.effectiveStatus === 'proximo').length;

  return (
    <div className="space-y-6">
      {/* Controles do Topo e Filtros Rápidos */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filtros de Status */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setStatusFilter('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'todos'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({deadlines.length})
          </button>

          <button
            onClick={() => setStatusFilter('vencido')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'vencido'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>Vencidos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-200/80 text-rose-950">
              {countVencidos}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('proximo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'proximo'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span>Próximos</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-950">
              {countProximos}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('a_confirmar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              statusFilter === 'a_confirmar'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
            }`}
          >
            <span>A Confirmar</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-200/80 text-blue-950">
              {countAConfirmar}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('suspenso')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'suspenso'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Suspensos
          </button>

          <button
            onClick={() => setStatusFilter('concluido')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'concluido'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Concluídos
          </button>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2">
          <button
            id="btn-export-deadlines-csv"
            onClick={() => exportDeadlinesToCSV(filteredDeadlines)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {canEdit && procedures.length > 0 && (
            <button
              id="btn-add-deadline-main"
              onClick={() => {
                setNewDeadlineForm({
                  procedureId: procedures[0].id,
                  title: 'Prazo de Diligências Complementares',
                  startDate: new Date().toISOString().split('T')[0],
                  daysCount: '15',
                  daysType: 'corridos',
                  excludeStartDay: true,
                  manualEndDate: '',
                  manualJustification: '',
                  responsible: '',
                  confirmImmediately: false,
                });
                handleRecalculatePreview();
                setIsNewDeadlineModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs shadow-blue-600/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Prazo</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela / Lista de Prazos com Discriminação Transparente */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando prazos...</div>
        ) : filteredDeadlines.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-1">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">Nenhum prazo encontrado</p>
            <p className="text-xs text-slate-400">
              Não há prazos registrados para o filtro selecionado.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDeadlines.map((dl) => {
              const isOverdue = dl.effectiveStatus === 'vencido';
              const isPendingConfirm = dl.effectiveStatus === 'a_confirmar';
              const isExpanded = expandedBreakdownId === dl.id;
              const targetDate = dl.confirmedEndDate || dl.calculatedEndDate;

              return (
                <div
                  key={dl.id}
                  id={`deadline-item-${dl.id}`}
                  className={`p-4 sm:p-5 transition-colors ${
                    isOverdue ? 'bg-rose-50/30' : isPendingConfirm ? 'bg-blue-50/20' : 'bg-white'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Informações Principais */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            isOverdue
                              ? 'bg-rose-600 text-white'
                              : isPendingConfirm
                              ? 'bg-blue-600 text-white'
                              : dl.status === 'concluido'
                              ? 'bg-emerald-600 text-white'
                              : dl.status === 'suspenso'
                              ? 'bg-slate-600 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }`}
                        >
                          {isOverdue
                            ? 'Vencido'
                            : isPendingConfirm
                            ? 'A Confirmar'
                            : dl.status === 'concluido'
                            ? 'Concluído'
                            : dl.status === 'suspenso'
                            ? 'Suspenso'
                            : 'Próximo'}
                        </span>

                        <span className="text-xs font-bold text-slate-900 font-mono">
                          {dl.procedureCode}
                        </span>

                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {dl.procedureType}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{dl.title}</h4>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>
                          <strong className="text-slate-700">Marco Inicial:</strong>{' '}
                          {formatDateBR(dl.startDate)}
                        </span>
                        <span>
                          <strong className="text-slate-700">Vencimento:</strong>{' '}
                          <span
                            className={`font-bold ${
                              isOverdue ? 'text-rose-700 font-bold' : 'text-slate-900'
                            }`}
                          >
                            {formatDateBR(targetDate)}
                          </span>
                        </span>
                        {dl.responsible && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            {dl.responsible}
                          </span>
                        )}
                      </div>

                      {/* Botão para ver discriminação do cálculo */}
                      <div className="pt-1">
                        <button
                          onClick={() =>
                            setExpandedBreakdownId(isExpanded ? null : dl.id)
                          }
                          className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                        >
                          <span>Discriminação do cálculo do prazo</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Bloco expandido com discriminação transparente */}
                      {isExpanded && (
                        <div className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono whitespace-pre-line text-slate-700 space-y-1">
                          <p className="font-bold text-slate-900 font-sans text-xs">
                            Memória de Cálculo:
                          </p>
                          {dl.ruleDescription || dl.manualJustification || 'Sem detalhes disponíveis.'}
                          {dl.confirmedBy && (
                            <p className="text-[11px] text-slate-500 font-sans pt-1 border-t border-slate-200">
                              Confirmado por: {dl.confirmedBy} em{' '}
                              {dl.confirmedAt
                                ? new Date(dl.confirmedAt).toLocaleDateString('pt-BR')
                                : ''}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ações Explícitas */}
                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end md:self-start pt-1">
                        {isPendingConfirm && (
                          <button
                            id={`btn-confirm-dl-${dl.id}`}
                            onClick={() => handleConfirmDeadline(dl)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
                            title="Confirmar prazo explicitamente"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Confirmar Prazo</span>
                          </button>
                        )}

                        <button
                          id={`btn-extend-dl-${dl.id}`}
                          onClick={() => {
                            setExtendingDeadline(dl);
                            setExtensionForm({
                              type: 'prorrogacao',
                              newDate: targetDate,
                              legalBasis: '',
                              reason: '',
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Prorrogar, suspender ou reabrir"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Prorrogar / Suspender</span>
                        </button>

                        {dl.status !== 'concluido' && (
                          <button
                            id={`btn-complete-dl-${dl.id}`}
                            onClick={() => handleCompleteDeadline(dl)}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Concluir prazo"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Prorrogação / Suspensão Explícita Auditável */}
      {extendingDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Alteração Formal de Prazo
                </h4>
                <p className="text-xs text-slate-500">{extendingDeadline.title}</p>
              </div>
              <button
                onClick={() => setExtendingDeadline(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExtension} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
                A data original não será sobrescrita. Esta alteração será gravada
                permanentemente na trilha de auditoria com sua identificação e fundamento.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Ação *</label>
                <select
                  value={extensionForm.type}
                  onChange={(e) =>
                    setExtensionForm({
                      ...extensionForm,
                      type: e.target.value as 'prorrogacao' | 'suspensao' | 'reabertura',
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-xs"
                >
                  <option value="prorrogacao">Prorrogação de Prazo</option>
                  <option value="suspensao">Suspensão de Prazo</option>
                  <option value="reabertura">Reabertura de Prazo</option>
                </select>
              </div>

              {extensionForm.type !== 'suspensao' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nova Data Final Proposta *
                  </label>
                  <input
                    type="date"
                    required
                    value={extensionForm.newDate}
                    onChange={(e) =>
                      setExtensionForm({ ...extensionForm, newDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Fundamento Legal / Portaria / Despacho *
                </label>
                <input
                  type="text"
                  required
                  value={extensionForm.legalBasis}
                  onChange={(e) =>
                    setExtensionForm({ ...extensionForm, legalBasis: e.target.value })
                  }
                  placeholder="Ex.: Art. X da Portaria do Comando Geral nº..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo Justificado *
                </label>
                <textarea
                  required
                  rows={3}
                  value={extensionForm.reason}
                  onChange={(e) =>
                    setExtensionForm({ ...extensionForm, reason: e.target.value })
                  }
                  placeholder="Justifique a necessidade de dilação ou suspensão..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendingDeadline(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                >
                  Confirmar Alteração
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Novo Prazo */}
      {isNewDeadlineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Adicionar Prazo a Procedimento</h4>
              <button
                onClick={() => setIsNewDeadlineModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDeadline} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Procedimento *</label>
                <select
                  value={newDeadlineForm.procedureId}
                  onChange={(e) =>
                    setNewDeadlineForm({
                      ...newDeadlineForm,
                      procedureId: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
                >
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} - {p.subject.slice(0, 40)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título do Prazo *</label>
                <input
                  type="text"
                  required
                  value={newDeadlineForm.title}
                  onChange={(e) =>
                    setNewDeadlineForm({ ...newDeadlineForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data do Marco *</label>
                  <input
                    type="date"
                    required
                    value={newDeadlineForm.startDate}
                    onChange={(e) => {
                      setNewDeadlineForm({ ...newDeadlineForm, startDate: e.target.value });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Qtd. Dias</label>
                  <input
                    type="number"
                    min="1"
                    value={newDeadlineForm.daysCount}
                    onChange={(e) =>
                      setNewDeadlineForm({ ...newDeadlineForm, daysCount: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contagem</label>
                  <select
                    value={newDeadlineForm.daysType}
                    onChange={(e) =>
                      setNewDeadlineForm({
                        ...newDeadlineForm,
                        daysType: e.target.value as 'corridos' | 'uteis',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="corridos">Dias Corridos</option>
                    <option value="uteis">Dias Úteis</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dia do Marco</label>
                  <select
                    value={newDeadlineForm.excludeStartDay ? 'exclui' : 'inclui'}
                    onChange={(e) =>
                      setNewDeadlineForm({
                        ...newDeadlineForm,
                        excludeStartDay: e.target.value === 'exclui',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="exclui">Exclui dia do marco</option>
                    <option value="inclui">Inclui dia do marco</option>
                  </select>
                </div>
              </div>

              {/* Botão para atualizar preview de cálculo */}
              <button
                type="button"
                onClick={handleRecalculatePreview}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Atualizar Memória de Cálculo
              </button>

              {calculatedPreview && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono whitespace-pre-line text-slate-700">
                  {calculatedPreview}
                </div>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newDeadlineForm.confirmImmediately}
                  onChange={(e) =>
                    setNewDeadlineForm({
                      ...newDeadlineForm,
                      confirmImmediately: e.target.checked,
                    })
                  }
                  className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-800 font-semibold">
                  Confirmar prazo imediatamente sem passar por status 'a confirmar'
                </span>
              </label>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewDeadlineModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                >
                  Gravar Prazo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
