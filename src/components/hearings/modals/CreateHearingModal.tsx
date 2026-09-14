import React, { useState } from 'react';
import { X } from 'lucide-react';
import { PoliceOfficer } from '../../../types.ts';
import { getTodayDateBR } from '../../../lib/deadline-calculator.ts';

interface CreateHearingModalProps {
  isOpen: boolean;
  onClose: () => void;
  officers: PoliceOfficer[];
  onSubmit: (data: {
    noticeNumber: string;
    seiNumber: string;
    hearingDate: string;
    hearingTime: string;
    court: string;
    modality: 'presencial' | 'remota';
    location: string;
    notes: string;
    selectedOfficerIds: number[];
  }) => Promise<void>;
}

export const CreateHearingModal: React.FC<CreateHearingModalProps> = ({
  isOpen,
  onClose,
  officers,
  onSubmit,
}) => {
  const [form, setForm] = useState({
    noticeNumber: '',
    seiNumber: '',
    hearingDate: getTodayDateBR(),
    hearingTime: '09:00',
    court: 'Vara da Justiça Militar Estadual',
    modality: 'presencial' as 'presencial' | 'remota',
    location: 'Fórum Rodolfo Aureliano - Ilha de Joana Bezerra, Recife',
    notes: '',
    selectedOfficerIds: [] as number[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <h4 className="text-sm font-bold text-slate-900">Agendar Nova Audiência Judicial</h4>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Nº do Ofício Judicial / Processo *
              </label>
              <input
                type="text"
                required
                value={form.noticeNumber}
                onChange={(e) => setForm({ ...form, noticeNumber: e.target.value })}
                placeholder="Ex.: 92466419 ou 000123-2026"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nº SEI (Opcional)</label>
              <input
                type="text"
                value={form.seiNumber}
                onChange={(e) => setForm({ ...form, seiNumber: e.target.value })}
                placeholder="Ex.: 0012345-67.2026..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data da Audiência *</label>
              <input
                type="date"
                required
                value={form.hearingDate}
                onChange={(e) => setForm({ ...form, hearingDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Horário (Recife) *</label>
              <input
                type="time"
                required
                value={form.hearingTime}
                onChange={(e) => setForm({ ...form, hearingTime: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Vara / Juízo *</label>
              <input
                type="text"
                required
                value={form.court}
                onChange={(e) => setForm({ ...form, court: e.target.value })}
                placeholder="Ex.: Vara da Justiça Militar Estadual de Pernambuco"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Modalidade *</label>
              <select
                value={form.modality}
                onChange={(e) =>
                  setForm({
                    ...form,
                    modality: e.target.value as 'presencial' | 'remota',
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold"
              >
                <option value="presencial">Presencial</option>
                <option value="remota">Virtual / Remota (Videoconferência)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Local / Link</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Endereço do fórum ou link da sala virtual"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Seleção de Policiais (Muitos para Muitos) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Vincular Policiais Convocados (Muitos para Muitos)
            </label>
            <div className="max-h-40 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1 bg-slate-50">
              {officers.length === 0 ? (
                <p className="text-slate-400 italic p-2">Nenhum policial cadastrado.</p>
              ) : (
                officers.map((off) => {
                  const isSelected = form.selectedOfficerIds.includes(off.id);
                  return (
                    <label
                      key={off.id}
                      className="flex items-center gap-2 p-1.5 rounded hover:bg-white cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setForm({
                              ...form,
                              selectedOfficerIds: [...form.selectedOfficerIds, off.id],
                            });
                          } else {
                            setForm({
                              ...form,
                              selectedOfficerIds: form.selectedOfficerIds.filter(
                                (id) => id !== off.id
                              ),
                            });
                          }
                        }}
                        className="rounded-sm text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold text-slate-800">
                        {off.rank} {off.fullName}
                      </span>
                      {off.badge && (
                        <span className="text-slate-400 text-[10px]">({off.badge})</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Agendar Audiência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
