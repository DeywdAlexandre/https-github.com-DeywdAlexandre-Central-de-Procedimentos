import React from 'react';
import { Plus } from 'lucide-react';
import { PROCEDURES_PHASES } from './modals/CreateProcedureModal.tsx';

interface ProceduresFiltersProps {
  filterType: string;
  setFilterType: (type: string) => void;
  filterPhase: string;
  setFilterPhase: (phase: string) => void;
  showArchived: boolean;
  setShowArchived: (archived: boolean) => void;
  canEdit: boolean;
  onOpenCreate: () => void;
}

export const ProceduresFilters: React.FC<ProceduresFiltersProps> = ({
  filterType,
  setFilterType,
  filterPhase,
  setFilterPhase,
  showArchived,
  setShowArchived,
  canEdit,
  onOpenCreate,
}) => {
  return (
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
            {PROCEDURES_PHASES.map((ph) => (
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
          onClick={onOpenCreate}
          className="btn-3d-primary px-3.5 py-2 text-xs rounded-lg shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Procedimento</span>
        </button>
      )}
    </div>
  );
};
