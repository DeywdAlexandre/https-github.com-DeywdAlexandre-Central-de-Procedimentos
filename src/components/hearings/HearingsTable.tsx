import React from 'react';
import {
  Gavel,
  Video,
  MapPin,
  Clock,
  Shield,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trash2,
} from 'lucide-react';
import { JudicialHearing } from '../../types.ts';
import { formatDateBR } from '../../lib/deadline-calculator.ts';

interface HearingsTableProps {
  loading: boolean;
  hearings: JudicialHearing[];
  canEdit: boolean;
  onManageOfficers: (hearing: JudicialHearing) => void;
  onReschedule: (hearing: JudicialHearing) => void;
  onCompleteWithoutTerm: (hearing: JudicialHearing) => void;
  onDidNotOccur: (hearing: JudicialHearing) => void;
  onDelete: (hearing: JudicialHearing) => void;
}

export const HearingsTable: React.FC<HearingsTableProps> = ({
  loading,
  hearings,
  canEdit,
  onManageOfficers,
  onReschedule,
  onCompleteWithoutTerm,
  onDidNotOccur,
  onDelete,
}) => {
  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Carregando audiências...</div>;
  }

  if (hearings.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-2">
        <Gavel className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="font-semibold text-slate-700 text-sm">Nenhuma audiência judicial encontrada</p>
        <p className="text-xs text-slate-400">
          Cadastre novas audiências ou use a importação em lote de mensagens do WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {hearings.map((h) => {
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
                    onClick={() => onManageOfficers(h)}
                    className="btn-3d-secondary px-2.5 py-1 text-xs rounded-md"
                  >
                    Ofícios & Ciência
                  </button>

                  {h.status !== 'realizada' && h.status !== 'nao_ocorreu' && (
                    <>
                      <button
                        id={`btn-resched-hearing-${h.id}`}
                        onClick={() => onReschedule(h)}
                        className="btn-3d-secondary p-1.5 rounded-md text-amber-600 hover:text-amber-700"
                        title="Remarcar audiência"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      <button
                        id={`btn-complete-no-term-hearing-${h.id}`}
                        onClick={() => onCompleteWithoutTerm(h)}
                        className="btn-3d-emerald p-1.5 rounded-md"
                        title="Marcar como realizada (sem termo de comparecimento)"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>

                      <button
                        id={`btn-did-not-occur-${h.id}`}
                        onClick={() => onDidNotOccur(h)}
                        className="btn-3d-danger p-1.5 rounded-md"
                        title="Registrar que audiência não ocorreu"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    id={`btn-delete-hearing-${h.id}`}
                    onClick={() => onDelete(h)}
                    className="btn-3d-secondary p-1.5 rounded-md text-slate-400 hover:text-rose-600"
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
  );
};
