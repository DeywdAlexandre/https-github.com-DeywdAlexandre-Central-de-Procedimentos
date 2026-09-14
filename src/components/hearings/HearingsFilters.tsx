import React from 'react';
import { List, Calendar as CalendarIcon, Download, FileText, MessageSquareShare, Plus } from 'lucide-react';
import { PoliceOfficer, JudicialHearing } from '../../types.ts';
import { exportHearingsToCSV } from '../../lib/csv-export.ts';
import { OfficerSearchSelect } from '../common/OfficerSearchSelect.tsx';

interface HearingsFiltersProps {
  viewMode: 'tabela' | 'calendario';
  setViewMode: (mode: 'tabela' | 'calendario') => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  officerFilter: string;
  setOfficerFilter: (id: string) => void;
  officers: PoliceOfficer[];
  filteredHearings: JudicialHearing[];
  canEdit: boolean;
  onOpenNewHearing: () => void;
  onOpenOfficialNoticeImport?: () => void;
  onOpenBatchImport?: () => void;
}

export const HearingsFilters: React.FC<HearingsFiltersProps> = ({
  viewMode,
  setViewMode,
  statusFilter,
  setStatusFilter,
  officerFilter,
  setOfficerFilter,
  officers,
  filteredHearings,
  canEdit,
  onOpenNewHearing,
  onOpenOfficialNoticeImport,
  onOpenBatchImport,
}) => {
  return (
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

        {/* Filtro por Policial com Busca Inteligente */}
        <OfficerSearchSelect
          officers={officers}
          selectedOfficerId={officerFilter}
          onSelectOfficer={setOfficerFilter}
          placeholder="Buscar policial por nome, graduação ou matrícula..."
          className="w-64 sm:w-72"
        />
      </div>

      {/* Botões de Ação */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          id="btn-export-hearings-csv"
          onClick={() => exportHearingsToCSV(filteredHearings)}
          className="btn-3d-secondary px-3 py-1.5 text-xs rounded-lg"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Exportar CSV</span>
        </button>

        {canEdit && onOpenOfficialNoticeImport && (
          <button
            id="btn-open-notice-import-hearings"
            onClick={onOpenOfficialNoticeImport}
            className="btn-3d-secondary px-3 py-1.5 text-xs rounded-lg"
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
            className="btn-3d-emerald px-3 py-1.5 text-xs rounded-lg"
            title="Importar em lote do WhatsApp"
          >
            <MessageSquareShare className="w-3.5 h-3.5" />
            <span>Importar WhatsApp</span>
          </button>
        )}

        {canEdit && (
          <button
            id="btn-new-hearing-main"
            onClick={onOpenNewHearing}
            className="btn-3d-primary px-3.5 py-1.5 text-xs rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Audiência</span>
          </button>
        )}
      </div>
    </div>
  );
};
