import React, { useState } from 'react';
import { X } from 'lucide-react';
import { JudicialHearing } from '../../../types.ts';

interface DidNotOccurModalProps {
  hearing: JudicialHearing | null;
  onClose: () => void;
  onSubmit: (hearingId: number, reason: string) => Promise<void>;
}

export const DidNotOccurModal: React.FC<DidNotOccurModalProps> = ({
  hearing,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!hearing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(hearing.id, reason);
      setReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">
            Registrar que a Audiência Não Ocorreu
          </h4>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Motivo pelo qual a audiência não se realizou *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: Ausência do magistrado, greve, testemunha ausente, pedido do MP..."
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
              className="btn-3d-danger px-4 py-1.5 rounded-lg text-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Gravando...' : 'Gravar Ocorrência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
