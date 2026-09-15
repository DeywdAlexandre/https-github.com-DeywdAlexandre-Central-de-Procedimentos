import React, { useState, useEffect } from 'react';
import { X, Shield, Send, Check } from 'lucide-react';
import { JudicialHearing, HearingOfficerLink } from '../../../types.ts';
import { formatDateBR } from '../../../lib/deadline-calculator.ts';
import { buildHearingWhatsAppMessage, openWhatsAppChat } from '../../../lib/whatsapp-messages.ts';

interface OfficerNoticeCardProps {
  ho: HearingOfficerLink;
  hearingNoticeNumber: string;
  hearingDate: string;
  hearingTime: string;
  court: string;
  location?: string | null;
  modality?: string | null;
  onUpdateNotice: (hearingOfficerId: number, patch: Record<string, any>) => Promise<void>;
}

const OfficerNoticeCard: React.FC<OfficerNoticeCardProps> = ({
  ho,
  hearingNoticeNumber,
  hearingDate,
  hearingTime,
  court,
  location,
  modality,
  onUpdateNotice,
}) => {
  const [noticeNum, setNoticeNum] = useState(ho.officialNoticeNumber || '');
  const [seiNum, setSeiNum] = useState(ho.officialNoticeSei || '');
  const [savedSei, setSavedSei] = useState(false);
  const [savedNoticeNum, setSavedNoticeNum] = useState(false);

  useEffect(() => {
    setNoticeNum(ho.officialNoticeNumber || '');
    setSeiNum(ho.officialNoticeSei || '');
  }, [ho.officialNoticeNumber, ho.officialNoticeSei]);

  const handleSaveSei = async () => {
    const clean = seiNum.trim();
    if (clean === (ho.officialNoticeSei || '')) return;
    await onUpdateNotice(ho.id, { officialNoticeSei: clean });
    setSavedSei(true);
    setTimeout(() => setSavedSei(false), 2000);
  };

  const handleSaveNoticeNum = async () => {
    const clean = noticeNum.trim();
    if (clean === (ho.officialNoticeNumber || '')) return;
    await onUpdateNotice(ho.id, { officialNoticeNumber: clean });
    setSavedNoticeNum(true);
    setTimeout(() => setSavedNoticeNum(false), 2000);
  };

  const isSigned = Boolean(ho.signedAt) || ho.noticeStatus === 'assinado';
  const isAcknowledged =
    Boolean(ho.acknowledgedAt) || ho.noticeStatus === 'ciencia_registrada';
  const isTermReceived =
    Boolean(ho.attendanceTermReceivedAt) || ho.noticeStatus === 'termo_recebido';

  const handleToggleSigned = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    onUpdateNotice(ho.id, {
      signed: nextVal,
      noticeStatus: nextVal ? 'assinado' : 'pendente',
    });
  };

  const handleToggleAcknowledged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    onUpdateNotice(ho.id, {
      acknowledged: nextVal,
      noticeStatus: nextVal ? 'ciencia_registrada' : isSigned ? 'assinado' : 'pendente',
    });
  };

  const handleToggleTerm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.checked;
    onUpdateNotice(ho.id, {
      attendanceTermReceived: nextVal,
      noticeStatus: nextVal
        ? 'termo_recebido'
        : isAcknowledged
        ? 'ciencia_registrada'
        : isSigned
        ? 'assinado'
        : 'pendente',
    });
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
      {/* Topo do Card do Policial */}
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
                  processNumber: hearingNoticeNumber,
                  hearingDate: hearingDate,
                  hearingTime: hearingTime,
                  court: court,
                  location: location,
                  modality: modality,
                  officialNoticeNumber: ho.officialNoticeNumber,
                });
                openWhatsAppChat(ho.officerPhone, msg);
              }}
              className="btn-3d-emerald px-2.5 py-1 text-[11px] rounded-md"
              title="Enviar aviso de audiência pelo WhatsApp"
            >
              <Send className="w-3 h-3" />
              <span>Enviar WhatsApp</span>
            </button>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              ho.noticeStatus === 'termo_recebido'
                ? 'bg-emerald-100 text-emerald-800'
                : ho.noticeStatus === 'ciencia_registrada'
                ? 'bg-blue-100 text-blue-800'
                : ho.noticeStatus === 'assinado'
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {ho.noticeStatus.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Inputs com Salvamento Automático e Indicador "Salvo ✓" */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-600 font-semibold">Nº Ofício de Apresentação:</label>
            {savedNoticeNum && (
              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 animate-in fade-in">
                <Check className="w-3 h-3" /> Salvo
              </span>
            )}
          </div>
          <input
            type="text"
            value={noticeNum}
            onChange={(e) => setNoticeNum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveNoticeNum();
              }
            }}
            onBlur={handleSaveNoticeNum}
            placeholder="Ex.: 92466419 (Enter para salvar)"
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-600 font-semibold">Nº Documento SEI:</label>
            {savedSei && (
              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 animate-in fade-in">
                <Check className="w-3 h-3" /> Salvo
              </span>
            )}
          </div>
          <input
            type="text"
            value={seiNum}
            onChange={(e) => setSeiNum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveSei();
              }
            }}
            onBlur={handleSaveSei}
            placeholder="Ex.: 12345678 (Enter para salvar)"
            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* Checkboxes de Confirmação Formal com Resposta Instantânea */}
      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-2 cursor-pointer font-semibold select-none p-1 rounded hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={isSigned}
            onChange={handleToggleSigned}
            className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
          />
          <span className={isSigned ? 'text-blue-900 font-bold' : 'text-slate-700'}>
            Assinado pelo Comandante
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer font-semibold select-none p-1 rounded hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={isAcknowledged}
            onChange={handleToggleAcknowledged}
            className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
          />
          <span className={isAcknowledged ? 'text-blue-900 font-bold' : 'text-slate-700'}>
            Ciência do Policial Confirmada
          </span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer font-semibold select-none p-1 rounded hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={isTermReceived}
            onChange={handleToggleTerm}
            className="rounded-sm text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
          />
          <span className={isTermReceived ? 'text-emerald-900 font-bold' : 'text-slate-700'}>
            Termo de Comparecimento Recebido (Pós)
          </span>
        </label>
      </div>
    </div>
  );
};

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
        {/* Cabeçalho */}
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
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 text-xs">
            Atenção: Não presumir ciência ou assinatura pelo envio de mensagem. Marque cada
            etapa somente após confirmação expressa do policial ou documento físico/SEI assinado.
          </div>

          <div className="space-y-3">
            {(hearing.officers || []).map((ho) => (
              <OfficerNoticeCard
                key={ho.id}
                ho={ho}
                hearingNoticeNumber={hearing.noticeNumber}
                hearingDate={hearing.hearingDate}
                hearingTime={hearing.hearingTime}
                court={hearing.court}
                location={hearing.location}
                modality={hearing.modality}
                onUpdateNotice={onUpdateNotice}
              />
            ))}
          </div>
        </div>

        {/* Rodapé */}
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
