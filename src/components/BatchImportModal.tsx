import React, { useState } from 'react';
import {
  X,
  MessageSquareShare,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ParsedBatchLine, GroupedHearingImport } from '../lib/whatsapp-batch-parser.ts';
import { formatDateBR } from '../lib/deadline-calculator.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const BatchImportModal: React.FC<BatchImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();

  const [rawText, setRawText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Resultados da análise
  const [parsedLines, setParsedLines] = useState<ParsedBatchLine[]>([]);
  const [groupedHearings, setGroupedHearings] = useState<GroupedHearingImport[]>([]);
  const [summary, setSummary] = useState<{
    pronto: number;
    revisar: number;
    duplicado: number;
  } | null>(null);

  // Relato de conclusão
  const [commitResult, setCommitResult] = useState<{
    success: boolean;
    createdHearingsCount: number;
    associatedOfficersCount: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    setRawText(`@SD ERISVALDO - 92466419 - no dia 02 de SETEMBRO de 2026 às 08h00min
@Sd Diogenes - 92900342 - no dia 28 de SETEMBRO de 2026 às 09h00min
@Sd Eklésio - 92901600 - no dia 28 de SETEMBRO de 2026 às 11h00min
@~Tavares - no dia 16 de setembro de 2026 às 11h30min - no dia 16 de setembro de 2026 às 11h30min`);
  };

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    setCommitResult(null);
    try {
      const data = await apiRequest('/api/batch/preview', token, {
        method: 'POST',
        body: JSON.stringify({ rawText }),
      });
      setParsedLines(data.lines);
      setGroupedHearings(data.groups);
      setSummary(data.summary);
    } catch (err: any) {
      alert(`Erro na análise do texto: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (groupedHearings.length === 0) return;
    setCommitting(true);
    try {
      const data = await apiRequest('/api/batch/commit', token, {
        method: 'POST',
        body: JSON.stringify({ groups: groupedHearings }),
      });
      setCommitResult(data);
      await onSuccess();
    } catch (err: any) {
      alert(`Erro ao salvar importação: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleUpdateLine = (id: string, field: string, value: string) => {
    setParsedLines((prev) =>
      prev.map((l) => {
        if (l.id === id) {
          const updated = { ...l, [field]: value };
          // revalidar
          const issues: string[] = [];
          if (!updated.officerName) issues.push('Nome ausente');
          if (!updated.noticeNumber) issues.push('Número do ofício ausente');
          if (!updated.hearingDate) issues.push('Data ausente');
          if (!updated.hearingTime) issues.push('Hora ausente');
          updated.issues = issues;
          updated.status = issues.length > 0 ? 'revisar' : 'pronto';
          return updated;
        }
        return l;
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <MessageSquareShare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Importação em Lote de Audiências (WhatsApp)
              </h3>
              <p className="text-xs text-slate-500">
                Cole a lista de policiais e horários copiada da mensagem do WhatsApp
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Caixa de Texto para Colar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-800">
                Texto Copiado da Mensagem (uma linha por policial convocatório):
              </label>
              <button
                type="button"
                onClick={handlePasteSample}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Colar exemplo de demonstração</span>
              </button>
            </div>

            <textarea
              rows={5}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`@SD ERISVALDO - 92466419 - no dia 02 de SETEMBRO de 2026 às 08h00min
@Sd Diogenes - 92900342 - no dia 28 de SETEMBRO de 2026 às 09h00min
@Sd Eklésio - 92901600 - no dia 28 de SETEMBRO de 2026 às 11h00min
@~Tavares - no dia 16 de setembro de 2026 às 11h30min`}
              className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-slate-800"
            />

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-500">
                O parser remove automaticamente caracteres invisíveis (@menções, til ~ e
                repetições) e cruza com a base de policiais. O número de 8 dígitos é tratado como
                identificador de ofício.
              </p>
              <button
                type="button"
                disabled={!rawText.trim() || analyzing}
                onClick={handleAnalyze}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1.5"
              >
                {analyzing ? 'Analisando...' : 'Analisar e Processar Prévia'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Resultado da Análise / Prévia */}
          {summary && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800">Resumo da Prévia:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {summary.pronto} Prontos
                  </span>
                  {summary.revisar > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {summary.revisar} A Revisar
                    </span>
                  )}
                  {summary.duplicado > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      {summary.duplicado} Duplicados
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-600 font-medium">
                  {groupedHearings.length} audiência(s) agrupada(s) por ofício e horário.
                </div>
              </div>

              {/* Tabela de Linhas Analisadas com Edição Prévia */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {parsedLines.map((line) => (
                    <div
                      key={line.id}
                      className={`p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        line.status === 'revisar'
                          ? 'bg-amber-50/50'
                          : line.status === 'duplicado'
                          ? 'bg-rose-50/40'
                          : 'bg-white'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.2 rounded-sm text-[10px] font-bold uppercase ${
                              line.status === 'pronto'
                                ? 'bg-emerald-100 text-emerald-800'
                                : line.status === 'revisar'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {line.status}
                          </span>
                          <span className="font-bold text-slate-800">
                            {line.rank} {line.officerName}
                          </span>
                          {line.matchedOfficerName && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-sm border border-blue-200">
                              Vinculado: {line.matchedOfficerName}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <div>
                            <span className="text-[10px] text-slate-400 block">Nº Ofício:</span>
                            <input
                              type="text"
                              value={line.noticeNumber}
                              onChange={(e) =>
                                handleUpdateLine(line.id, 'noticeNumber', e.target.value)
                              }
                              placeholder="Obrigatório"
                              className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded-md text-xs font-mono"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block">Data:</span>
                            <input
                              type="date"
                              value={line.hearingDate}
                              onChange={(e) =>
                                handleUpdateLine(line.id, 'hearingDate', e.target.value)
                              }
                              className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded-md text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block">Hora:</span>
                            <input
                              type="time"
                              value={line.hearingTime}
                              onChange={(e) =>
                                handleUpdateLine(line.id, 'hearingTime', e.target.value)
                              }
                              className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded-md text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block">Vara / Juízo:</span>
                            <input
                              type="text"
                              value={line.court}
                              onChange={(e) => handleUpdateLine(line.id, 'court', e.target.value)}
                              className="w-full px-2 py-0.5 bg-white border border-slate-300 rounded-md text-xs"
                            />
                          </div>
                        </div>

                        {line.issues.length > 0 && (
                          <div className="text-[11px] text-amber-800 font-semibold pt-1">
                            Atenção: {line.issues.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Relato de Sucesso da Importação */}
          {commitResult && (
            <div
              className={`p-4 rounded-xl border ${
                commitResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Importação Concluída com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                Foram cadastradas com sucesso <strong>{commitResult.createdHearingsCount}</strong>{' '}
                audiência(s) e vinculados <strong>{commitResult.associatedOfficersCount}</strong>{' '}
                policial(is) militar(es) à agenda de controle.
              </p>
              {commitResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-rose-700 space-y-0.5">
                  <p className="font-bold">Ocorrências registradas:</p>
                  <ul className="list-disc list-inside">
                    {commitResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors"
          >
            {commitResult ? 'Fechar' : 'Cancelar'}
          </button>

          {groupedHearings.length > 0 && !commitResult && (
            <button
              type="button"
              disabled={committing}
              onClick={handleCommit}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg shadow-2xs shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
            >
              {committing ? 'Gravando no Banco...' : 'Confirmar e Importar Registros'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
