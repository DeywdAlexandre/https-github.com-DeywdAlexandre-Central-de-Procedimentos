import React, { useState } from 'react';
import {
  FileCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  ExternalLink,
  Calendar,
  Check,
  FileSignature,
  FileText,
  UserCheck,
  Send,
  Phone,
} from 'lucide-react';
import { JudicialHearing, PoliceOfficer } from '../types.ts';
import { formatDateBR, getTodayDateBR } from '../lib/deadline-calculator.ts';
import { buildHearingWhatsAppMessage, openWhatsAppChat } from '../lib/whatsapp-messages.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface OfficialNoticesViewProps {
  hearings: JudicialHearing[];
  officers: PoliceOfficer[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  globalSearch?: string;
  onOpenOfficialNoticeImport?: () => void;
}

export const OfficialNoticesView: React.FC<OfficialNoticesViewProps> = ({
  hearings,
  officers,
  loading,
  onRefresh,
  globalSearch = '',
  onOpenOfficialNoticeImport,
}) => {
  const { profile, token } = useAuth();
  const canEdit = profile?.role === 'editor' || profile?.role === 'administrador';

  const [filterStatus, setFilterStatus] = useState<string>('pendentes_geral');

  // Flatten all hearing-officer links
  interface FlattenedNotice {
    linkId: number;
    hearingId: number;
    noticeNumber: string;
    hearingDate: string;
    hearingTime: string;
    court: string;
    modality?: 'presencial' | 'remota' | string;
    location?: string | null;
    hearingStatus: string;
    officerId: number;
    officerFullName: string;
    officerRank: string;
    officerBadge?: string | null;
    officerPhone?: string | null;
    officialNoticeNumber?: string | null;
    officialNoticeSei?: string | null;
    noticeStatus: string;
    signedAt?: string | null;
    acknowledgedAt?: string | null;
    attendanceTermReceivedAt?: string | null;
    notes?: string | null;
    hearingNotes?: string | null;
  }

  const allNotices: FlattenedNotice[] = [];
  hearings.forEach((h) => {
    (h.officers || []).forEach((ho) => {
      // Tentar obter o telefone do policial pelo cadastro de oficiais se não estiver no link
      const officerObj = officers.find((o) => o.id === ho.officerId);
      const phone = ho.officerPhone || officerObj?.phone || null;

      allNotices.push({
        linkId: ho.id,
        hearingId: h.id,
        noticeNumber: h.noticeNumber,
        hearingDate: h.hearingDate,
        hearingTime: h.hearingTime,
        court: h.court,
        modality: h.modality,
        location: h.location,
        hearingStatus: h.status,
        officerId: ho.officerId,
        officerFullName: ho.officerFullName,
        officerRank: ho.officerRank,
        officerBadge: ho.officerBadge,
        officerPhone: phone,
        officialNoticeNumber: ho.officialNoticeNumber,
        officialNoticeSei: ho.officialNoticeSei,
        noticeStatus: ho.noticeStatus,
        signedAt: ho.signedAt,
        acknowledgedAt: ho.acknowledgedAt,
        attendanceTermReceivedAt: ho.attendanceTermReceivedAt,
        notes: ho.notes,
        hearingNotes: h.notes,
      });
    });
  });

  const handleUpdateNotice = async (linkId: number, patch: Record<string, any>) => {
    try {
      await apiRequest(`/api/hearings/officers/${linkId}/notice`, token, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      await onRefresh();
    } catch (err: any) {
      alert(`Erro ao atualizar ofício: ${err.message}`);
    }
  };

  const today = getTodayDateBR();

  const filteredNotices = allNotices.filter((n) => {
    if (filterStatus === 'pendentes_geral') {
      return (
        n.noticeStatus === 'pendente' ||
        n.noticeStatus === 'aguardando_assinatura' ||
        !n.acknowledgedAt
      );
    }
    if (filterStatus === 'aguardando_assinatura') {
      return n.noticeStatus === 'aguardando_assinatura' || !n.signedAt;
    }
    if (filterStatus === 'aguardando_ciencia') {
      return !n.acknowledgedAt && n.noticeStatus !== 'ciencia_registrada';
    }
    if (filterStatus === 'aguardando_termo') {
      const termWaived =
        (n.hearingNotes && n.hearingNotes.includes('[Termo dispensado/não emitido pela vara]')) ||
        (n.notes && n.notes.includes('[Termo dispensado/não emitido pelo juízo]'));
      return n.hearingDate < today && !n.attendanceTermReceivedAt && !termWaived && n.hearingStatus !== 'nao_ocorreu' && n.hearingStatus !== 'cancelada';
    }
    if (filterStatus !== 'todos' && n.noticeStatus !== filterStatus) {
      return false;
    }

    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      const num = (n.noticeNumber || '').toLowerCase();
      const ofNum = (n.officialNoticeNumber || '').toLowerCase();
      const sei = (n.officialNoticeSei || '').toLowerCase();
      const off = (n.officerFullName || '').toLowerCase();
      if (
        !num.includes(term) &&
        !ofNum.includes(term) &&
        !sei.includes(term) &&
        !off.includes(term)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Controles e Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterStatus('pendentes_geral')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'pendentes_geral'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Pendências Gerais
          </button>
          <button
            onClick={() => setFilterStatus('aguardando_assinatura')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'aguardando_assinatura'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Aguardando Assinatura
          </button>
          <button
            onClick={() => setFilterStatus('aguardando_ciencia')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'aguardando_ciencia'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Ciência Pendente
          </button>
          <button
            onClick={() => setFilterStatus('aguardando_termo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'aguardando_termo'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Falta Termo Comparecimento
          </button>
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === 'todos'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({allNotices.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">
            Total: <strong className="text-slate-800">{filteredNotices.length}</strong> ofícios
          </span>

          {canEdit && onOpenOfficialNoticeImport && (
            <button
              id="btn-import-notice-from-notices-tab"
              onClick={onOpenOfficialNoticeImport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg shadow-2xs transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Importar do Ofício</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista de Ofícios */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Carregando ofícios...</div>
        ) : filteredNotices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-2">
            <FileCheck className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-700 text-sm">
              Nenhum ofício pendente no filtro selecionado
            </p>
            <p className="text-xs text-slate-400">
              Todas as etapas de apresentação registradas estão em dia.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotices.map((n) => {
              const isPast = n.hearingDate < today;
              const termWaived =
                (n.hearingNotes && n.hearingNotes.includes('[Termo dispensado/não emitido pela vara]')) ||
                (n.notes && n.notes.includes('[Termo dispensado/não emitido pelo juízo]'));
              const missingTerm = isPast && !n.attendanceTermReceivedAt && !termWaived && n.hearingStatus !== 'nao_ocorreu' && n.hearingStatus !== 'cancelada';
              const missingSign = !n.signedAt;
              const missingAck = !n.acknowledgedAt;

              return (
                <div
                  key={n.linkId}
                  id={`notice-row-${n.linkId}`}
                  className="p-4 sm:p-5 hover:bg-slate-50/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900">
                        Ofício {n.officialNoticeNumber || n.noticeNumber}
                      </span>
                      {n.officialNoticeSei && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-100 text-slate-700">
                          SEI: {n.officialNoticeSei}
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-900">
                        {n.officerRank} {n.officerFullName}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      Audiência agendada para{' '}
                      <strong className="text-slate-900">
                        {formatDateBR(n.hearingDate)} às {n.hearingTime}
                      </strong>{' '}
                      na <span className="italic">{n.court}</span>
                    </p>

                    {/* Alertas de etapas pendentes */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {missingSign && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          <FileSignature className="w-3 h-3 text-amber-600" />
                          Aguardando Assinatura do Comandante
                        </span>
                      )}
                      {missingAck && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          Ciência do Policial Pendente
                        </span>
                      )}
                      {missingTerm && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          Audiência já realizada: Falta Termo de Comparecimento
                        </span>
                      )}
                      {termWaived && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Realizada (Termo dispensado/não emitido pela vara)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações de Confirmação Rápida */}
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0 self-end lg:self-center">
                      {n.officerPhone && (
                        <button
                          onClick={() => {
                            const msg = buildHearingWhatsAppMessage({
                              officerRank: n.officerRank,
                              officerName: n.officerFullName,
                              processNumber: n.noticeNumber,
                              hearingDate: n.hearingDate,
                              hearingTime: n.hearingTime,
                              court: n.court,
                              location: n.location,
                              modality: n.modality,
                              officialNoticeNumber: n.officialNoticeNumber,
                            });
                            openWhatsAppChat(n.officerPhone, msg);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                          title="Abrir WhatsApp com processo, data, hora, vara e link"
                        >
                          <Send className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp</span>
                        </button>
                      )}

                      {!n.signedAt && (
                        <button
                          onClick={() =>
                            handleUpdateNotice(n.linkId, {
                              signed: true,
                              noticeStatus: 'assinado',
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Registrar Assinatura</span>
                        </button>
                      )}

                      {!n.acknowledgedAt && (
                        <button
                          onClick={() =>
                            handleUpdateNotice(n.linkId, {
                              acknowledged: true,
                              noticeStatus: 'ciencia_registrada',
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Registrar Ciência</span>
                        </button>
                      )}

                      {!n.attendanceTermReceivedAt && (
                        <button
                          onClick={() =>
                            handleUpdateNotice(n.linkId, {
                              attendanceTermReceived: true,
                              noticeStatus: 'termo_recebido',
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Registrar Termo</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
