import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  ExternalLink,
  Calendar,
  User,
  Clock,
  ChevronRight,
  FileText,
  Shield,
  History,
  AlertCircle,
  CheckCircle2,
  Archive,
  Eye,
  Edit2,
  X,
  HelpCircle,
} from 'lucide-react';
import { DisciplinaryProcedure, ProcedureDeadline, ProcedureTimelineItem } from '../types.ts';
import { formatDateBR } from '../lib/deadline-calculator.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface ProceduresViewProps {
  procedures: DisciplinaryProcedure[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenNewDeadline?: (procedureId: number) => void;
  selectedProcedureId?: number | null;
  onSelectProcedure?: (id: number | null) => void;
  globalSearch?: string;
}

const PHASES = [
  'Instauração',
  'Citação / Notificação Prévia',
  'Instrução Probatória',
  'Defesa Prévia / Alegações',
  'Relatório Conclusivo',
  'Homologação / Solução',
  'Concluído',
  'Arquivado',
];

export const ProceduresView: React.FC<ProceduresViewProps> = ({
  procedures,
  loading,
  onRefresh,
  selectedProcedureId,
  onSelectProcedure,
  globalSearch = '',
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  // Filtros locais
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterPhase, setFilterPhase] = useState<string>('todos');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProc, setEditingProc] = useState<DisciplinaryProcedure | null>(null);

  // Formulário
  const [formData, setFormData] = useState({
    code: '',
    type: 'PDS' as 'PDS' | 'SINDICANCIA',
    seiNumber: '',
    seiUrl: '',
    ordinanceNumber: '',
    subject: '',
    responsible: '',
    startDate: new Date().toISOString().split('T')[0],
    startEvent: 'Publicação da Portaria em Boletim Geral',
    phase: 'Instauração',
    notes: '',
    // Prazo inicial
    initialDaysCount: '30',
    initialDaysType: 'corridos' as 'corridos' | 'uteis',
    initialExcludeStartDay: true,
    confirmImmediately: false,
  });

  // Modal de Adicionar Andamento (Timeline)
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [timelineData, setTimelineData] = useState({
    actionDate: new Date().toISOString().split('T')[0],
    description: '',
    nextStep: '',
    seiDocumentRef: '',
  });

  // Procedimento atualmente em detalhamento no Drawer lateral
  const activeDetailProc = selectedProcedureId
    ? procedures.find((p) => p.id === selectedProcedureId) || null
    : null;

  const handleOpenCreate = () => {
    setEditingProc(null);
    setFormData({
      code: `PDS nº ${String(procedures.length + 1).padStart(3, '0')}/${new Date().getFullYear()}`,
      type: 'PDS',
      seiNumber: '',
      seiUrl: '',
      ordinanceNumber: '',
      subject: '',
      responsible: profile?.name || '',
      startDate: new Date().toISOString().split('T')[0],
      startEvent: 'Publicação da Portaria em Boletim Geral',
      phase: 'Instauração',
      notes: '',
      initialDaysCount: '30',
      initialDaysType: 'corridos',
      initialExcludeStartDay: true,
      confirmImmediately: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proc: DisciplinaryProcedure) => {
    setEditingProc(proc);
    setFormData({
      code: proc.code,
      type: proc.type,
      seiNumber: proc.seiNumber || '',
      seiUrl: proc.seiUrl || '',
      ordinanceNumber: proc.ordinanceNumber || '',
      subject: proc.subject,
      responsible: proc.responsible,
      startDate: proc.startDate,
      startEvent: proc.startEvent,
      phase: proc.phase,
      notes: proc.notes || '',
      initialDaysCount: '',
      initialDaysType: 'corridos',
      initialExcludeStartDay: true,
      confirmImmediately: false,
    });
    setIsModalOpen(true);
  };

  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProc) {
        // Atualizar
        await apiRequest(`/api/procedures/${editingProc.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            code: formData.code,
            type: formData.type,
            seiNumber: formData.seiNumber || null,
            seiUrl: formData.seiUrl || null,
            ordinanceNumber: formData.ordinanceNumber || null,
            subject: formData.subject,
            responsible: formData.responsible,
            phase: formData.phase,
            notes: formData.notes || null,
          }),
        });
      } else {
        // Criar
        await apiRequest('/api/procedures', token, {
          method: 'POST',
          body: JSON.stringify({
            code: formData.code,
            type: formData.type,
            seiNumber: formData.seiNumber || null,
            seiUrl: formData.seiUrl || null,
            ordinanceNumber: formData.ordinanceNumber || null,
            subject: formData.subject,
            responsible: formData.responsible,
            startDate: formData.startDate,
            startEvent: formData.startEvent,
            phase: formData.phase,
            notes: formData.notes || null,
            initialDeadline: formData.initialDaysCount
              ? {
                  title: 'Prazo Inicial de Conclusão dos Autos',
                  daysCount: formData.initialDaysCount,
                  daysType: formData.initialDaysType,
                  excludeStartDay: formData.initialExcludeStartDay,
                  confirmImmediately: formData.confirmImmediately,
                }
              : null,
          }),
        });
      }

      setIsModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao salvar procedimento: ${err.message}`);
    }
  };

  const handleToggleArchive = async (proc: DisciplinaryProcedure) => {
    const confirmMsg = proc.archived
      ? `Deseja desarquivar o procedimento ${proc.code}?`
      : `Deseja arquivar o procedimento ${proc.code}?`;
    if (!confirm(confirmMsg)) return;

    try {
      await apiRequest(`/api/procedures/${proc.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          ...proc,
          archived: !proc.archived,
        }),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleAddTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailProc) return;
    try {
      await apiRequest(`/api/procedures/${activeDetailProc.id}/timeline`, token, {
        method: 'POST',
        body: JSON.stringify(timelineData),
      });
      setIsTimelineModalOpen(false);
      setTimelineData({
        actionDate: new Date().toISOString().split('T')[0],
        description: '',
        nextStep: '',
        seiDocumentRef: '',
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao adicionar andamento: ${err.message}`);
    }
  };

  // Filtragem
  const filteredProcedures = procedures.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (filterType !== 'todos' && p.type !== filterType) return false;
    if (filterPhase !== 'todos' && p.phase !== filterPhase) return false;
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const match =
        p.code.toLowerCase().includes(term) ||
        (p.seiNumber && p.seiNumber.toLowerCase().includes(term)) ||
        p.subject.toLowerCase().includes(term) ||
        p.responsible.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Controles do Topo e Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filtro por Tipo */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Tipo:</span>
            <select
              id="filter-proc-type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="todos">Todos (PDS e Sindicância)</option>
              <option value="PDS">Procedimento Disciplinar Sumaríssimo (PDS)</option>
              <option value="SINDICANCIA">Sindicância</option>
            </select>
          </div>

          {/* Filtro por Fase */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Fase:</span>
            <select
              id="filter-proc-phase"
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
            >
              <option value="todos">Todas as Fases</option>
              {PHASES.map((ph) => (
                <option key={ph} value={ph}>
                  {ph}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Arquivados */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Exibir arquivados</span>
          </label>
        </div>

        {/* Botão Novo Procedimento */}
        {canEdit && (
          <button
            id="btn-new-procedure-main"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs shadow-blue-600/20 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Procedimento</span>
          </button>
        )}
      </div>

      {/* Lista / Tabela de Procedimentos */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Carregando procedimentos disciplinares...
          </div>
        ) : filteredProcedures.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">
              Nenhum procedimento encontrado
            </p>
            <p className="text-xs text-slate-400">
              Tente ajustar os filtros ou cadastre um novo PDS ou Sindicância.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredProcedures.map((proc) => {
              const activeDeadlines = proc.deadlines || [];
              const pendingDl = activeDeadlines.find((d) => !d.isConfirmed);
              const overdueDl = activeDeadlines.find(
                (d) =>
                  (d.confirmedEndDate || d.calculatedEndDate) <
                    new Date().toISOString().split('T')[0] && d.status !== 'concluido'
              );

              return (
                <div
                  key={proc.id}
                  id={`proc-row-${proc.id}`}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                          proc.type === 'PDS'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {proc.type === 'PDS' ? 'PDS' : 'Sindicância'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                        {proc.code}
                      </h4>
                      {proc.seiNumber && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-sm">
                          <span>SEI: {proc.seiNumber}</span>
                          {proc.seiUrl && (
                            <a
                              href={proc.seiUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir no SEI"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                        {proc.phase}
                      </span>
                      {proc.archived && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-600">
                          Arquivado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-700 font-medium line-clamp-2">
                      {proc.subject}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="text-slate-600">Encarregado:</strong> {proc.responsible}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="text-slate-600">Marco Inicial:</strong>{' '}
                        {formatDateBR(proc.startDate)} ({proc.startEvent})
                      </span>
                    </div>

                    {/* Alertas de prazos do procedimento */}
                    {(overdueDl || pendingDl) && (
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {overdueDl && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Prazo Vencido ({formatDateBR(overdueDl.confirmedEndDate || overdueDl.calculatedEndDate)})
                          </span>
                        )}
                        {pendingDl && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            <Clock className="w-3 h-3 text-blue-600" />
                            Prazo aguardando confirmação explícita
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ações do procedimento */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      id={`btn-detail-proc-${proc.id}`}
                      onClick={() => onSelectProcedure && onSelectProcedure(proc.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detalhar</span>
                    </button>

                    {canEdit && (
                      <>
                        <button
                          id={`btn-edit-proc-${proc.id}`}
                          onClick={() => handleOpenEdit(proc)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar dados cadastrais"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-archive-proc-${proc.id}`}
                          onClick={() => handleToggleArchive(proc)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title={proc.archived ? 'Desarquivar' : 'Arquivar'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawer Lateral de Detalhamento do Procedimento */}
      {activeDetailProc && (
        <div
          id="drawer-procedure-detail"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        >
          {/* Header do Drawer */}
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white">
                  {activeDetailProc.type}
                </span>
                <h3 className="text-base font-bold text-slate-900">{activeDetailProc.code}</h3>
              </div>
              <p className="text-xs text-slate-600 mt-1">{activeDetailProc.subject}</p>
            </div>
            <button
              onClick={() => onSelectProcedure && onSelectProcedure(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo do Drawer */}
          <div className="flex-1 p-5 overflow-y-auto space-y-6">
            {/* Metadados */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">Encarregado:</span>
                <span className="font-semibold text-slate-800">{activeDetailProc.responsible}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fase Atual:</span>
                <span className="font-semibold text-slate-800">{activeDetailProc.phase}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Marco Inicial:</span>
                <span className="font-semibold text-slate-800">
                  {formatDateBR(activeDetailProc.startDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Evento do Marco:</span>
                <span className="font-semibold text-slate-800">{activeDetailProc.startEvent}</span>
              </div>
              {activeDetailProc.seiNumber && (
                <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-slate-500">Nº SEI Oficial:</span>
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-blue-700">
                    <span>{activeDetailProc.seiNumber}</span>
                    {activeDetailProc.seiUrl && (
                      <a
                        href={activeDetailProc.seiUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Seção de Prazos do Procedimento */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Prazos Registrados</span>
                </h4>
              </div>

              <div className="space-y-2">
                {(activeDetailProc.deadlines || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                    Nenhum prazo cadastrado para este procedimento.
                  </p>
                ) : (
                  (activeDetailProc.deadlines || []).map((dl) => (
                    <div
                      key={dl.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white text-xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-800">{dl.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            dl.isConfirmed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {dl.isConfirmed ? 'Confirmado' : 'A confirmar'}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-md font-mono whitespace-pre-line border border-slate-200/60">
                        {dl.ruleDescription}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span className="text-slate-500">
                          Vencimento:{' '}
                          <strong className="text-slate-900">
                            {formatDateBR(dl.confirmedEndDate || dl.calculatedEndDate)}
                          </strong>
                        </span>
                        {dl.confirmedBy && (
                          <span className="text-slate-400 text-[10px]">
                            Confirmado por: {dl.confirmedBy}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Linha do Tempo / Andamentos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Andamentos & Linha do Tempo</span>
                </h4>
                {canEdit && (
                  <button
                    onClick={() => setIsTimelineModalOpen(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    + Novo Andamento
                  </button>
                )}
              </div>

              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {(activeDetailProc.timeline || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                    Nenhum andamento lançado.
                  </p>
                ) : (
                  (activeDetailProc.timeline || []).map((tl) => (
                    <div key={tl.id} className="relative flex items-start gap-3 pl-1 text-xs">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold z-10 shrink-0">
                        •
                      </div>
                      <div className="flex-1 p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span className="font-semibold text-slate-700">
                            {formatDateBR(tl.actionDate)}
                          </span>
                          <span>{tl.author}</span>
                        </div>
                        <p className="text-slate-800 text-xs font-medium">{tl.description}</p>
                        {tl.nextStep && (
                          <p className="text-[11px] text-blue-700 font-semibold mt-1">
                            Próximo passo: {tl.nextStep}
                          </p>
                        )}
                        {tl.seiDocumentRef && (
                          <p className="text-[10px] text-slate-500 font-mono">
                            Ref. Documento SEI: {tl.seiDocumentRef}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição de Procedimento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingProc ? 'Editar Procedimento' : 'Novo Procedimento Disciplinar'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProcedure} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Código */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Identificador / Título *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex.: PDS nº 012/2026 - 1º BPM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Tipo */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Procedimento *</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as 'PDS' | 'SINDICANCIA' })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PDS">Procedimento Disciplinar Sumaríssimo (PDS)</option>
                    <option value="SINDICANCIA">Sindicância</option>
                  </select>
                </div>

                {/* SEI Número */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Número SEI Oficial</label>
                  <input
                    type="text"
                    value={formData.seiNumber}
                    onChange={(e) => setFormData({ ...formData, seiNumber: e.target.value })}
                    placeholder="Ex.: 0012345-67.2026.8.17.0001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Link SEI */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Link do Processo no SEI</label>
                  <input
                    type="url"
                    value={formData.seiUrl}
                    onChange={(e) => setFormData({ ...formData, seiUrl: e.target.value })}
                    placeholder="https://sei.pe.gov.br/sei/..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Encarregado */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Encarregado / Responsável *</label>
                  <input
                    type="text"
                    required
                    value={formData.responsible}
                    onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                    placeholder="Ex.: Cap PM Oliveira"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Fase */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Fase Inicial *</label>
                  <select
                    value={formData.phase}
                    onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  >
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data do Marco Inicial */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data do Marco Inicial *</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Qual evento foi o marco */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Qual evento foi o marco? *</label>
                  <input
                    type="text"
                    required
                    value={formData.startEvent}
                    onChange={(e) => setFormData({ ...formData, startEvent: e.target.value })}
                    placeholder="Ex.: Publicação em Boletim Geral / Notificação"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Assunto Resumido */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assunto Resumido dos Autos *</label>
                <textarea
                  required
                  rows={2}
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Descreva suscintamente o objeto da apuração disciplinar..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Bloco de Prazo Inicial (Apenas na Criação) */}
              {!editingProc && (
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Parâmetros do Prazo Inicial
                    </span>
                    <span className="text-[11px] text-blue-700 font-medium">
                      Exigirá confirmação do editor
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Quantidade de Dias</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.initialDaysCount}
                        onChange={(e) => setFormData({ ...formData, initialDaysCount: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Contagem</label>
                      <select
                        value={formData.initialDaysType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            initialDaysType: e.target.value as 'corridos' | 'uteis',
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="corridos">Dias Corridos</option>
                        <option value="uteis">Dias Úteis</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">Dia do Marco</label>
                      <select
                        value={formData.initialExcludeStartDay ? 'exclui' : 'inclui'}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            initialExcludeStartDay: e.target.value === 'exclui',
                          })
                        }
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="exclui">Exclui dia do marco</option>
                        <option value="inclui">Inclui dia do marco</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.confirmImmediately}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmImmediately: e.target.checked })
                      }
                      className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-800 font-semibold">
                      Confirmar prazo imediatamente (tornar definitivo sem status 'a confirmar')
                    </span>
                  </label>
                </div>
              )}

              {/* Botões do Rodapé */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs shadow-blue-600/20 transition-colors"
                >
                  {editingProc ? 'Salvar Alterações' : 'Criar Procedimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Andamento (Timeline) */}
      {isTimelineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Novo Andamento dos Autos</h4>
              <button
                onClick={() => setIsTimelineModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddTimeline} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data do Ato *</label>
                <input
                  type="date"
                  required
                  value={timelineData.actionDate}
                  onChange={(e) => setTimelineData({ ...timelineData, actionDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Descrição da Movimentação *
                </label>
                <textarea
                  required
                  rows={3}
                  value={timelineData.description}
                  onChange={(e) =>
                    setTimelineData({ ...timelineData, description: e.target.value })
                  }
                  placeholder="Ex.: Realizada a oitiva da testemunha..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Próximo Passo Previsto</label>
                <input
                  type="text"
                  value={timelineData.nextStep}
                  onChange={(e) => setTimelineData({ ...timelineData, nextStep: e.target.value })}
                  placeholder="Ex.: Intimação da defesa técnica"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ref. Documento SEI</label>
                <input
                  type="text"
                  value={timelineData.seiDocumentRef}
                  onChange={(e) =>
                    setTimelineData({ ...timelineData, seiDocumentRef: e.target.value })
                  }
                  placeholder="Ex.: Termo de Depoimento nº 98765432"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTimelineModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Gravar Andamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
