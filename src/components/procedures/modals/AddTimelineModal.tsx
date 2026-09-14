import React from 'react';
import { X } from 'lucide-react';

interface AddTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  timelineData: {
    actionDate: string;
    description: string;
    nextStep: string;
    seiDocumentRef: string;
  };
  setTimelineData: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const AddTimelineModal: React.FC<AddTimelineModalProps> = ({
  isOpen,
  onClose,
  timelineData,
  setTimelineData,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900">Novo Andamento dos Autos</h4>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Data do Ato *</label>
            <input
              type="date"
              required
              value={timelineData.actionDate}
              onChange={(e) => setTimelineData({ ...timelineData, actionDate: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Descrição da Movimentação *
            </label>
            <textarea
              required
              rows={3}
              value={timelineData.description}
              onChange={(e) =>
                setTimelineData({ ...timelineData, description: e.target.value })
              }
              placeholder="Ex.: Realizada a oitiva da testemunha..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Próximo Passo Previsto</label>
            <input
              type="text"
              value={timelineData.nextStep}
              onChange={(e) => setTimelineData({ ...timelineData, nextStep: e.target.value })}
              placeholder="Ex.: Intimação da defesa técnica"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ref. Documento SEI</label>
            <input
              type="text"
              value={timelineData.seiDocumentRef}
              onChange={(e) =>
                setTimelineData({ ...timelineData, seiDocumentRef: e.target.value })
              }
              placeholder="Ex.: Termo de Depoimento nº 98765432"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary px-3.5 py-1.5 rounded-lg text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-3d-primary px-4 py-1.5 rounded-lg text-xs"
            >
              Gravar Andamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
