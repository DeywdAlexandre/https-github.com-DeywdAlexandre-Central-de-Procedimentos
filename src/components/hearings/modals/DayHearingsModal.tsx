import React from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Video,
  Shield,
  FileCheck,
  Send,
  ExternalLink,
} from 'lucide-react';
import { JudicialHearing } from '../../../types.ts';
import { formatDateBR } from '../../../lib/deadline-calculator.ts';
import { buildHearingWhatsAppMessage, openWhatsAppChat } from '../../../lib/whatsapp-messages.ts';

interface DayHearingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string | null;
  hearings: JudicialHearing[];
  onSelectHearing: (hearing: JudicialHearing) => void;
}

export const DayHearingsModal: React.FC<DayHearingsModalProps> = ({
  isOpen,
  onClose,
  dateStr,
  hearings,
  onSelectHearing,
}) => {
  if (!isOpen || !dateStr) return null;

  // Formata o cabeçalho da data em português
  const parts = dateStr.split('-');
  const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const fullDateFormatted = dateObj.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 capitalize">
                {fullDateFormatted}
              </h3>
              <p className="text-xs text-slate-500">
                {hearings.length === 1
                  ? '1 audiência agendada neste dia'
                  : `${hearings.length} audiências agendadas neste dia`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de Audiências do Dia */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 divide-y divide-slate-100">
          {hearings.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic">
              Nenhuma audiência registrada para esta data.
            </div>
          ) : (
            hearings.map((h, idx) => {
              const officersList = h.officers || [];

              return (
                <div
                  key={h.id}
                  className={`space-y-3 ${idx > 0 ? 'pt-4' : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-2xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{h.hearingTime}</span>
                      </span>

                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800">
                        Ofício {h.noticeNumber}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          h.status === 'agendada'
                            ? 'bg-blue-100 text-blue-800'
                            : h.status === 'remarcada'
                            ? 'bg-amber-100 text-amber-800'
                            : h.status === 'realizada'
                            ? 'bg-emerald-100 text-emerald-800'
                            : h.status === 'nao_ocorreu'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {h.status === 'nao_ocorreu' ? 'Não Ocorreu' : h.status}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        onClose();
                        onSelectHearing(h);
                      }}
                      className="btn-3d-indigo px-3 py-1 rounded-lg text-xs"
                      title="Gerenciar ofícios, assinaturas e ciência dos policiais desta audiência"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Ofícios & Ciência</span>
                    </button>
                  </div>

                  {/* Informações da Vara / Localização */}
                  <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-slate-900 text-sm">{h.court}</h4>
                    {h.location && (
                      <p className="text-slate-600 flex items-center gap-1.5">
                        {h.modality === 'remota' ? (
                          <Video className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate">{h.location}</span>
                      </p>
                    )}
                  </div>

                  {/* Policiais Convocados */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-2">
                    <span className="font-bold text-slate-700 block">
                      Policiais Militares Requisitados ({officersList.length}):
                    </span>

                    {officersList.length === 0 ? (
                      <p className="text-slate-400 italic text-[11px]">
                        Nenhum policial vinculado a esta audiência.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {officersList.map((ho) => (
                          <div
                            key={ho.id}
                            className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1 text-slate-900 font-semibold truncate">
                                <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span className="truncate">
                                  {ho.officerRank} {ho.officerFullName}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] font-bold block mt-0.5 ${
                                  ho.noticeStatus === 'termo_recebido'
                                    ? 'text-emerald-700'
                                    : ho.noticeStatus === 'ciencia_registrada'
                                    ? 'text-blue-700'
                                    : ho.noticeStatus === 'assinado'
                                    ? 'text-indigo-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {ho.noticeStatus === 'termo_recebido'
                                  ? '✓ Termo Recebido'
                                  : ho.noticeStatus === 'ciencia_registrada'
                                  ? '✓ Ciência Registrada'
                                  : ho.noticeStatus === 'assinado'
                                  ? '✓ Assinado Comandante'
                                  : '⏳ Aguardando Ciência'}
                              </span>
                            </div>

                            {ho.officerPhone && (
                              <button
                                type="button"
                                onClick={() => {
                                  const msg = buildHearingWhatsAppMessage({
                                    officerRank: ho.officerRank,
                                    officerName: ho.officerFullName,
                                    processNumber: h.noticeNumber,
                                    hearingDate: h.hearingDate,
                                    hearingTime: h.hearingTime,
                                    court: h.court,
                                    location: h.location,
                                    modality: h.modality,
                                    officialNoticeNumber: ho.officialNoticeNumber || h.noticeNumber,
                                  });
                                  openWhatsAppChat(ho.officerPhone, msg);
                                }}
                                className="btn-3d-emerald px-2 py-1 rounded-md text-[11px] shrink-0"
                                title="Enviar notificação por WhatsApp"
                              >
                                <Send className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn-3d-secondary px-4 py-1.5 rounded-lg text-xs"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
