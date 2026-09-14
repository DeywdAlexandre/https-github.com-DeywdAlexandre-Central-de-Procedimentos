import React from 'react';
import { Download, Plus } from 'lucide-react';
import { ProcedureDeadline, DisciplinaryProcedure } from '../../types.ts';
import { exportDeadlinesToCSV } from '../../lib/csv-export.ts';

interface DeadlinesFiltersProps {
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  deadlines: ProcedureDeadline[];
  filteredDeadlines: ProcedureDeadline[];
  canEdit: boolean;
  procedures: DisciplinaryProcedure[];
  onOpenNewDeadline: () => void;
}

export const DeadlinesFilters: React.FC<DeadlinesFiltersProps> = ({
  statusFilter,
  setStatusFilter,
  deadlines,
  filteredDeadlines,
  canEdit,
  procedures,
  onOpenNewDeadline,
}) => {
  const countVencidos = deadlines.filter((d) => d.effectiveStatus === 'vencido').length;
  const countAConfirmar = deadlines.filter((d) => d.effectiveStatus === 'a_confirmar').length;
  const countProximos = deadlines.filter((d) => d.effectiveStatus === 'proximo').length;

  return (
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
            onClick={onOpenNewDeadline}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs shadow-blue-600/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Prazo</span>
          </button>
        )}
      </div>
    </div>
  );
};
