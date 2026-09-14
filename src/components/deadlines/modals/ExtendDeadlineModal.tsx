import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ProcedureDeadline } from '../../../types.ts';

interface ExtendDeadlineModalProps {
  deadline: ProcedureDeadline | null;
  onClose: () => void;
  onSubmit: (deadlineId: number, data: {
    type: 'prorrogacao' | 'suspensao' | 'reabertura';
    newDate: string;
    legalBasis: string;
    reason: string;
  }) => Promise<void>;
}

export const ExtendDeadlineModal: React.FC<ExtendDeadlineModalProps> = ({
  deadline,
  onClose,
  onSubmit,
}) => {
  const [form, setForm] = useState({
    type: 'prorrogacao' as 'prorrogacao' | 'suspensao' | 'reabertura',
    newDate: '',
    legalBasis: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (deadline) {
      const targetDate = deadline.confirmedEndDate || deadline.calculatedEndDate;
      setForm({
        type: 'prorrogacao',
        newDate: targetDate,
        legalBasis: '',
        reason: '',
      });
    }
  }, [deadline]);

  if (!deadline) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(deadline.id, form);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Alteração Formal de Prazo</h4>
            <p className="text-xs text-slate-500">{deadline.title}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
            A data original não será sobrescrita. Esta alteração será gravada
            permanentemente na trilha de auditoria com sua identificação e fundamento.
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipo de Ação *</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type: e.target.value as 'prorrogacao' | 'suspensao' | 'reabertura',
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-xs"
            >
              <option value="prorrogacao">Prorrogação de Prazo</option>
              <option value="suspensao">Suspensão de Prazo</option>
              <option value="reabertura">Reabertura de Prazo</option>
            </select>
          </div>

          {form.type !== 'suspensao' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nova Data Final Proposta *
              </label>
              <input
                type="date"
                required
                value={form.newDate}
                onChange={(e) => setForm({ ...form, newDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Fundamento Legal / Portaria / Despacho *
            </label>
            <input
              type="text"
              required
              value={form.legalBasis}
              onChange={(e) => setForm({ ...form, legalBasis: e.target.value })}
              placeholder="Ex.: Art. X da Portaria do Comando Geral nº..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Motivo Justificado *</label>
            <textarea
              required
              rows={3}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Justifique a necessidade de dilação ou suspensão..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-3d-secondary px-4 py-2 rounded-lg text-xs disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-3d-primary px-5 py-2 rounded-lg text-xs disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar Alteração'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
