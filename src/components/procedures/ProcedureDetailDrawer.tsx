import React from 'react';
import { X, ExternalLink, Clock, History } from 'lucide-react';
import { DisciplinaryProcedure } from '../../types.ts';
import { formatDateBR } from '../../lib/deadline-calculator.ts';

interface ProcedureDetailDrawerProps {
  procedure: DisciplinaryProcedure | null;
  onClose: () => void;
  canEdit: boolean;
  onOpenTimelineModal: () => void;
}

export const ProcedureDetailDrawer: React.FC<ProcedureDetailDrawerProps> = ({
  procedure,
  onClose,
  canEdit,
  onOpenTimelineModal,
}) => {
  if (!procedure) return null;

  return (
    <div
      id="drawer-procedure-detail"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      {/* Header do Drawer */}
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-600 text-white">
              {procedure.type}
            </span>
            <h3 className="text-base font-bold text-slate-900">{procedure.code}</h3>
          </div>
          <p className="text-xs text-slate-600 mt-1">{procedure.subject}</p>
        </div>
        <button
          onClick={onClose}
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
            <span className="font-semibold text-slate-800">{procedure.responsible}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Fase Atual:</span>
            <span className="font-semibold text-slate-800">{procedure.phase}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Marco Inicial:</span>
            <span className="font-semibold text-slate-800">
              {formatDateBR(procedure.startDate)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block">Evento do Marco:</span>
            <span className="font-semibold text-slate-800">{procedure.startEvent}</span>
          </div>
          {procedure.seiNumber && (
            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60">
              <span className="text-slate-500">Nº SEI Oficial:</span>
              <div className="flex items-center gap-1.5 font-mono font-semibold text-blue-700">
                <span>{procedure.seiNumber}</span>
                {procedure.seiUrl && (
                  <a
                    href={procedure.seiUrl}
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
            {(procedure.deadlines || []).length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                Nenhum prazo cadastrado para este procedimento.
              </p>
            ) : (
              (procedure.deadlines || []).map((dl) => (
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
                onClick={onOpenTimelineModal}
                className="btn-3d-primary px-2.5 py-1 rounded-lg text-xs"
              >
                + Novo Andamento
              </button>
            )}
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
            {(procedure.timeline || []).length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg border border-slate-200">
                Nenhum andamento lançado.
              </p>
            ) : (
              (procedure.timeline || []).map((tl) => (
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
  );
};
