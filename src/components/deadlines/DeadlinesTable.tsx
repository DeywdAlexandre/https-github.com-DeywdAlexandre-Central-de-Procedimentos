import React from 'react';
import {
  Clock,
  User,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { ProcedureDeadline } from '../../types.ts';
import { formatDateBR } from '../../lib/deadline-calculator.ts';

interface DeadlinesTableProps {
  loading: boolean;
  deadlines: ProcedureDeadline[];
  canEdit: boolean;
  expandedBreakdownId: number | null;
  onToggleBreakdown: (id: number) => void;
  onConfirmDeadline: (dl: ProcedureDeadline) => Promise<void>;
  onOpenExtend: (dl: ProcedureDeadline) => void;
  onCompleteDeadline: (dl: ProcedureDeadline) => Promise<void>;
}

export const DeadlinesTable: React.FC<DeadlinesTableProps> = ({
  loading,
  deadlines,
  canEdit,
  expandedBreakdownId,
  onToggleBreakdown,
  onConfirmDeadline,
  onOpenExtend,
  onCompleteDeadline,
}) => {
  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Carregando prazos...</div>;
  }

  if (deadlines.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 space-y-1">
        <Clock className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="font-semibold text-slate-700 text-sm">Nenhum prazo encontrado</p>
        <p className="text-xs text-slate-400">Não há prazos registrados para o filtro selecionado.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {deadlines.map((dl) => {
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
                    onClick={() => onToggleBreakdown(dl.id)}
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
                      onClick={() => onConfirmDeadline(dl)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors"
                      title="Confirmar prazo explicitamente"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirmar Prazo</span>
                    </button>
                  )}

                  <button
                    id={`btn-extend-dl-${dl.id}`}
                    onClick={() => onOpenExtend(dl)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    title="Prorrogar, suspender ou reabrir"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Prorrogar / Suspender</span>
                  </button>

                  {dl.status !== 'concluido' && (
                    <button
                      id={`btn-complete-dl-${dl.id}`}
                      onClick={() => onCompleteDeadline(dl)}
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
  );
};
