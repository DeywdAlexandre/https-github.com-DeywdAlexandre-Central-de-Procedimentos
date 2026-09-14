import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { JudicialHearing } from '../../../types.ts';
import { formatDateBR } from '../../../lib/deadline-calculator.ts';

interface DeleteHearingModalProps {
  hearing: JudicialHearing | null;
  onClose: () => void;
  onConfirm: (hearingId: number) => Promise<void>;
}

export const DeleteHearingModal: React.FC<DeleteHearingModalProps> = ({
  hearing,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!hearing) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(hearing.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-rose-100 bg-rose-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Excluir Audiência Judicial</span>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3.5 text-xs text-slate-600">
          <p className="text-slate-700">
            Tem certeza que deseja excluir permanentemente a audiência referente ao processo/ofício{' '}
            <strong className="text-slate-950">{hearing.noticeNumber}</strong>?
          </p>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div>
              <strong>Data / Hora:</strong> {formatDateBR(hearing.hearingDate)} às {hearing.hearingTime}
            </div>
            <div>
              <strong>Órgão:</strong> {hearing.court}
            </div>
            <div>
              <strong>Policiais Vinculados:</strong> {hearing.officers?.length || 0} policial(is)
            </div>
          </div>

          <p className="text-rose-600 font-semibold text-[11px]">
            Esta ação removerá a audiência, seus ofícios de apresentação vinculados e os lembretes pendentes associados. Esta operação não pode ser desfeita.
          </p>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="btn-3d-secondary px-3.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="btn-3d-danger px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isDeleting ? 'Excluindo...' : 'Sim, Excluir Audiência'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
