import React from 'react';
import { X, Shield, Send } from 'lucide-react';
import { JudicialHearing } from '../../../types.ts';
import { formatDateBR } from '../../../lib/deadline-calculator.ts';
import { buildHearingWhatsAppMessage, openWhatsAppChat } from '../../../lib/whatsapp-messages.ts';

interface HearingNoticeModalProps {
  hearing: JudicialHearing | null;
  onClose: () => void;
  onUpdateNotice: (hearingOfficerId: number, patch: Record<string, any>) => Promise<void>;
}

export const HearingNoticeModal: React.FC<HearingNoticeModalProps> = ({
  hearing,
  onClose,
  onUpdateNotice,
}) => {
  if (!hearing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Gestão de Ofícios e Ciência - {hearing.noticeNumber}
            </h4>
            <p className="text-xs text-slate-500">
              Data: {formatDateBR(hearing.hearingDate)} às {hearing.hearingTime}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 text-xs">
            Atenção: Não presumir ciência ou assinatura pelo envio de mensagem. Marque cada
            etapa somente após confirmação expressa do policial ou documento físico/SEI assinado.
          </div>

          <div className="space-y-3">
            {(hearing.officers || []).map((ho) => (
              <div
                key={ho.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900 text-sm">
                      {ho.officerRank} {ho.officerFullName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ho.officerPhone && (
                      <button
                        type="button"
                        onClick={() => {
                          const msg = buildHearingWhatsAppMessage({
                            officerRank: ho.officerRank,
                            officerName: ho.officerFullName,
                            processNumber: hearing.noticeNumber,
                            hearingDate: hearing.hearingDate,
                            hearingTime: hearing.hearingTime,
                            court: hearing.court,
                            location: hearing.location,
                            modality: hearing.modality,
                            officialNoticeNumber: ho.officialNoticeNumber,
                          });
                          openWhatsAppChat(ho.officerPhone, msg);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 rounded-md border border-emerald-300 transition-colors"
                        title="Enviar aviso de audiência pelo WhatsApp"
                      >
                        <Send className="w-3 h-3 text-emerald-700" />
                        <span>Enviar WhatsApp</span>
                      </button>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                      {ho.noticeStatus.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Nº Ofício de Apresentação:</span>
                    <input
                      type="text"
                      defaultValue={ho.officialNoticeNumber || ''}
                      onBlur={(e) =>
                        onUpdateNotice(ho.id, {
                          officialNoticeNumber: e.target.value,
                        })
                      }
                      placeholder="Ex.: 92466419"
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nº Documento SEI:</span>
                    <input
                      type="text"
                      defaultValue={ho.officialNoticeSei || ''}
                      onBlur={(e) =>
                        onUpdateNotice(ho.id, {
                          officialNoticeSei: e.target.value,
                        })
                      }
                      placeholder="Ex.: 12345678"
                      className="w-full px-2 py-1 bg-white border border-slate-300 rounded-md text-xs mt-0.5"
                    />
                  </div>
                </div>

                {/* Checkboxes de Confirmação Formal */}
                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={Boolean(ho.signedAt) || ho.noticeStatus === 'assinado'}
                      onChange={(e) =>
                        onUpdateNotice(ho.id, {
                          signed: e.target.checked,
                          noticeStatus: e.target.checked ? 'assinado' : 'pendente',
                        })
                      }
                      className="rounded-sm text-blue-600"
                    />
                    <span>Assinado pelo Comandante</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={
                        Boolean(ho.acknowledgedAt) ||
                        ho.noticeStatus === 'ciencia_registrada'
                      }
                      onChange={(e) =>
                        onUpdateNotice(ho.id, {
                          acknowledged: e.target.checked,
                          noticeStatus: e.target.checked
                            ? 'ciencia_registrada'
                            : 'assinado',
                        })
                      }
                      className="rounded-sm text-blue-600"
                    />
                    <span>Ciência do Policial Confirmada</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={
                        Boolean(ho.attendanceTermReceivedAt) ||
                        ho.noticeStatus === 'termo_recebido'
                      }
                      onChange={(e) =>
                        onUpdateNotice(ho.id, {
                          attendanceTermReceived: e.target.checked,
                          noticeStatus: e.target.checked
                            ? 'termo_recebido'
                            : 'ciencia_registrada',
                        })
                      }
                      className="rounded-sm text-emerald-600"
                    />
                    <span>Termo de Comparecimento Recebido (Pós)</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="btn-3d-primary px-5 py-2 rounded-lg text-xs"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
