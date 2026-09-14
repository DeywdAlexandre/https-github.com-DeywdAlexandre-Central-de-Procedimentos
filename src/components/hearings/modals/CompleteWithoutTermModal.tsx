import React, { useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { JudicialHearing } from '../../../types.ts';
import { formatDateBR } from '../../../lib/deadline-calculator.ts';

interface CompleteWithoutTermModalProps {
  hearing: JudicialHearing | null;
  onClose: () => void;
  onSubmit: (hearingId: number, note: string) => Promise<void>;
}

export const CompleteWithoutTermModal: React.FC<CompleteWithoutTermModalProps> = ({
  hearing,
  onClose,
  onSubmit,
}) => {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!hearing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(hearing.id, note);
      setNote('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-emerald-100 bg-emerald-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Marcar Audiência como Realizada</span>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs text-slate-700">
          <p>
            Deseja confirmar que a audiência referente ao processo/ofício{' '}
            <strong className="text-slate-900">{hearing.noticeNumber}</strong> foi{' '}
            <strong>efetivamente realizada</strong> mesmo sem o termo de comparecimento fornecido pela vara?
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div>
              <strong className="text-slate-900">Data / Hora:</strong>{' '}
              {formatDateBR(hearing.hearingDate)} às {hearing.hearingTime}
            </div>
            <div>
              <strong className="text-slate-900">Vara / Órgão:</strong> {hearing.court}
            </div>
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] leading-relaxed">
            <strong>Atenção:</strong> O status da audiência mudará para <strong>"Realizada"</strong> e o alerta de
            cobrança do termo de comparecimento será dispensado no painel.
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Observação Interna (Opcional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Juizado não emitiu certidão; confirmado verbalmente com o policial"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-3d-secondary px-3.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-3d-emerald px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Salvando...' : 'Confirmar Realização'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
