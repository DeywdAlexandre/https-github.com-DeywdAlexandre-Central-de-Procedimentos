import React from 'react';
import { X } from 'lucide-react';
import { DisciplinaryProcedure } from '../../../types.ts';

interface NewDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  procedures: DisciplinaryProcedure[];
  form: {
    procedureId: number;
    title: string;
    startDate: string;
    daysCount: string;
    daysType: 'corridos' | 'uteis';
    excludeStartDay: boolean;
    manualEndDate: string;
    manualJustification: string;
    responsible: string;
    confirmImmediately: boolean;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  calculatedPreview: string;
  onRecalculatePreview: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const NewDeadlineModal: React.FC<NewDeadlineModalProps> = ({
  isOpen,
  onClose,
  procedures,
  form,
  setForm,
  calculatedPreview,
  onRecalculatePreview,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Adicionar Prazo a Procedimento</h4>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Procedimento *</label>
            <select
              value={form.procedureId}
              onChange={(e) =>
                setForm({
                  ...form,
                  procedureId: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium"
            >
              {procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.subject.slice(0, 40)}...
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título do Prazo *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data do Marco *</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Qtd. Dias</label>
              <input
                type="number"
                min="1"
                value={form.daysCount}
                onChange={(e) => setForm({ ...form, daysCount: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contagem</label>
              <select
                value={form.daysType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    daysType: e.target.value as 'corridos' | 'uteis',
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="corridos">Dias Corridos</option>
                <option value="uteis">Dias Úteis</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Dia do Marco</label>
              <select
                value={form.excludeStartDay ? 'exclui' : 'inclui'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    excludeStartDay: e.target.value === 'exclui',
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              >
                <option value="exclui">Exclui dia do marco</option>
                <option value="inclui">Inclui dia do marco</option>
              </select>
            </div>
          </div>

          {/* Botão para atualizar preview de cálculo */}
          <button
            type="button"
            onClick={onRecalculatePreview}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            Atualizar Memória de Cálculo
          </button>

          {calculatedPreview && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono whitespace-pre-line text-slate-700">
              {calculatedPreview}
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.confirmImmediately}
              onChange={(e) =>
                setForm({
                  ...form,
                  confirmImmediately: e.target.checked,
                })
              }
              className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-slate-800 font-semibold">
              Confirmar prazo imediatamente sem passar por status 'a confirmar'
            </span>
          </label>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
            >
              Gravar Prazo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
