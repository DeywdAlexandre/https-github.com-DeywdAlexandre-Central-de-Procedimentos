import React from 'react';
import {
  FileText,
  ExternalLink,
  User,
  Calendar,
  AlertCircle,
  Clock,
  Eye,
  Edit2,
  Archive,
} from 'lucide-react';
import { DisciplinaryProcedure } from '../../types.ts';
import { formatDateBR, getTodayDateBR } from '../../lib/deadline-calculator.ts';

interface ProceduresTableProps {
  loading: boolean;
  procedures: DisciplinaryProcedure[];
  canEdit: boolean;
  onSelectProcedure?: (id: number | null) => void;
  onOpenEdit: (proc: DisciplinaryProcedure) => void;
  onToggleArchive: (proc: DisciplinaryProcedure) => void;
}

export const ProceduresTable: React.FC<ProceduresTableProps> = ({
  loading,
  procedures,
  canEdit,
  onSelectProcedure,
  onOpenEdit,
  onToggleArchive,
}) => {
  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Carregando procedimentos disciplinares...
      </div>
    );
  }

  if (procedures.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-2">
        <FileText className="w-8 h-8 text-slate-400 mx-auto" />
        <p className="font-semibold text-slate-700 text-sm">
          Nenhum procedimento encontrado
        </p>
        <p className="text-xs text-slate-400">
          Tente ajustar os filtros ou cadastre um novo PDS ou Sindicância.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {procedures.map((proc) => {
        const activeDeadlines = proc.deadlines || [];
        const pendingDl = activeDeadlines.find((d) => !d.isConfirmed);
        const todayStr = getTodayDateBR();
        const overdueDl = activeDeadlines.find(
          (d) =>
            (d.confirmedEndDate || d.calculatedEndDate) < todayStr && d.status !== 'concluido'
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
                className="btn-3d-secondary px-3 py-1.5 text-xs rounded-lg flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detalhar</span>
              </button>

              {canEdit && (
                <>
                  <button
                    id={`btn-edit-proc-${proc.id}`}
                    onClick={() => onOpenEdit(proc)}
                    className="btn-3d-secondary p-1.5 rounded-lg text-slate-600 hover:text-blue-600"
                    title="Editar dados cadastrais"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    id={`btn-archive-proc-${proc.id}`}
                    onClick={() => onToggleArchive(proc)}
                    className="btn-3d-secondary p-1.5 rounded-lg text-slate-600 hover:text-amber-600"
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
  );
};
