import React, { useState } from 'react';
import { DisciplinaryProcedure, ProcedureDeadline } from '../types.ts';
import { formatDateBR, calculateDeadline, getTodayDateBR } from '../lib/deadline-calculator.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { DeadlinesFilters } from './deadlines/DeadlinesFilters.tsx';
import { DeadlinesTable } from './deadlines/DeadlinesTable.tsx';
import { ExtendDeadlineModal } from './deadlines/modals/ExtendDeadlineModal.tsx';
import { NewDeadlineModal } from './deadlines/modals/NewDeadlineModal.tsx';

interface DeadlinesViewProps {
  deadlines: ProcedureDeadline[];
  procedures: DisciplinaryProcedure[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
}

export const DeadlinesView: React.FC<DeadlinesViewProps> = ({
  deadlines,
  procedures,
  loading,
  onRefresh,
  globalSearch = '',
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [expandedBreakdownId, setExpandedBreakdownId] = useState<number | null>(null);

  // Modal de Prorrogação
  const [extendingDeadline, setExtendingDeadline] = useState<ProcedureDeadline | null>(null);

  // Modal de Novo Prazo
  const [isNewDeadlineModalOpen, setIsNewDeadlineModalOpen] = useState(false);
  const [newDeadlineForm, setNewDeadlineForm] = useState({
    procedureId: procedures[0]?.id || 0,
    title: 'Prazo Suplementar de Diligências',
    startDate: getTodayDateBR(),
    daysCount: '15',
    daysType: 'corridos' as 'corridos' | 'uteis',
    excludeStartDay: true,
    manualEndDate: '',
    manualJustification: '',
    responsible: '',
    confirmImmediately: false,
  });
  const [calculatedPreview, setCalculatedPreview] = useState<string>('');

  const handleRecalculatePreview = () => {
    if (!newDeadlineForm.startDate || !newDeadlineForm.daysCount) return;
    const res = calculateDeadline(
      newDeadlineForm.startDate,
      Number(newDeadlineForm.daysCount),
      newDeadlineForm.daysType,
      newDeadlineForm.excludeStartDay
    );
    setCalculatedPreview(res.breakdown);
  };

  const handleConfirmDeadline = async (dl: ProcedureDeadline) => {
    if (
      !confirm(
        `Deseja confirmar explicitamente o prazo "${dl.title}" com vencimento em ${formatDateBR(
          dl.calculatedEndDate
        )}?`
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/api/deadlines/${dl.id}/confirm`, token, { method: 'POST' });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao confirmar prazo: ${err.message}`);
    }
  };

  const handleCompleteDeadline = async (dl: ProcedureDeadline) => {
    if (!confirm(`Deseja marcar o prazo "${dl.title}" como concluído?`)) return;

    try {
      await apiRequest(`/api/deadlines/${dl.id}/complete`, token, { method: 'POST' });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao concluir prazo: ${err.message}`);
    }
  };

  const handleSaveExtension = async (
    deadlineId: number,
    data: {
      type: 'prorrogacao' | 'suspensao' | 'reabertura';
      newDate: string;
      legalBasis: string;
      reason: string;
    }
  ) => {
    try {
      await apiRequest(`/api/deadlines/${deadlineId}/extend`, token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao alterar prazo: ${err.message}`);
      throw err;
    }
  };

  const handleCreateDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(`/api/procedures/${newDeadlineForm.procedureId}/deadlines`, token, {
        method: 'POST',
        body: JSON.stringify(newDeadlineForm),
      });

      setIsNewDeadlineModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao registrar prazo: ${err.message}`);
    }
  };

  // Filtragem
  const filteredDeadlines = deadlines.filter((dl) => {
    if (statusFilter !== 'todos') {
      if (statusFilter === 'vencido' && dl.effectiveStatus !== 'vencido') return false;
      if (statusFilter === 'a_confirmar' && dl.effectiveStatus !== 'a_confirmar') return false;
      if (statusFilter === 'proximo' && dl.effectiveStatus !== 'proximo') return false;
      if (statusFilter === 'suspenso' && dl.status !== 'suspenso') return false;
      if (statusFilter === 'concluido' && dl.status !== 'concluido') return false;
    }
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const code = (dl.procedureCode || '').toLowerCase();
      const title = (dl.title || '').toLowerCase();
      const resp = (dl.responsible || '').toLowerCase();
      if (!code.includes(term) && !title.includes(term) && !resp.includes(term)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <DeadlinesFilters
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        deadlines={deadlines}
        filteredDeadlines={filteredDeadlines}
        canEdit={canEdit}
        procedures={procedures}
        onOpenNewDeadline={() => {
          if (procedures.length > 0) {
            setNewDeadlineForm({
              procedureId: procedures[0].id,
              title: 'Prazo de Diligências Complementares',
              startDate: getTodayDateBR(),
              daysCount: '15',
              daysType: 'corridos',
              excludeStartDay: true,
              manualEndDate: '',
              manualJustification: '',
              responsible: '',
              confirmImmediately: false,
            });
            handleRecalculatePreview();
            setIsNewDeadlineModalOpen(true);
          }
        }}
      />

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <DeadlinesTable
          loading={loading}
          deadlines={filteredDeadlines}
          canEdit={canEdit}
          expandedBreakdownId={expandedBreakdownId}
          onToggleBreakdown={(id) =>
            setExpandedBreakdownId(expandedBreakdownId === id ? null : id)
          }
          onConfirmDeadline={handleConfirmDeadline}
          onOpenExtend={(dl) => setExtendingDeadline(dl)}
          onCompleteDeadline={handleCompleteDeadline}
        />
      </div>

      <ExtendDeadlineModal
        deadline={extendingDeadline}
        onClose={() => setExtendingDeadline(null)}
        onSubmit={handleSaveExtension}
      />

      <NewDeadlineModal
        isOpen={isNewDeadlineModalOpen}
        onClose={() => setIsNewDeadlineModalOpen(false)}
        procedures={procedures}
        form={newDeadlineForm}
        setForm={setNewDeadlineForm}
        calculatedPreview={calculatedPreview}
        onRecalculatePreview={handleRecalculatePreview}
        onSubmit={handleCreateDeadline}
      />
    </div>
  );
};
