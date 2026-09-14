import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { JudicialHearing } from '../../../types.ts';

interface RescheduleHearingModalProps {
  hearing: JudicialHearing | null;
  onClose: () => void;
  onSubmit: (hearingId: number, data: { newDate: string; newTime: string; reason: string }) => Promise<void>;
}

export const RescheduleHearingModal: React.FC<RescheduleHearingModalProps> = ({
  hearing,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState({
    newDate: '',
    newTime: '09:00',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (hearing) {
      setForm({
        newDate: hearing.hearingDate,
        newTime: hearing.hearingTime,
        reason: '',
      });
    }
  }, [hearing]);

  if (!hearing) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(hearing.id, form);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Remarcar Audiência Judicial</h4>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
            A remarcação invalidará lembretes anteriores pendentes e registrará o histórico
            formal de alterações com seu usuário.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nova Data *</label>
              <input
                type="date"
                required
                value={form.newDate}
                onChange={(e) => setForm({ ...form, newDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Novo Horário *</label>
              <input
                type="time"
                required
                value={form.newTime}
                onChange={(e) => setForm({ ...form, newTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Motivo da Remarcação *
            </label>
            <textarea
              required
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Informe o despacho, ofício de redesignação ou solicitação..."
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
              className="btn-3d-amber px-4 py-1.5 rounded-lg text-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Salvar Remarcação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
