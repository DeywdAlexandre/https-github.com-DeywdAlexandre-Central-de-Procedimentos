import React from 'react';
import { List, Calendar as CalendarIcon, Download, FileText, MessageSquareShare, Plus } from 'lucide-react';
import { PoliceOfficer, JudicialHearing } from '../../types.ts';
import { exportHearingsToCSV } from '../../lib/csv-export.ts';

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
            onClick={onOpenNewHearing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs shadow-blue-600/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Audiência</span>
          </button>
        )}
      </div>
    </div>
  );
};
