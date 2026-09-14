import { JudicialHearing, ProcedureDeadline, AuditLogEntry } from '../types.ts';
import { formatDateBR } from './deadline-calculator.ts';

export function exportDeadlinesToCSV(deadlines: ProcedureDeadline[], filename = 'prazos_pmpe.csv') {
  const headers = [
    'Procedimento',
    'Tipo',
    'Título do Prazo',
    'Data Marco Inicial',
    'Data Final Proposta/Calculada',
    'Data Final Confirmada',
    'Status',
    'Confirmado?',
    'Responsável',
    'Discriminação do Cálculo / Justificativa',
  ];

  const rows = deadlines.map((d) => [
    `"${d.procedureCode || ''}"`,
    `"${d.procedureType || ''}"`,
    `"${d.title || ''}"`,
    `"${formatDateBR(d.startDate)}"`,
    `"${formatDateBR(d.calculatedEndDate)}"`,
    `"${d.confirmedEndDate ? formatDateBR(d.confirmedEndDate) : 'Pendente'}"`,
    `"${d.effectiveStatus || d.status}"`,
    `"${d.isConfirmed ? 'Sim' : 'Não'}"`,
    `"${d.responsible || ''}"`,
    `"${(d.ruleDescription || d.manualJustification || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  downloadBlob(csvContent, filename);
}

export function exportHearingsToCSV(hearings: JudicialHearing[], filename = 'audiencias_pmpe.csv') {
  const headers = [
    'Nº Ofício/Processo Judicial',
    'Nº SEI',
    'Data',
    'Hora',
    'Vara / Juízo',
    'Modalidade',
    'Local / Link',
    'Situação',
    'Policiais Convocados',
    'Status dos Ofícios de Apresentação',
    'Observações',
  ];

  const rows = hearings.map((h) => {
    const officersList = (h.officers || [])
      .map((o) => `${o.officerRank} ${o.officerFullName}`)
      .join(', ');

    const noticesList = (h.officers || [])
      .map((o) => `${o.officerRank} ${o.officerFullName}: ${o.noticeStatus}`)
      .join(' | ');

    return [
      `"${h.noticeNumber || ''}"`,
      `"${h.seiNumber || ''}"`,
      `"${formatDateBR(h.hearingDate)}"`,
      `"${h.hearingTime || ''}"`,
      `"${h.court || ''}"`,
      `"${h.modality || ''}"`,
      `"${(h.location || '').replace(/"/g, '""')}"`,
      `"${h.status || ''}"`,
      `"${officersList.replace(/"/g, '""')}"`,
      `"${noticesList.replace(/"/g, '""')}"`,
      `"${(h.notes || h.didNotOccurReason || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  downloadBlob(csvContent, filename);
}

export function exportAuditLogsToCSV(logs: AuditLogEntry[], filename = 'auditoria_pmpe.csv') {
  const headers = ['Data/Hora', 'Ação', 'Entidade', 'ID', 'Usuário', 'IP', 'Detalhes'];
  const rows = logs.map((l) => [
    `"${new Date(l.createdAt).toLocaleString('pt-BR')}"`,
    `"${l.action || ''}"`,
    `"${l.entityType || ''}"`,
    `"${l.entityId || ''}"`,
    `"${l.userEmail || ''}"`,
    `"${l.ipAddress || ''}"`,
    `"${(l.details || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  downloadBlob(csvContent, filename);
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
