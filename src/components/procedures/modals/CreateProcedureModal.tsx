import React from 'react';
import { X, Clock } from 'lucide-react';
import { DisciplinaryProcedure } from '../../../types.ts';

export const PROCEDURES_PHASES = [
  'Instauração',
  'Citação / Notificação Prévia',
  'Instrução Probatória',
  'Defesa Prévia / Alegações',
  'Relatório Conclusivo',
  'Homologação / Solução',
  'Concluído',
  'Arquivado',
];

interface CreateProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProc: DisciplinaryProcedure | null;
  formData: {
    code: string;
    type: 'PDS' | 'SINDICANCIA';
    seiNumber: string;
    seiUrl: string;
    ordinanceNumber: string;
    subject: string;
    responsible: string;
    startDate: string;
    startEvent: string;
    phase: string;
    notes: string;
    initialDaysCount: string;
    initialDaysType: 'corridos' | 'uteis';
    initialExcludeStartDay: boolean;
    confirmImmediately: boolean;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const CreateProcedureModal: React.FC<CreateProcedureModalProps> = ({
  isOpen,
  onClose,
  editingProc,
  formData,
  setFormData,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {editingProc ? 'Editar Procedimento' : 'Novo Procedimento Disciplinar'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Código */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Identificador / Título *
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ex.: PDS nº 012/2026 - 1º BPM"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo de Procedimento *</label>
              <select
                value={formData.type}
                onChange={(e) =>
                  setFormData({ ...formData, type: e.target.value as 'PDS' | 'SINDICANCIA' })
                }
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-500"
              >
                <option value="PDS">Procedimento Disciplinar Sumaríssimo (PDS)</option>
                <option value="SINDICANCIA">Sindicância</option>
              </select>
            </div>

            {/* SEI Número */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Número SEI Oficial</label>
              <input
                type="text"
                value={formData.seiNumber}
                onChange={(e) => setFormData({ ...formData, seiNumber: e.target.value })}
                placeholder="Ex.: 0012345-67.2026.8.17.0001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Link SEI */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Link do Processo no SEI</label>
              <input
                type="url"
                value={formData.seiUrl}
                onChange={(e) => setFormData({ ...formData, seiUrl: e.target.value })}
                placeholder="https://sei.pe.gov.br/sei/..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Encarregado */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Encarregado / Responsável *</label>
              <input
                type="text"
                required
                value={formData.responsible}
                onChange={(e) => setFormData({ ...formData, responsible: e.target.value })}
                placeholder="Ex.: Cap PM Oliveira"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Fase */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Fase Inicial *</label>
              <select
                value={formData.phase}
                onChange={(e) => setFormData({ ...formData, phase: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              >
                {PROCEDURES_PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Data do Marco Inicial */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data do Marco Inicial *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Qual evento foi o marco */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Qual evento foi o marco? *</label>
              <input
                type="text"
                required
                value={formData.startEvent}
                onChange={(e) => setFormData({ ...formData, startEvent: e.target.value })}
                placeholder="Ex.: Publicação em Boletim Geral / Notificação"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Assunto Resumido */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assunto Resumido dos Autos *</label>
            <textarea
              required
              rows={2}
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Descreva suscintamente o objeto da apuração disciplinar..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bloco de Prazo Inicial (Apenas na Criação) */}
          {!editingProc && (
            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Parâmetros do Prazo Inicial
                </span>
                <span className="text-[11px] text-blue-700 font-medium">
                  Exigirá confirmação do editor
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Quantidade de Dias</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.initialDaysCount}
                    onChange={(e) => setFormData({ ...formData, initialDaysCount: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Contagem</label>
                  <select
                    value={formData.initialDaysType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        initialDaysType: e.target.value as 'corridos' | 'uteis',
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="corridos">Dias Corridos</option>
                    <option value="uteis">Dias Úteis</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Dia do Marco</label>
                  <select
                    value={formData.initialExcludeStartDay ? 'exclui' : 'inclui'}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        initialExcludeStartDay: e.target.value === 'exclui',
                      })
                    }
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="exclui">Exclui dia do marco</option>
                    <option value="inclui">Inclui dia do marco</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.confirmImmediately}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmImmediately: e.target.checked })
                  }
                  className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-800 font-semibold">
                  Confirmar prazo imediatamente (tornar definitivo sem status 'a confirmar')
                </span>
              </label>
            </div>
          )}

          {/* Botões do Rodapé */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary px-4 py-2 rounded-lg text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-3d-primary px-5 py-2 rounded-lg text-xs"
            >
              {editingProc ? 'Salvar Alterações' : 'Criar Procedimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
