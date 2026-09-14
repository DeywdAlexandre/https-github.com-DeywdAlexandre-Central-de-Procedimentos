import React, { useState } from 'react';
import { DisciplinaryProcedure } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { getTodayDateBR } from '../lib/deadline-calculator.ts';
import { ProceduresFilters } from './procedures/ProceduresFilters.tsx';
import { ProceduresTable } from './procedures/ProceduresTable.tsx';
import { ProcedureDetailDrawer } from './procedures/ProcedureDetailDrawer.tsx';
import { CreateProcedureModal } from './procedures/modals/CreateProcedureModal.tsx';
import { AddTimelineModal } from './procedures/modals/AddTimelineModal.tsx';

interface ProceduresViewProps {
  procedures: DisciplinaryProcedure[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenNewDeadline?: (procedureId: number) => void;
  selectedProcedureId?: number | null;
  onSelectProcedure?: (id: number | null) => void;
  globalSearch?: string;
}

export const ProceduresView: React.FC<ProceduresViewProps> = ({
  procedures,
  loading,
  onRefresh,
  selectedProcedureId,
  onSelectProcedure,
  globalSearch = '',
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  // Filtros locais
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterPhase, setFilterPhase] = useState<string>('todos');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProc, setEditingProc] = useState<DisciplinaryProcedure | null>(null);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);

  // Formulário de Criação/Edição
  const [formData, setFormData] = useState({
    code: '',
    type: 'PDS' as 'PDS' | 'SINDICANCIA',
    seiNumber: '',
    seiUrl: '',
    ordinanceNumber: '',
    subject: '',
    responsible: '',
    startDate: getTodayDateBR(),
    startEvent: 'Publicação da Portaria em Boletim Geral',
    phase: 'Instauração',
    notes: '',
    initialDaysCount: '30',
    initialDaysType: 'corridos' as 'corridos' | 'uteis',
    initialExcludeStartDay: true,
    confirmImmediately: false,
  });

  // Formulário de Timeline
  const [timelineData, setTimelineData] = useState({
    actionDate: getTodayDateBR(),
    description: '',
    nextStep: '',
    seiDocumentRef: '',
  });

  // Procedimento detalhado
  const activeDetailProc = selectedProcedureId
    ? procedures.find((p) => p.id === selectedProcedureId) || null
    : null;

  const handleOpenCreate = () => {
    setEditingProc(null);
    setFormData({
      code: `PDS nº ${String(procedures.length + 1).padStart(3, '0')}/${new Date().getFullYear()}`,
      type: 'PDS',
      seiNumber: '',
      seiUrl: '',
      ordinanceNumber: '',
      subject: '',
      responsible: profile?.name || '',
      startDate: getTodayDateBR(),
      startEvent: 'Publicação da Portaria em Boletim Geral',
      phase: 'Instauração',
      notes: '',
      initialDaysCount: '30',
      initialDaysType: 'corridos',
      initialExcludeStartDay: true,
      confirmImmediately: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proc: DisciplinaryProcedure) => {
    setEditingProc(proc);
    setFormData({
      code: proc.code,
      type: proc.type,
      seiNumber: proc.seiNumber || '',
      seiUrl: proc.seiUrl || '',
      ordinanceNumber: proc.ordinanceNumber || '',
      subject: proc.subject,
      responsible: proc.responsible,
      startDate: proc.startDate,
      startEvent: proc.startEvent,
      phase: proc.phase,
      notes: proc.notes || '',
      initialDaysCount: '',
      initialDaysType: 'corridos',
      initialExcludeStartDay: true,
      confirmImmediately: false,
    });
    setIsModalOpen(true);
  };

  const handleSaveProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProc) {
        await apiRequest(`/api/procedures/${editingProc.id}`, token, {
          method: 'PUT',
          body: JSON.stringify({
            code: formData.code,
            type: formData.type,
            seiNumber: formData.seiNumber || null,
            seiUrl: formData.seiUrl || null,
            ordinanceNumber: formData.ordinanceNumber || null,
            subject: formData.subject,
            responsible: formData.responsible,
            phase: formData.phase,
            notes: formData.notes || null,
          }),
        });
      } else {
        await apiRequest('/api/procedures', token, {
          method: 'POST',
          body: JSON.stringify({
            code: formData.code,
            type: formData.type,
            seiNumber: formData.seiNumber || null,
            seiUrl: formData.seiUrl || null,
            ordinanceNumber: formData.ordinanceNumber || null,
            subject: formData.subject,
            responsible: formData.responsible,
            startDate: formData.startDate,
            startEvent: formData.startEvent,
            phase: formData.phase,
            notes: formData.notes || null,
            initialDeadline: formData.initialDaysCount
              ? {
                  title: 'Prazo Inicial de Conclusão dos Autos',
                  daysCount: formData.initialDaysCount,
                  daysType: formData.initialDaysType,
                  excludeStartDay: formData.initialExcludeStartDay,
                  confirmImmediately: formData.confirmImmediately,
                }
              : null,
          }),
        });
      }

      setIsModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao salvar procedimento: ${err.message}`);
    }
  };

  const handleToggleArchive = async (proc: DisciplinaryProcedure) => {
    const confirmMsg = proc.archived
      ? `Deseja desarquivar o procedimento ${proc.code}?`
      : `Deseja arquivar o procedimento ${proc.code}?`;
    if (!confirm(confirmMsg)) return;

    try {
      await apiRequest(`/api/procedures/${proc.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({
          ...proc,
          archived: !proc.archived,
        }),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  const handleAddTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailProc) return;
    try {
      await apiRequest(`/api/procedures/${activeDetailProc.id}/timeline`, token, {
        method: 'POST',
        body: JSON.stringify(timelineData),
      });
      setIsTimelineModalOpen(false);
      setTimelineData({
        actionDate: getTodayDateBR(),
        description: '',
        nextStep: '',
        seiDocumentRef: '',
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao adicionar andamento: ${err.message}`);
    }
  };

  // Filtragem
  const filteredProcedures = procedures.filter((p) => {
    if (!showArchived && p.archived) return false;
    if (filterType !== 'todos' && p.type !== filterType) return false;
    if (filterPhase !== 'todos' && p.phase !== filterPhase) return false;
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const match =
        p.code.toLowerCase().includes(term) ||
        (p.seiNumber && p.seiNumber.toLowerCase().includes(term)) ||
        p.subject.toLowerCase().includes(term) ||
        p.responsible.toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <ProceduresFilters
        filterType={filterType}
        setFilterType={setFilterType}
        filterPhase={filterPhase}
        setFilterPhase={setFilterPhase}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        canEdit={canEdit}
        onOpenCreate={handleOpenCreate}
      />

      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <ProceduresTable
          loading={loading}
          procedures={filteredProcedures}
          canEdit={canEdit}
          onSelectProcedure={onSelectProcedure}
          onOpenEdit={handleOpenEdit}
          onToggleArchive={handleToggleArchive}
        />
      </div>

      <ProcedureDetailDrawer
        procedure={activeDetailProc}
        onClose={() => onSelectProcedure && onSelectProcedure(null)}
        canEdit={canEdit}
        onOpenTimelineModal={() => setIsTimelineModalOpen(true)}
      />

      <CreateProcedureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProc={editingProc}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSaveProcedure}
      />

      <AddTimelineModal
        isOpen={isTimelineModalOpen}
        onClose={() => setIsTimelineModalOpen(false)}
        timelineData={timelineData}
        setTimelineData={setTimelineData}
        onSubmit={handleAddTimeline}
      />
    </div>
  );
};
