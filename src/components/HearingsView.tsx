import React, { useState } from 'react';
import { JudicialHearing, PoliceOfficer } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { HearingsFilters } from './hearings/HearingsFilters.tsx';
import { HearingsTable } from './hearings/HearingsTable.tsx';
import { HearingsCalendar } from './hearings/HearingsCalendar.tsx';
import { CreateHearingModal } from './hearings/modals/CreateHearingModal.tsx';
import { RescheduleHearingModal } from './hearings/modals/RescheduleHearingModal.tsx';
import { DidNotOccurModal } from './hearings/modals/DidNotOccurModal.tsx';
import { CompleteWithoutTermModal } from './hearings/modals/CompleteWithoutTermModal.tsx';
import { DeleteHearingModal } from './hearings/modals/DeleteHearingModal.tsx';
import { HearingNoticeModal } from './hearings/modals/HearingNoticeModal.tsx';

interface HearingsViewProps {
  hearings: JudicialHearing[];
  officers: PoliceOfficer[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
  onOpenOfficialNoticeImport?: () => void;
  onOpenBatchImport?: () => void;
}

export const HearingsView: React.FC<HearingsViewProps> = ({
  hearings,
  officers,
  loading,
  onRefresh,
  globalSearch = '',
  onOpenOfficialNoticeImport,
  onOpenBatchImport,
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  // Visão: Tabela vs Calendário
  const [viewMode, setViewMode] = useState<'tabela' | 'calendario'>('tabela');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Filtros
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [officerFilter, setOfficerFilter] = useState<string>('todos');

  // Modais de Controle
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reschedulingHearing, setReschedulingHearing] = useState<JudicialHearing | null>(null);
  const [didNotOccurHearing, setDidNotOccurHearing] = useState<JudicialHearing | null>(null);
  const [completeWithoutTermHearing, setCompleteWithoutTermHearing] = useState<JudicialHearing | null>(null);
  const [deletingHearing, setDeletingHearing] = useState<JudicialHearing | null>(null);
  const [managingOfficersHearing, setManagingOfficersHearing] = useState<JudicialHearing | null>(null);

  // Ações de API
  const handleCreateHearing = async (formData: any) => {
    try {
      await apiRequest('/api/hearings', token, {
        method: 'POST',
        body: JSON.stringify({
          noticeNumber: formData.noticeNumber,
          seiNumber: formData.seiNumber || null,
          hearingDate: formData.hearingDate,
          hearingTime: formData.hearingTime,
          court: formData.court,
          modality: formData.modality,
          location: formData.location || null,
          notes: formData.notes || null,
          officers: formData.selectedOfficerIds.map((id: number) => ({
            officerId: id,
            officialNoticeNumber: formData.noticeNumber,
            noticeStatus: 'pendente',
          })),
        }),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao agendar audiência: ${err.message}`);
      throw err;
    }
  };

  const handleReschedule = async (
    hearingId: number,
    data: { newDate: string; newTime: string; reason: string }
  ) => {
    try {
      await apiRequest(`/api/hearings/${hearingId}/reschedule`, token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao remarcar audiência: ${err.message}`);
      throw err;
    }
  };

  const handleSaveDidNotOccur = async (hearingId: number, reason: string) => {
    try {
      await apiRequest(`/api/hearings/${hearingId}/did-not-occur`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao registrar ocorrência: ${err.message}`);
      throw err;
    }
  };

  const handleSaveCompleteWithoutTerm = async (hearingId: number, note: string) => {
    try {
      await apiRequest(`/api/hearings/${hearingId}/complete-without-term`, token, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao marcar audiência como realizada: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteHearing = async (hearingId: number) => {
    try {
      await apiRequest(`/api/hearings/${hearingId}`, token, {
        method: 'DELETE',
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao excluir audiência: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateOfficerNotice = async (
    hearingOfficerId: number,
    patch: Record<string, any>
  ) => {
    try {
      await apiRequest(`/api/hearings/officers/${hearingOfficerId}/notice`, token, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      await onRefresh();
      if (managingOfficersHearing) {
        const updatedH = hearings.find((h) => h.id === managingOfficersHearing.id);
        if (updatedH) setManagingOfficersHearing(updatedH);
      }
    } catch (err: any) {
      alert(`Erro ao atualizar status do ofício: ${err.message}`);
    }
  };

  // Filtragem
  const filteredHearings = hearings.filter((h) => {
    if (statusFilter !== 'todos' && h.status !== statusFilter) return false;
    if (officerFilter !== 'todos') {
      const oid = Number(officerFilter);
      if (!(h.officers || []).some((o) => o.officerId === oid)) return false;
    }
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const num = (h.noticeNumber || '').toLowerCase();
      const court = (h.court || '').toLowerCase();
      const offMatch = (h.officers || []).some((o) =>
        o.officerFullName.toLowerCase().includes(term)
      );
      if (!num.includes(term) && !court.includes(term) && !offMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <HearingsFilters
        viewMode={viewMode}
        setViewMode={setViewMode}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        officerFilter={officerFilter}
        setOfficerFilter={setOfficerFilter}
        officers={officers}
        filteredHearings={filteredHearings}
        canEdit={canEdit}
        onOpenNewHearing={() => setIsCreateModalOpen(true)}
        onOpenOfficialNoticeImport={onOpenOfficialNoticeImport}
        onOpenBatchImport={onOpenBatchImport}
      />

      {viewMode === 'calendario' && (
        <HearingsCalendar
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          setSelectedYear={setSelectedYear}
          setSelectedMonth={setSelectedMonth}
          filteredHearings={filteredHearings}
          onSelectHearing={(h) => setManagingOfficersHearing(h)}
        />
      )}

      {viewMode === 'tabela' && (
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <HearingsTable
            loading={loading}
            hearings={filteredHearings}
            canEdit={canEdit}
            onManageOfficers={(h) => setManagingOfficersHearing(h)}
            onReschedule={(h) => setReschedulingHearing(h)}
            onCompleteWithoutTerm={(h) => setCompleteWithoutTermHearing(h)}
            onDidNotOccur={(h) => setDidNotOccurHearing(h)}
            onDelete={(h) => setDeletingHearing(h)}
          />
        </div>
      )}

      <CreateHearingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        officers={officers}
        onSubmit={handleCreateHearing}
      />

      <RescheduleHearingModal
        hearing={reschedulingHearing}
        onClose={() => setReschedulingHearing(null)}
        onSubmit={handleReschedule}
      />

      <DidNotOccurModal
        hearing={didNotOccurHearing}
        onClose={() => setDidNotOccurHearing(null)}
        onSubmit={handleSaveDidNotOccur}
      />

      <CompleteWithoutTermModal
        hearing={completeWithoutTermHearing}
        onClose={() => setCompleteWithoutTermHearing(null)}
        onSubmit={handleSaveCompleteWithoutTerm}
      />

      <DeleteHearingModal
        hearing={deletingHearing}
        onClose={() => setDeletingHearing(null)}
        onConfirm={handleDeleteHearing}
      />

      <HearingNoticeModal
        hearing={managingOfficersHearing}
        onClose={() => setManagingOfficersHearing(null)}
        onUpdateNotice={handleUpdateOfficerNotice}
      />
    </div>
  );
};
