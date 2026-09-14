import React, { useState } from 'react';
import {
  FileText,
  AlertTriangle,
  Clock,
  Gavel,
  FileCheck,
  BellRing,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Calendar,
  User,
  Shield,
  Activity,
  Filter,
  Info,
} from 'lucide-react';
import { DashboardStats, JudicialHearing } from '../types.ts';
import { formatDateBR } from '../lib/deadline-calculator.ts';
import { NavTab } from './Sidebar.tsx';

interface DashboardViewProps {
  stats?: DashboardStats | null;
  metrics?: DashboardStats | null;
  loading: boolean;
  onNavigate: (tab: any) => void;
  onSelectProcedure?: (id: number) => void;
  onSelectHearing?: (id: number) => void;
  onOpenBatchImport?: () => void;
  globalSearch?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  metrics: incomingMetrics,
  loading,
  onNavigate,
  onSelectProcedure,
  onSelectHearing,
  onOpenBatchImport,
  globalSearch = '',
}) => {
  const [selectedResponsible, setSelectedResponsible] = useState<string>('todos');

  const actualStats = stats || incomingMetrics;

  if (loading && !actualStats) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px] text-slate-500 gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium">Carregando indicadores da Central...</p>
      </div>
    );
  }

  const safeStats: DashboardStats = actualStats || {
    metrics: {
      activeProcedures: 0,
      overdueDeadlines: 0,
      upcomingDeadlines7Days: 0,
      upcomingHearings: 0,
      pendingNotices: 0,
      pendingReminders: 0,
    },
    urgentDeadlines: [],
    upcomingHearings: [],
    recentActivity: [],
  };

  const {
    metrics = {
      activeProcedures: 0,
      overdueDeadlines: 0,
      upcomingDeadlines7Days: 0,
      upcomingHearings: 0,
      pendingNotices: 0,
      pendingReminders: 0,
    },
    urgentDeadlines = [],
    upcomingHearings = [],
    recentActivity = [],
  } = safeStats;



  // Filtrar responsáveis únicos
  const responsiblesList = Array.from(
    new Set(urgentDeadlines.map((d) => d.responsible).filter(Boolean))
  ) as string[];

  // Aplicar filtro de responsável e busca
  const filteredDeadlines = urgentDeadlines.filter((d) => {
    if (selectedResponsible !== 'todos' && d.responsible !== selectedResponsible) {
      return false;
    }
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const code = (d.procedureCode || '').toLowerCase();
      const subj = (d.procedureSubject || '').toLowerCase();
      const title = (d.title || '').toLowerCase();
      const resp = (d.responsible || '').toLowerCase();
      return code.includes(term) || subj.includes(term) || title.includes(term) || resp.includes(term);
    }
    return true;
  });

  const filteredHearings = upcomingHearings.filter((h) => {
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const num = (h.noticeNumber || '').toLowerCase();
      const court = (h.court || '').toLowerCase();
      const officersMatch = (h.officers || []).some(
        (o) =>
          o.officerFullName.toLowerCase().includes(term) ||
          o.officerRank.toLowerCase().includes(term)
      );
      return num.includes(term) || court.includes(term) || officersMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Banner Oficial SEI */}
      <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-start gap-3.5 text-blue-900 text-xs sm:text-sm">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-blue-950">
            Aviso Institucional: O SEI é a fonte oficial dos autos processuais
          </p>
          <p className="text-blue-800 leading-relaxed text-xs">
            Esta ferramenta interna destina-se exclusivamente ao controle administrativo de prazos,
            comunicações e audiências da equipe militar. Atos e decisões devem ser lavrados e assinados
            diretamente no SEI da PMPE.
          </p>
        </div>
      </div>

      {/* Cartões de Indicadores Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Procedimentos Ativos (Azul Claro) */}
        <div
          id="metric-card-procedimentos"
          onClick={() => onNavigate('procedimentos')}
          className="p-4 rounded-xl bg-blue-50/70 hover:bg-blue-50 border border-blue-200/90 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ativos</span>
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-blue-950">
              {metrics.activeProcedures}
            </div>
            <p className="text-xs text-blue-700 font-medium mt-0.5">PDS e Sindicâncias</p>
          </div>
          <div className="flex items-center text-[11px] font-semibold text-blue-700 group-hover:text-blue-900 mt-3 pt-2 border-t border-blue-200/60">
            <span>Ver lista</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 2. Prazos Vencidos (Rosa Claro) */}
        <div
          id="metric-card-prazos-vencidos"
          onClick={() => onNavigate('prazos')}
          className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between group ${
            metrics.overdueDeadlines > 0
              ? 'bg-rose-50/80 hover:bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Vencidos</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-rose-700">
              {metrics.overdueDeadlines}
            </div>
            <p className="text-xs text-rose-600 font-medium mt-0.5">Prazos expirados</p>
          </div>
          <div className="flex items-center text-[11px] font-semibold text-rose-700 group-hover:text-rose-900 mt-3 pt-2 border-t border-rose-200/60">
            <span>Regularizar</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 3. Prazos Próximos 7 Dias (Âmbar Claro) */}
        <div
          id="metric-card-prazos-proximos"
          onClick={() => onNavigate('prazos')}
          className="p-4 rounded-xl bg-amber-50/70 hover:bg-amber-50 border border-amber-200/90 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Em 7 Dias</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-amber-950">
              {metrics.upcomingDeadlines7Days}
            </div>
            <p className="text-xs text-amber-800 font-medium mt-0.5">Prazos iminentes</p>
          </div>
          <div className="flex items-center text-[11px] font-semibold text-amber-700 group-hover:text-amber-900 mt-3 pt-2 border-t border-amber-200/60">
            <span>Acompanhar</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 4. Audiências Próximas (Azul Anil Claro) */}
        <div
          id="metric-card-audiencias"
          onClick={() => onNavigate('audiencias')}
          className="p-4 rounded-xl bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-200/90 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-indigo-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Audiências</span>
            <Gavel className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-indigo-950">
              {metrics.upcomingHearings}
            </div>
            <p className="text-xs text-indigo-800 font-medium mt-0.5">Próximos 15 dias</p>
          </div>
          <div className="flex items-center text-[11px] font-semibold text-indigo-700 group-hover:text-indigo-900 mt-3 pt-2 border-t border-indigo-200/60">
            <span>Agenda judicial</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 5. Ofícios Pendentes (Rosa/Roxo Suave) */}
        <div
          id="metric-card-oficios"
          onClick={() => onNavigate('oficios')}
          className="p-4 rounded-xl bg-purple-50/70 hover:bg-purple-50 border border-purple-200/90 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-purple-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Ofícios</span>
            <FileCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-purple-950">
              {metrics.pendingNotices}
            </div>
            <p className="text-xs text-purple-800 font-medium mt-0.5">Pendentes assinatura/ciência</p>
          </div>
          <div className="flex items-center text-[11px] font-semibold text-purple-700 group-hover:text-purple-900 mt-3 pt-2 border-t border-purple-200/60">
            <span>Rastrear ofícios</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* 6. Lembretes WhatsApp (Verde Claro) */}
        <div
          id="metric-card-lembretes"
          onClick={() => onNavigate('lembretes')}
          className="p-4 rounded-xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/90 cursor-pointer transition-all hover:shadow-sm flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Lembretes</span>
            <BellRing className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-950">
              {metrics.pendingReminders}
            </div>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">Pendentes / Falhas</p>
          </div>
          <div className="flex items-center text-[11px] font-semibold text-emerald-700 group-hover:text-emerald-900 mt-3 pt-2 border-t border-emerald-200/60">
            <span>Disparar avisos</span>
            <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>

      {/* Barra de Filtro de Responsável */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Filter className="w-4 h-4 text-slate-500" />
          <span>Filtrar prazos por Encarregado / Responsável:</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            id="dashboard-filter-responsible"
            value={selectedResponsible}
            onChange={(e) => setSelectedResponsible(e.target.value)}
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="todos">Todos os Responsáveis</option>
            {responsiblesList.map((resp) => (
              <option key={resp} value={resp}>
                {resp}
              </option>
            ))}
          </select>
          {selectedResponsible !== 'todos' && (
            <button
              onClick={() => setSelectedResponsible('todos')}
              className="text-xs text-blue-600 hover:underline"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Grade Principal: Prazos Urgentes x Próximas Audiências */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna 1: Prazos Urgentes (7 colunas) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Prazos por Urgência</h3>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-200 text-slate-700 rounded-full">
                {filteredDeadlines.length}
              </span>
            </div>
            <button
              id="btn-see-all-deadlines"
              onClick={() => onNavigate('prazos')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-[480px]">
            {filteredDeadlines.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhum prazo vencido ou iminente registrado para o filtro selecionado.
              </div>
            ) : (
              filteredDeadlines.map((dl) => {
                const isOverdue = dl.urgency === 'vencido';
                return (
                  <div
                    key={dl.id}
                    id={`urgent-dl-${dl.id}`}
                    className={`p-3.5 rounded-lg border transition-all ${
                      isOverdue
                        ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                        : 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              isOverdue
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-500 text-slate-950 font-bold'
                            }`}
                          >
                            {isOverdue ? 'Vencido' : 'Próximo'}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {dl.procedureCode}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 mt-1">{dl.title}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {dl.procedureSubject}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900">
                          {formatDateBR(dl.dueDate)}
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          {dl.isConfirmed ? 'Confirmado' : 'A confirmar'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
                      <span className="flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-slate-400" />
                        {dl.responsible || 'Sem responsável'}
                      </span>
                      <button
                        onClick={() => {
                          if (onSelectProcedure && dl.procedureId) {
                            onSelectProcedure(dl.procedureId);
                          } else {
                            onNavigate('prazos');
                          }
                        }}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Abrir procedimento
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Coluna 2: Próximas Audiências (5 colunas) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-900">Audiências Previstas</h3>
              <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-200 text-slate-700 rounded-full">
                {filteredHearings.length}
              </span>
            </div>
            <button
              id="btn-see-all-hearings"
              onClick={() => onNavigate('audiencias')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>Ver agenda</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 flex-1 space-y-3 overflow-y-auto max-h-[480px]">
            {filteredHearings.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Nenhuma audiência agendada para os próximos 15 dias.
              </div>
            ) : (
              filteredHearings.map((h) => (
                <div
                  key={h.id}
                  id={`upcoming-hearing-${h.id}`}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-700">
                          Ofício {h.noticeNumber}
                        </span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                          {h.modality}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 mt-1 line-clamp-1">
                        {h.court}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900">
                        {formatDateBR(h.hearingDate)}
                      </div>
                      <div className="text-[11px] text-slate-600 font-semibold">{h.hearingTime}</div>
                    </div>
                  </div>

                  {/* Policiais convocados */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60">
                    <p className="text-[11px] text-slate-500 font-medium mb-1">
                      Policiais a apresentar:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {h.officers && h.officers.length > 0 ? (
                        h.officers.map((off) => (
                          <span
                            key={off.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-700"
                          >
                            <Shield className="w-2.5 h-2.5 text-blue-600" />
                            {off.officerRank} {off.officerFullName}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Aguardando vinculação
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Painel de Últimas Movimentações e Auditoria */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900">Últimas Movimentações no Sistema</h3>
          </div>
          <span className="text-xs text-slate-400">Trilha de Auditoria Administrativa</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
          {recentActivity.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              Nenhuma atividade registrada até o momento.
            </div>
          ) : (
            recentActivity.map((log) => {
              const formatAction = (act: string) => {
                switch (act) {
                  case 'CREATE':
                    return 'Criação';
                  case 'UPDATE':
                    return 'Edição';
                  case 'EXTEND_DEADLINE':
                    return 'Prorrogação de Prazo';
                  case 'CONFIRM_DEADLINE':
                    return 'Confirmação de Prazo';
                  case 'RESCHEDULE_HEARING':
                    return 'Remarcação de Audiência';
                  case 'BATCH_IMPORT_HEARINGS':
                    return 'Importação WhatsApp';
                  case 'IMPORT_OFFICIAL_NOTICE_HEARING':
                    return 'Importação de Ofício';
                  case 'UPDATE_NOTICE_STATUS':
                    return 'Atualização de Ofício';
                  default:
                    return act;
                }
              };

              let detailsObj: any = {};
              try {
                detailsObj = log.details ? JSON.parse(log.details) : {};
              } catch {
                // ignore
              }

              return (
                <div key={log.id} className="px-5 py-3 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700 uppercase text-[10px] shrink-0">
                      {formatAction(log.action)}
                    </span>
                    <span className="font-semibold text-slate-800 shrink-0 capitalize">
                      {log.entityType}
                    </span>
                    <span className="text-slate-500 truncate">
                      {detailsObj.code || detailsObj.noticeNumber || detailsObj.subject || log.userEmail}
                    </span>
                  </div>

                  <div className="text-right shrink-0 text-slate-400 text-[11px]">
                    <span className="text-slate-600 font-medium">{log.userEmail}</span>
                    <span className="mx-1.5">•</span>
                    <span>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' }) : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
