import React, { useState } from 'react';
import {
  Gavel,
  Calendar as CalendarIcon,
  List,
  Plus,
  Search,
  Download,
  Shield,
  Clock,
  MapPin,
  Video,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CheckCircle2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquareShare,
  Trash2,
  Send,
} from 'lucide-react';
import { JudicialHearing, PoliceOfficer } from '../types.ts';
import { formatDateBR } from '../lib/deadline-calculator.ts';
import { exportHearingsToCSV } from '../lib/csv-export.ts';
import { buildHearingWhatsAppMessage, openWhatsAppChat } from '../lib/whatsapp-messages.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface HearingsViewProps {
  hearings: JudicialHearing[];
  officers: PoliceOfficer[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
  onOpenOfficialNoticeImport?: () => void;
  onOpenBatchImport?: () => void;
}

export const HearingsView: React.FC<HearingsViewProps> = ({
  hearings,
  officers,
  loading,
  onRefresh,
  globalSearch = '',
  onOpenOfficialNoticeImport,
  onOpenBatchImport,
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  // Visão: Tabela vs Calendário
  const [viewMode, setViewMode] = useState<'tabela' | 'calendario'>('tabela');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [officerFilter, setOfficerFilter] = useState<string>('todos');

  // Modal Nova Audiência
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    noticeNumber: '',
    seiNumber: '',
    hearingDate: new Date().toISOString().split('T')[0],
    hearingTime: '09:00',
    court: 'Vara da Justiça Militar Estadual',
    modality: 'presencial' as 'presencial' | 'remota',
    location: 'Fórum Rodolfo Aureliano - Ilha de Joana Bezerra, Recife',
    notes: '',
    selectedOfficerIds: [] as number[],
  });

  // Modal Remarcação
  const [reschedulingHearing, setReschedulingHearing] = useState<JudicialHearing | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    newDate: '',
    newTime: '09:00',
    reason: '',
  });

  // Modal "Não Ocorreu"
  const [didNotOccurHearing, setDidNotOccurHearing] = useState<JudicialHearing | null>(null);
  const [didNotOccurReason, setDidNotOccurReason] = useState('');

  // Modal "Marcar Realizada sem Termo de Comparecimento"
  const [completeWithoutTermHearing, setCompleteWithoutTermHearing] = useState<JudicialHearing | null>(null);
  const [completeWithoutTermNote, setCompleteWithoutTermNote] = useState('');
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  // Modal Confirmação de Exclusão de Audiência
  const [deletingHearing, setDeletingHearing] = useState<JudicialHearing | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal Gestão de Ofícios da Audiência
  const [managingOfficersHearing, setManagingOfficersHearing] = useState<JudicialHearing | null>(null);

  const handleCreateHearing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/hearings', token, {
        method: 'POST',
        body: JSON.stringify({
          noticeNumber: createForm.noticeNumber,
          seiNumber: createForm.seiNumber || null,
          hearingDate: createForm.hearingDate,
          hearingTime: createForm.hearingTime,
          court: createForm.court,
          modality: createForm.modality,
          location: createForm.location || null,
          notes: createForm.notes || null,
          officers: createForm.selectedOfficerIds.map((id) => ({
            officerId: id,
            officialNoticeNumber: createForm.noticeNumber,
            noticeStatus: 'pendente',
          })),
        }),
      });

      setIsCreateModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao agendar audiência: ${err.message}`);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingHearing) return;
    try {
      await apiRequest(`/api/hearings/${reschedulingHearing.id}/reschedule`, token, {
        method: 'POST',
        body: JSON.stringify(rescheduleForm),
      });
      setReschedulingHearing(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao remarcar audiência: ${err.message}`);
    }
  };

  const handleSaveDidNotOccur = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!didNotOccurHearing) return;
    try {
      await apiRequest(`/api/hearings/${didNotOccurHearing.id}/did-not-occur`, token, {
        method: 'POST',
        body: JSON.stringify({ reason: didNotOccurReason }),
      });
      setDidNotOccurHearing(null);
      setDidNotOccurReason('');
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao registrar ocorrência: ${err.message}`);
    }
  };

  const handleSaveCompleteWithoutTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeWithoutTermHearing) return;
    setIsSubmittingComplete(true);
    try {
      await apiRequest(`/api/hearings/${completeWithoutTermHearing.id}/complete-without-term`, token, {
        method: 'POST',
        body: JSON.stringify({ note: completeWithoutTermNote }),
      });
      setCompleteWithoutTermHearing(null);
      setCompleteWithoutTermNote('');
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao marcar audiência como realizada: ${err.message}`);
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const handleDeleteHearing = async () => {
    if (!deletingHearing) return;
    setIsDeleting(true);
    try {
      await apiRequest(`/api/hearings/${deletingHearing.id}`, token, {
        method: 'DELETE',
      });
      setDeletingHearing(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao excluir audiência: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateOfficerNotice = async (
    hearingOfficerId: number,
    patch: Record<string, any>
  ) => {
    try {
      await apiRequest(`/api/hearings/officers/${hearingOfficerId}/notice`, token, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      await onRefresh();
      // Atualizar objeto local do modal se aberto
      if (managingOfficersHearing) {
        const updatedH = hearings.find((h) => h.id === managingOfficersHearing.id);
        if (updatedH) setManagingOfficersHearing(updatedH);
      }
    } catch (err: any) {
      alert(`Erro ao atualizar status do ofício: ${err.message}`);
    }
  };

  // Filtragem
  const filteredHearings = hearings.filter((h) => {
    if (statusFilter !== 'todos' && h.status !== statusFilter) return false;
    if (officerFilter !== 'todos') {
      const oid = Number(officerFilter);
      if (!(h.officers || []).some((o) => o.officerId === oid)) return false;
    }
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const num = (h.noticeNumber || '').toLowerCase();
      const court = (h.court || '').toLowerCase();
      const offMatch = (h.officers || []).some((o) =>
        o.officerFullName.toLowerCase().includes(term)
      );
      if (!num.includes(term) && !court.includes(term) && !offMatch) return false;
    }
    return true;
  });

  // Dias do Mês para Visão Calendário
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth - 1, 1).getDay();

  return (
    <div className="space-y-6">
      {/* Barra de Controles e Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Alternador Tabela / Calendário */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('tabela')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'tabela'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
            <button
              onClick={() => setViewMode('calendario')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'calendario'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>
          </div>

          {/* Filtro de Situação */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium"
          >
            <option value="todos">Todas as Situações</option>
            <option value="agendada">Agendadas</option>
            <option value="remarcada">Remarcadas</option>
            <option value="realizada">Realizadas</option>
            <option value="nao_ocorreu">Não Ocorreu</option>
            <option value="cancelada">Canceladas</option>
          </select>

          {/* Filtro por Policial */}
          <select
            value={officerFilter}
            onChange={(e) => setOfficerFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium max-w-xs truncate"
          >
            <option value="todos">Todos os Policiais</option>
            {officers.map((off) => (
              <option key={off.id} value={off.id}>
                {off.rank} {off.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-export-hearings-csv"
            onClick={() => exportHearingsToCSV(filteredHearings)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          {canEdit && onOpenOfficialNoticeImport && (
            <button
              id="btn-open-notice-import-hearings"
              onClick={onOpenOfficialNoticeImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-colors"
              title="Importar dados e policiais copiando o texto do Ofício Judicial"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Importar do Ofício</span>
            </button>
          )}

          {canEdit && onOpenBatchImport && (
            <button
              id="btn-open-batch-import-hearings"
              onClick={onOpenBatchImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs transition-colors"
              title="Importar em lote do WhatsApp"
            >
              <MessageSquareShare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importar WhatsApp</span>
            </button>
          )}

          {canEdit && (
            <button
              id="btn-new-hearing-main"
              onClick={() => {
                setCreateForm({
                  noticeNumber: '',
                  seiNumber: '',
                  hearingDate: new Date().toISOString().split('T')[0],
                  hearingTime: '09:00',
                  court: 'Vara da Justiça Militar Estadual',
                  modality: 'presencial',
                  location: 'Fórum Rodolfo Aureliano - Ilha de Joana Bezerra, Recife',
                  notes: '',
                  selectedOfficerIds: [],
                });
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs shadow-blue-600/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova Audiência</span>
            </button>
          )}
        </div>
      </div>

      {/* VISÃO CALENDÁRIO */}
      {viewMode === 'calendario' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-5">
          {/* Header do Mês com navegação */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-900 capitalize">
              {new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('pt-BR', {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12);
                    setSelectedYear(selectedYear - 1);
                  } else {
                    setSelectedMonth(selectedMonth - 1);
                  }
                }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1);
                    setSelectedYear(selectedYear + 1);
                  } else {
                    setSelectedMonth(selectedMonth + 1);
                  }
                }}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Grade de dias da semana */}
          <div className="grid grid-cols-7 gap-1 pt-3 text-center text-xs font-bold text-slate-500">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Dias */}
          <div className="grid grid-cols-7 gap-1 pt-2">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[90px] bg-slate-50/50 rounded-lg p-1.5" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const dayHearings = filteredHearings.filter((h) => h.hearingDate === dateStr);

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`min-h-[95px] rounded-lg p-1.5 border transition-all ${
                    dayHearings.length > 0
                      ? 'bg-blue-50/30 border-blue-200'
                      : 'bg-white border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-right text-xs font-bold text-slate-700">{dayNum}</div>
                  <div className="space-y-1 mt-1">
                    {dayHearings.slice(0, 2).map((h) => (
                      <div
                        key={h.id}
                        onClick={() => setManagingOfficersHearing(h)}
                        className="p-1 rounded-sm bg-indigo-600 text-white text-[10px] truncate cursor-pointer hover:bg-indigo-700"
                        title={`${h.hearingTime} - Ofício ${h.noticeNumber} - ${h.court}`}
                      >
                        <span className="font-bold">{h.hearingTime}</span> Ofício {h.noticeNumber}
                      </div>
                    ))}
                    {dayHearings.length > 2 && (
                      <span className="text-[10px] text-blue-700 font-bold block">
                        +{dayHearings.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISÃO TABELA */}
      {viewMode === 'tabela' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">Carregando audiências...</div>
          ) : filteredHearings.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Gavel className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-700 text-sm">
                Nenhuma audiência judicial encontrada
              </p>
              <p className="text-xs text-slate-400">
                Cadastre novas audiências ou use a importação em lote de mensagens do WhatsApp.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHearings.map((h) => {
                const officersList = h.officers || [];
                const hasPendingAlerts = (h.pendingAlerts || []).length > 0;

                return (
                  <div
                    key={h.id}
                    id={`hearing-card-${h.id}`}
                    className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-900">
                          Ofício {h.noticeNumber}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            h.status === 'agendada'
                              ? 'bg-blue-100 text-blue-800'
                              : h.status === 'remarcada'
                              ? 'bg-amber-100 text-amber-800'
                              : h.status === 'realizada'
                              ? 'bg-emerald-100 text-emerald-800'
                              : h.status === 'nao_ocorreu'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {h.status === 'nao_ocorreu' ? 'Não Ocorreu' : h.status}
                        </span>

                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-medium">
                          {h.modality === 'remota' ? (
                            <Video className="w-3 h-3 text-blue-600" />
                          ) : (
                            <MapPin className="w-3 h-3 text-slate-600" />
                          )}
                          {h.modality === 'remota' ? 'Audiência Virtual' : 'Presencial'}
                        </span>
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="text-sm font-bold text-slate-900">{h.court}</h4>
                        {h.location && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{h.location}</span>
                          </p>
                        )}
                      </div>

                      {/* Policiais Vinculados e seus Ofícios */}
                      <div className="pt-1">
                        <span className="text-xs font-semibold text-slate-700 block mb-1">
                          Policiais a Apresentar ({officersList.length}):
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {officersList.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">
                              Nenhum policial vinculado a esta audiência.
                            </span>
                          ) : (
                            officersList.map((ho) => (
                              <div
                                key={ho.id}
                                className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                                  <span>
                                    {ho.officerRank} {ho.officerFullName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded-sm text-[10px] font-bold uppercase ${
                                      ho.noticeStatus === 'termo_recebido'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : ho.noticeStatus === 'ciencia_registrada'
                                        ? 'bg-blue-100 text-blue-800'
                                        : ho.noticeStatus === 'assinado'
                                        ? 'bg-indigo-100 text-indigo-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {ho.noticeStatus.replace('_', ' ')}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Alertas pós-audiência (assinatura, ciência, termo faltando) */}
                      {hasPendingAlerts && (
                        <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                          <div className="font-bold flex items-center gap-1 text-amber-950">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pendências de Ofício e Apresentação:</span>
                          </div>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                            {h.pendingAlerts!.map((alert, idx) => (
                              <li key={idx}>{alert}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Motivo de Não Ter Ocorrido */}
                      {h.status === 'nao_ocorreu' && h.didNotOccurReason && (
                        <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                          <strong>Motivo de não ocorrência:</strong> {h.didNotOccurReason}
                        </div>
                      )}
                    </div>

                    {/* Data, Hora e Ações */}
                    <div className="flex flex-col items-end gap-2 shrink-0 self-start">
                      <div className="text-right">
                        <div className="text-sm font-bold text-slate-900">
                          {formatDateBR(h.hearingDate)}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{h.hearingTime}</span>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            id={`btn-manage-hearing-${h.id}`}
                            onClick={() => setManagingOfficersHearing(h)}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            Ofícios & Ciência
                          </button>

                          {h.status !== 'realizada' && h.status !== 'nao_ocorreu' && (
                            <>
                              <button
                                id={`btn-resched-hearing-${h.id}`}
                                onClick={() => {
                                  setReschedulingHearing(h);
                                  setRescheduleForm({
                                    newDate: h.hearingDate,
                                    newTime: h.hearingTime,
                                    reason: '',
                                  });
                                }}
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                title="Remarcar audiência"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>

                              <button
                                id={`btn-complete-no-term-hearing-${h.id}`}
                                onClick={() => {
                                  setCompleteWithoutTermHearing(h);
                                  setCompleteWithoutTermNote('');
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Marcar como realizada (sem termo de comparecimento)"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>

                              <button
                                id={`btn-did-not-occur-${h.id}`}
                                onClick={() => {
                                  setDidNotOccurHearing(h);
                                  setDidNotOccurReason('');
                                }}
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                title="Registrar que audiência não ocorreu"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            id={`btn-delete-hearing-${h.id}`}
                            onClick={() => setDeletingHearing(h)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Excluir audiência judicial"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Nova Audiência */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <h4 className="text-sm font-bold text-slate-900">Agendar Nova Audiência Judicial</h4>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHearing} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nº do Ofício Judicial / Processo *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.noticeNumber}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, noticeNumber: e.target.value })
                    }
                    placeholder="Ex.: 92466419 ou 000123-2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nº SEI (Opcional)</label>
                  <input
                    type="text"
                    value={createForm.seiNumber}
                    onChange={(e) => setCreateForm({ ...createForm, seiNumber: e.target.value })}
                    placeholder="Ex.: 0012345-67.2026..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data da Audiência *</label>
                  <input
                    type="date"
                    required
                    value={createForm.hearingDate}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, hearingDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Horário (Recife) *</label>
                  <input
                    type="time"
                    required
                    value={createForm.hearingTime}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, hearingTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Vara / Juízo *</label>
                  <input
                    type="text"
                    required
                    value={createForm.court}
                    onChange={(e) => setCreateForm({ ...createForm, court: e.target.value })}
                    placeholder="Ex.: Vara da Justiça Militar Estadual de Pernambuco"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Modalidade *</label>
                  <select
                    value={createForm.modality}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        modality: e.target.value as 'presencial' | 'remota',
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="remota">Virtual / Remota (Videoconferência)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Local / Link</label>
                  <input
                    type="text"
                    value={createForm.location}
                    onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                    placeholder="Endereço do fórum ou link da sala virtual"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Seleção de Policiais (Muitos para Muitos) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Vincular Policiais Convocados (Muitos para Muitos)
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1 bg-slate-50">
                  {officers.length === 0 ? (
                    <p className="text-slate-400 italic p-2">Nenhum policial cadastrado.</p>
                  ) : (
                    officers.map((off) => {
                      const isSelected = createForm.selectedOfficerIds.includes(off.id);
                      return (
                        <label
                          key={off.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateForm({
                                  ...createForm,
                                  selectedOfficerIds: [...createForm.selectedOfficerIds, off.id],
                                });
                              } else {
                                setCreateForm({
                                  ...createForm,
                                  selectedOfficerIds: createForm.selectedOfficerIds.filter(
                                    (id) => id !== off.id
                                  ),
                                });
                              }
                            }}
                            className="rounded-sm text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-800">
                            {off.rank} {off.fullName}
                          </span>
                          {off.badge && (
                            <span className="text-slate-400 text-[10px]">({off.badge})</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                >
                  Agendar Audiência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Remarcação de Audiência */}
      {reschedulingHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">Remarcar Audiência Judicial</h4>
              <button
                onClick={() => setReschedulingHearing(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReschedule} className="p-5 space-y-3.5 text-xs">
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                A remarcação invalidará lembretes anteriores pendentes e registrará o histórico
                formal de alterações com seu usuário.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nova Data *</label>
                  <input
                    type="date"
                    required
                    value={rescheduleForm.newDate}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, newDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Novo Horário *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleForm.newTime}
                    onChange={(e) =>
                      setRescheduleForm({ ...rescheduleForm, newTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo da Remarcação *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rescheduleForm.reason}
                  onChange={(e) =>
                    setRescheduleForm({ ...rescheduleForm, reason: e.target.value })
                  }
                  placeholder="Informe o despacho, ofício de redesignação ou solicitação..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReschedulingHearing(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                >
                  Salvar Remarcação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Audiência Não Ocorreu */}
      {didNotOccurHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Registrar que a Audiência Não Ocorreu
              </h4>
              <button
                onClick={() => setDidNotOccurHearing(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDidNotOccur} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Motivo pelo qual a audiência não se realizou *
                </label>
                <textarea
                  required
                  rows={3}
                  value={didNotOccurReason}
                  onChange={(e) => setDidNotOccurReason(e.target.value)}
                  placeholder="Ex.: Ausência do magistrado, greve, testemunha ausente, pedido do MP..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDidNotOccurHearing(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                >
                  Gravar Ocorrência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Marcar como Realizada sem Termo de Comparecimento */}
      {completeWithoutTermHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Marcar Audiência como Realizada</span>
              </div>
              <button
                onClick={() => setCompleteWithoutTermHearing(null)}
                disabled={isSubmittingComplete}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompleteWithoutTerm} className="p-5 space-y-3.5 text-xs text-slate-700">
              <p>
                Deseja confirmar que a audiência referente ao processo/ofício{' '}
                <strong className="text-slate-900">{completeWithoutTermHearing.noticeNumber}</strong> foi{' '}
                <strong>efetivamente realizada</strong> mesmo sem o termo de comparecimento fornecido pela vara?
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div>
                  <strong className="text-slate-900">Data / Hora:</strong>{' '}
                  {formatDateBR(completeWithoutTermHearing.hearingDate)} às {completeWithoutTermHearing.hearingTime}
                </div>
                <div>
                  <strong className="text-slate-900">Vara / Órgão:</strong> {completeWithoutTermHearing.court}
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
                <strong>Atenção:</strong> O status da audiência mudará para <strong>"Realizada"</strong> e o alerta de
                cobrança do termo de comparecimento será dispensado no painel.
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Observação Interna (Opcional)
                </label>
                <input
                  type="text"
                  value={completeWithoutTermNote}
                  onChange={(e) => setCompleteWithoutTermNote(e.target.value)}
                  placeholder="Ex.: Juizado não emitiu certidão; confirmado verbalmente com o policial"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompleteWithoutTermHearing(null)}
                  disabled={isSubmittingComplete}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComplete}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingComplete ? 'Salvando...' : 'Confirmar Realização'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Audiência */}
      {deletingHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-rose-100 bg-rose-50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Excluir Audiência Judicial</span>
              </div>
              <button
                onClick={() => setDeletingHearing(null)}
                disabled={isDeleting}
                className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-slate-600">
              <p className="text-slate-700">
                Tem certeza que deseja excluir permanentemente a audiência referente ao processo/ofício{' '}
                <strong className="text-slate-950">{deletingHearing.noticeNumber}</strong>?
              </p>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div>
                  <strong>Data / Hora:</strong> {formatDateBR(deletingHearing.hearingDate)} às {deletingHearing.hearingTime}
                </div>
                <div>
                  <strong>Órgão:</strong> {deletingHearing.court}
                </div>
                <div>
                  <strong>Policiais Vinculados:</strong> {deletingHearing.officers?.length || 0} policial(is)
                </div>
              </div>

              <p className="text-rose-600 font-semibold text-[11px]">
                Esta ação removerá a audiência, seus ofícios de apresentação vinculados e os lembretes pendentes associados. Esta operação não pode ser desfeita.
              </p>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingHearing(null)}
                  disabled={isDeleting}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteHearing}
                  disabled={isDeleting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Audiência'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Gestão de Ofícios e Ciência */}
      {managingOfficersHearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Gestão de Ofícios e Ciência - {managingOfficersHearing.noticeNumber}
                </h4>
                <p className="text-xs text-slate-500">
                  Data: {formatDateBR(managingOfficersHearing.hearingDate)} às{' '}
                  {managingOfficersHearing.hearingTime}
                </p>
              </div>
              <button
                onClick={() => setManagingOfficersHearing(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 text-xs">
                Atenção: Não presumir ciência ou assinatura pelo envio de mensagem. Marque cada
                etapa somente após confirmação expressa do policial ou documento físico/SEI assinado.
              </div>

              <div className="space-y-3">
                {(managingOfficersHearing.officers || []).map((ho) => (
                  <div
                    key={ho.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="font-bold text-slate-900 text-sm">
                          {ho.officerRank} {ho.officerFullName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {ho.officerPhone && (
                          <button
                            type="button"
                            onClick={() => {
                              const msg = buildHearingWhatsAppMessage({
                                officerRank: ho.officerRank,
                                officerName: ho.officerFullName,
                                processNumber: managingOfficersHearing.noticeNumber,
                                hearingDate: managingOfficersHearing.hearingDate,
                                hearingTime: managingOfficersHearing.hearingTime,
                                court: managingOfficersHearing.court,
                                location: managingOfficersHearing.location,
                                modality: managingOfficersHearing.modality,
                                officialNoticeNumber: ho.officialNoticeNumber,
                              });
                              openWhatsAppChat(ho.officerPhone, msg);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 rounded-md border border-emerald-300 transition-colors"
                            title="Enviar aviso de audiência pelo WhatsApp"
                          >
                            <Send className="w-3 h-3 text-emerald-700" />
                            <span>Enviar WhatsApp</span>
                          </button>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                          {ho.noticeStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block">Nº Ofício de Apresentação:</span>
                        <input
                          type="text"
                          defaultValue={ho.officialNoticeNumber || ''}
                          onBlur={(e) =>
                            handleUpdateOfficerNotice(ho.id, {
                              officialNoticeNumber: e.target.value,
                            })
                          }
                          placeholder="Ex.: 92466419"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs mt-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 block">Nº Documento SEI:</span>
                        <input
                          type="text"
                          defaultValue={ho.officialNoticeSei || ''}
                          onBlur={(e) =>
                            handleUpdateOfficerNotice(ho.id, {
                              officialNoticeSei: e.target.value,
                            })
                          }
                          placeholder="Ex.: 12345678"
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs mt-0.5"
                        />
                      </div>
                    </div>

                    {/* Checkboxes de Confirmação Formal */}
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={Boolean(ho.signedAt) || ho.noticeStatus === 'assinado'}
                          onChange={(e) =>
                            handleUpdateOfficerNotice(ho.id, {
                              signed: e.target.checked,
                              noticeStatus: e.target.checked ? 'assinado' : 'pendente',
                            })
                          }
                          className="rounded-sm text-blue-600"
                        />
                        <span>Assinado pelo Comandante</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={
                            Boolean(ho.acknowledgedAt) ||
                            ho.noticeStatus === 'ciencia_registrada'
                          }
                          onChange={(e) =>
                            handleUpdateOfficerNotice(ho.id, {
                              acknowledged: e.target.checked,
                              noticeStatus: e.target.checked
                                ? 'ciencia_registrada'
                                : 'assinado',
                            })
                          }
                          className="rounded-sm text-blue-600"
                        />
                        <span>Ciência do Policial Confirmada</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={
                            Boolean(ho.attendanceTermReceivedAt) ||
                            ho.noticeStatus === 'termo_recebido'
                          }
                          onChange={(e) =>
                            handleUpdateOfficerNotice(ho.id, {
                              attendanceTermReceived: e.target.checked,
                              noticeStatus: e.target.checked
                                ? 'termo_recebido'
                                : 'ciencia_registrada',
                            })
                          }
                          className="rounded-sm text-emerald-600"
                        />
                        <span>Termo de Comparecimento Recebido (Pós)</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setManagingOfficersHearing(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
