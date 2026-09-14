import React, { useState } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Calendar,
  Clock,
  MapPin,
  Video,
  Shield,
  UserPlus,
  Trash2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { ParsedNoticeOfficer, ParsedOfficialNotice } from '../lib/official-notice-parser.ts';
import { formatDateBR } from '../lib/deadline-calculator.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../lib/api.ts';

interface OfficialNoticeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export const OfficialNoticeImportModal: React.FC<OfficialNoticeImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuth();

  const [rawText, setRawText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);

  // Dados analisados e editáveis
  const [parsedData, setParsedData] = useState<ParsedOfficialNotice | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any>(null);

  // Form editável da audiência
  const [form, setForm] = useState({
    noticeNumber: '',
    processNumber: '',
    seiNumber: '',
    hearingDate: '',
    hearingTime: '09:00',
    court: '',
    modality: 'presencial' as 'presencial' | 'remota',
    meetingLink: '',
    location: '',
    notes: '',
  });

  // Lista editável de policiais
  const [officers, setOfficers] = useState<ParsedNoticeOfficer[]>([]);

  // Feedback de conclusão
  const [commitSuccess, setCommitSuccess] = useState<{
    hearingId: number;
    noticeNumber: string;
    officersCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handlePasteSample = () => {
    const sample = `Cumprimentando inicialmente Vossa Excelência, apresento os policiais abaixo relacionados, a fim de participarem de audiência de instrução e julgamento, referente ao Processo nº 0002582-80.2026.8.17.2210, a ser realizada no dia  15 de Setembro de 2026 às 10h00min, na Sala de Audiência da 2ª Vara Civel de Araripina-PE, na modalidade VIRTUAL, por VIDEOCONFERÊNCIA;

link:https://teams.microsoft.com/meet/23726894484535?p=sXJJuPMN3w0GRfoLvC

QTD
POSTO
MAT
NOME
E-MAIL
CONTATO
01
Cabo PM
116345-0
ANTONIO MARCOS CORDEIRO DOS SANTOS
87 9 9914-9872
02
Cabo PM
120591-9
FRANCISCO ROBSON DOS S. DA SILVA CRUZ
88 9 8154-0496`;
    setRawText(sample);
  };

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;
    setAnalyzing(true);
    setCommitSuccess(null);
    try {
      const res = await apiRequest('/api/official-notice/preview', token, {
        method: 'POST',
        body: JSON.stringify({ rawText }),
      });

      const p: ParsedOfficialNotice = res.parsed;
      setParsedData(p);
      setDuplicateWarning(res.duplicateHearing || null);

      setForm({
        noticeNumber: p.noticeNumber || p.processNumber || '',
        processNumber: p.processNumber || '',
        seiNumber: p.seiNumber || '',
        hearingDate: p.hearingDate || '',
        hearingTime: p.hearingTime || '09:00',
        court: p.court || 'Vara da Justiça Militar Estadual',
        modality: p.modality || 'presencial',
        meetingLink: p.meetingLink || '',
        location: p.location || '',
        notes: p.notes || (p.processNumber ? `Processo nº ${p.processNumber}` : ''),
      });

      setOfficers(p.officers || []);
    } catch (err: any) {
      alert(`Erro na análise do ofício: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateOfficer = (id: string, field: keyof ParsedNoticeOfficer, value: any) => {
    setOfficers((prev) =>
      prev.map((off) => (off.id === id ? { ...off, [field]: value } : off))
    );
  };

  const handleRemoveOfficer = (id: string) => {
    setOfficers((prev) => prev.filter((off) => off.id !== id));
  };

  const handleAddOfficer = () => {
    const newOff: ParsedNoticeOfficer = {
      id: `manual-${Date.now()}`,
      rank: 'Sd',
      badge: '',
      fullName: '',
      email: '',
      phone: '',
      isNew: true,
    };
    setOfficers((prev) => [...prev, newOff]);
  };

  const handleCommit = async () => {
    if (!form.noticeNumber.trim()) {
      alert('Informe o número do ofício ou do processo judicial.');
      return;
    }
    if (!form.hearingDate) {
      alert('Informe a data da audiência.');
      return;
    }
    if (!form.court.trim()) {
      alert('Informe o órgão judiciário ou comarca/vara.');
      return;
    }

    setCommitting(true);
    try {
      const res = await apiRequest('/api/official-notice/commit', token, {
        method: 'POST',
        body: JSON.stringify({
          noticeNumber: form.noticeNumber,
          processNumber: form.processNumber || null,
          seiNumber: form.seiNumber || null,
          hearingDate: form.hearingDate,
          hearingTime: form.hearingTime,
          court: form.court,
          modality: form.modality,
          location: form.location || (form.meetingLink ? `Link: ${form.meetingLink}` : null),
          notes: form.notes || null,
          officers: officers.map((off) => ({
            matchedOfficerId: off.matchedOfficerId || null,
            rank: off.rank,
            badge: off.badge || null,
            fullName: off.fullName,
            phone: off.phone || null,
            email: off.email || null,
            isNew: off.isNew,
          })),
        }),
      });

      setCommitSuccess({
        hearingId: res.hearing.id,
        noticeNumber: res.hearing.noticeNumber,
        officersCount: res.associatedOfficersCount,
      });

      await onSuccess();
    } catch (err: any) {
      alert(`Falha ao salvar audiência: ${err.message}`);
    } finally {
      setCommitting(false);
    }
  };

  const handleReset = () => {
    setRawText('');
    setParsedData(null);
    setDuplicateWarning(null);
    setCommitSuccess(null);
    setOfficers([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-200 flex items-center justify-center text-blue-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Importar Audiência do Ofício</h2>
              <p className="text-xs text-slate-500">
                Extração inteligente de processo, data, vara, link e tabela de policiais convocados
              </p>
            </div>
          </div>
          <button
            id="btn-close-official-notice-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-700">
          {/* Sucesso após gravação */}
          {commitSuccess ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  Audiência cadastrada com sucesso!
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  Referência/Ofício: <strong className="font-semibold">{commitSuccess.noticeNumber}</strong> com{' '}
                  <strong className="font-semibold">{commitSuccess.officersCount} policial(is) militar(es)</strong> associado(s).
                </p>
                <p className="text-[11px] text-emerald-600 mt-1">
                  ✓ Policiais novos foram automaticamente cadastrados no diretório com matrícula e telefone.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  id="btn-import-another-notice"
                  onClick={handleReset}
                  className="btn-3d-secondary px-4 py-2 rounded-lg text-xs"
                >
                  Importar Outro Ofício
                </button>
                <button
                  id="btn-finish-notice-import"
                  onClick={onClose}
                  className="btn-3d-emerald px-4 py-2 rounded-lg text-xs"
                >
                  Fechar e Concluir
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Etapa 1: Colagem do Texto do Ofício */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Cole aqui o texto do Ofício Judicial</span>
                    <span className="text-slate-400 font-normal lowercase">(ou trecho da requisição)</span>
                  </label>
                  <button
                    id="btn-paste-sample-notice"
                    type="button"
                    onClick={handlePasteSample}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Colar Exemplo Real</span>
                  </button>
                </div>

                <textarea
                  id="textarea-official-notice-raw"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={6}
                  placeholder="Exemplo: Cumprimentando inicialmente Vossa Excelência, apresento os policiais abaixo relacionados, a fim de participarem de audiência referente ao Processo nº 0002582-80.2026.8.17.2210, a ser realizada no dia 15 de Setembro de 2026 às 10h00min, na 2ª Vara Cível..."
                  className="w-full p-3 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-2xs text-slate-500">
                    O parser detecta automaticamente Processo, Data por extenso, Hora, Vara, Links de videoconferência e a tabela de policiais com matrícula e contato.
                  </span>
                  <button
                    id="btn-analyze-official-notice"
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing || !rawText.trim()}
                    className="btn-3d-primary px-4 py-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analisando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-blue-200" />
                        <span>Analisar Ofício</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Alerta de duplicidade */}
              {duplicateWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Atenção: Audiência similar já cadastrada!</span>
                    <p className="mt-0.5 text-amber-800">
                      Já existe uma audiência cadastrada com o número/processo{' '}
                      <strong>{duplicateWarning.noticeNumber}</strong> no dia{' '}
                      <strong>{formatDateBR(duplicateWarning.hearingDate)}</strong> às{' '}
                      <strong>{duplicateWarning.hearingTime}</strong> ({duplicateWarning.court}). Você ainda pode
                      prosseguir caso seja um desdobramento ou confirmação.
                    </p>
                  </div>
                </div>
              )}

              {/* Etapa 2: Dados Extraídos e Edição */}
              {parsedData && (
                <div className="space-y-6 pt-2 border-t border-slate-200">
                  {/* Resumo da Análise */}
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    <span className="font-semibold text-slate-700">Detectado pelo Parser:</span>
                    {parsedData.confidence.hasProcess && (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-medium">
                        Processo Judicial ✓
                      </span>
                    )}
                    {parsedData.confidence.hasDate && (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-medium">
                        Data: {formatDateBR(parsedData.hearingDate)} ✓
                      </span>
                    )}
                    {parsedData.confidence.hasTime && (
                      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md font-medium">
                        Hora: {parsedData.hearingTime} ✓
                      </span>
                    )}
                    <span className={`px-2.5 py-1 rounded-md font-medium border ${
                      form.modality === 'remota'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      Modalidade: {form.modality === 'remota' ? 'Virtual / Telepresencial' : 'Presencial'}
                    </span>
                    <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-medium">
                      {officers.length} Policial(is) Identificado(s)
                    </span>
                  </div>

                  {/* Formulário da Audiência */}
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      2. Conferência dos Dados da Audiência
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">
                          Nº do Ofício ou Processo *
                        </label>
                        <input
                          type="text"
                          value={form.noticeNumber}
                          onChange={(e) => setForm({ ...form, noticeNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                          placeholder="Ex: 0002582-80.2026.8.17.2210 ou Ofício 12/2026"
                        />
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">
                          Nº do Processo SEI (opcional)
                        </label>
                        <input
                          type="text"
                          value={form.seiNumber}
                          onChange={(e) => setForm({ ...form, seiNumber: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                          placeholder="Ex: 23.0.000012345-6"
                        />
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">
                          Modalidade
                        </label>
                        <select
                          value={form.modality}
                          onChange={(e) =>
                            setForm({ ...form, modality: e.target.value as 'presencial' | 'remota' })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                        >
                          <option value="presencial">Presencial</option>
                          <option value="remota">Remota (Videoconferência / Virtual)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">
                          Data da Audiência *
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={form.hearingDate}
                            onChange={(e) => setForm({ ...form, hearingDate: e.target.value })}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">
                          Horário da Audiência *
                        </label>
                        <input
                          type="time"
                          value={form.hearingTime}
                          onChange={(e) => setForm({ ...form, hearingTime: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1">
                          Vara / Órgão Julgador *
                        </label>
                        <input
                          type="text"
                          value={form.court}
                          onChange={(e) => setForm({ ...form, court: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                          placeholder="Ex: 2ª Vara Cível de Araripina-PE"
                        />
                      </div>
                    </div>

                    {/* Link da sala virtual */}
                    {form.modality === 'remota' && (
                      <div>
                        <label className="block text-2xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                          <span>Link da Sala Virtual (Teams, Google Meet, Zoom)</span>
                          {form.meetingLink && (
                            <a
                              href={form.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline flex items-center gap-1 text-2xs"
                            >
                              <span>Testar link</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </label>
                        <input
                          type="url"
                          value={form.meetingLink}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              meetingLink: e.target.value,
                              location: e.target.value
                                ? `${form.court || 'Audiência Virtual'} - Link: ${e.target.value}`
                                : form.location,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800 font-mono"
                          placeholder="https://teams.microsoft.com/meet/..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-2xs font-semibold text-slate-600 mb-1">
                        Local / Observações de Apresentação
                      </label>
                      <input
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:border-blue-500 text-slate-800"
                        placeholder="Ex: Sala de Audiência / Link Teams..."
                      />
                    </div>
                  </div>

                  {/* Etapa 3: Tabela de Policiais Convocados */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                          <span>3. Policiais Militares Requisitados ({officers.length})</span>
                        </h3>
                        <p className="text-2xs text-slate-500">
                          Policiais já existentes serão vinculados diretamente; novos policiais serão cadastrados com nome, matrícula e telefone.
                        </p>
                      </div>

                      <button
                        id="btn-add-manual-officer"
                        type="button"
                        onClick={handleAddOfficer}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Adicionar Policial</span>
                      </button>
                    </div>

                    {officers.length === 0 ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center">
                        Nenhum policial identificado no texto. Clique em "Adicionar Policial" acima para incluir manualmente.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                              <th className="py-2 px-3 w-24">Posto/Grad</th>
                              <th className="py-2 px-3 w-28">Matrícula</th>
                              <th className="py-2 px-3">Nome Completo</th>
                              <th className="py-2 px-3 w-36">Contato / WhatsApp</th>
                              <th className="py-2 px-3 w-40">Status no Cadastro</th>
                              <th className="py-2 px-2 text-center w-12">Remover</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {officers.map((off) => (
                              <tr key={off.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={off.rank}
                                    onChange={(e) => handleUpdateOfficer(off.id, 'rank', e.target.value)}
                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-medium text-slate-800"
                                    placeholder="Ex: Cb"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={off.badge}
                                    onChange={(e) => handleUpdateOfficer(off.id, 'badge', e.target.value)}
                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono text-slate-800"
                                    placeholder="116345-0"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={off.fullName}
                                    onChange={(e) => handleUpdateOfficer(off.id, 'fullName', e.target.value)}
                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-semibold text-slate-900"
                                    placeholder="NOME COMPLETO DO PM"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={off.phone}
                                    onChange={(e) => handleUpdateOfficer(off.id, 'phone', e.target.value)}
                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded font-mono text-slate-800"
                                    placeholder="87 9 9914-9872"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  {!off.isNew && off.matchedOfficerId ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Vinculado (#{off.matchedOfficerId})</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                      <UserPlus className="w-3 h-3 text-blue-600" />
                                      <span>Novo (cadastrar)</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOfficer(off.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                                    title="Remover policial desta audiência"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé de Ações */}
        {!commitSuccess && (
          <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn-3d-secondary px-4 py-2 rounded-lg text-xs"
            >
              Cancelar
            </button>

            <div className="flex items-center gap-2.5">
              {parsedData && (
                <button
                  id="btn-reset-notice-form"
                  type="button"
                  onClick={handleReset}
                  className="btn-3d-secondary px-3.5 py-2 rounded-lg text-xs"
                >
                  Limpar
                </button>
              )}

              <button
                id="btn-commit-official-notice"
                type="button"
                onClick={handleCommit}
                disabled={committing || !parsedData || !form.noticeNumber || !form.hearingDate}
                className="btn-3d-primary px-5 py-2 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {committing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Salvando Audiência...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Confirmar e Salvar Audiência</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
