export interface ParsedBatchLine {
  id: string; // temporary client/server ID
  rawLine: string;
  rank: string;
  officerName: string;
  badge?: string;
  noticeNumber: string;
  hearingDate: string; // YYYY-MM-DD
  hearingTime: string; // HH:mm
  court: string;
  modality: 'presencial' | 'remota';
  status: 'pronto' | 'revisar' | 'duplicado';
  issues: string[];
  matchedOfficerId?: number;
  matchedOfficerName?: string;
}

export interface GroupedHearingImport {
  groupKey: string; // noticeNumber-hearingDate-hearingTime
  noticeNumber: string;
  hearingDate: string;
  hearingTime: string;
  court: string;
  modality: 'presencial' | 'remota';
  officers: {
    officerName: string;
    rank: string;
    badge?: string;
    matchedOfficerId?: number;
  }[];
  status: 'pronto' | 'revisar' | 'duplicado';
  issues: string[];
}

const MONTHS_MAP: Record<string, string> = {
  janeiro: '01',
  jan: '01',
  fevereiro: '02',
  fev: '02',
  marco: '03',
  março: '03',
  mar: '03',
  abril: '04',
  abr: '04',
  maio: '05',
  mai: '05',
  junho: '06',
  jun: '06',
  julho: '07',
  jul: '07',
  agosto: '08',
  ago: '08',
  setembro: '09',
  set: '09',
  outubro: '10',
  out: '10',
  novembro: '11',
  nov: '11',
  dezembro: '12',
  dez: '12',
};

const RANKS = [
  'Cel',
  'Ten Cel',
  'Ten-Cel',
  'Maj',
  'Major',
  'Cap',
  'Capitão',
  '1º Ten',
  '2º Ten',
  'Ten',
  'Subten',
  'Sub Ten',
  '1º Sgt',
  '2º Sgt',
  '3º Sgt',
  'Sgt',
  'Sargento',
  'Cb',
  'Cabo',
  'Sd',
  'Soldado',
];

export function cleanInvisibleChars(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWhatsAppBatch(text: string): ParsedBatchLine[] {
  if (!text || !text.trim()) return [];

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => cleanInvisibleChars(l))
    .filter((l) => l.length > 0);

  const seenNotices = new Set<string>();

  return rawLines.map((line, idx) => {
    const issues: string[] = [];
    let status: 'pronto' | 'revisar' | 'duplicado' = 'pronto';

    // Remove menção duplicada se houver repetição de texto na mesma linha (ex.: - no dia ... - no dia ...)
    let normalized = line;
    const repeatedDateMatch = line.match(/(no dia \d{1,2}.*?)\s*-\s*\1/i);
    if (repeatedDateMatch) {
      normalized = line.replace(`- ${repeatedDateMatch[1]}`, '').trim();
    }

    // Identificar policial: extrair parte antes do primeiro traço '-'
    let officerPart = '';
    let restPart = normalized;
    if (normalized.includes('-')) {
      const parts = normalized.split('-');
      officerPart = parts[0].trim();
      restPart = parts.slice(1).join('-').trim();
    } else {
      officerPart = normalized;
      restPart = '';
    }

    // Limpar prefixos @, ~
    let cleanOfficer = officerPart.replace(/^[@~]+/, '').trim();

    // Extrair Posto/Graduação se presente
    let rank = 'Sd';
    let officerName = cleanOfficer;

    for (const r of RANKS) {
      const regex = new RegExp(`^${r}\\b[.]?\\s*`, 'i');
      if (regex.test(cleanOfficer)) {
        rank = r.replace('Soldado', 'Sd').replace('Cabo', 'Cb').replace('Sargento', 'Sgt');
        officerName = cleanOfficer.replace(regex, '').trim();
        break;
      }
    }

    // Se restPart contiver identificador de ofício (ex. 92466419)
    let noticeNumber = '';
    const numberMatch = restPart.match(/\b(\d{7,10})\b/);
    if (numberMatch) {
      noticeNumber = numberMatch[1];
    }

    // Extrair data: "no dia DD de [MÊS] de AAAA" ou "DD/MM/AAAA"
    let hearingDate = '';
    const textualDateMatch = restPart.match(
      /(?:no dia\s+)?(\d{1,2})\s+de\s+([a-zA-ZçÇ]+)(?:\s+de\s+(\d{4}))?/i
    );

    if (textualDateMatch) {
      const day = String(textualDateMatch[1]).padStart(2, '0');
      const monthWord = textualDateMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const month = MONTHS_MAP[monthWord] || '';
      const currentYear = new Date().getFullYear();
      const year = textualDateMatch[3] || String(currentYear);

      if (month && Number(day) >= 1 && Number(day) <= 31) {
        hearingDate = `${year}-${month}-${day}`;
      } else {
        issues.push('Mês não reconhecido ou dia inválido');
      }
    } else {
      const numericDateMatch = restPart.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (numericDateMatch) {
        const day = String(numericDateMatch[1]).padStart(2, '0');
        const month = String(numericDateMatch[2]).padStart(2, '0');
        const year = numericDateMatch[3];
        hearingDate = `${year}-${month}-${day}`;
      }
    }

    // Extrair hora: "às 08h00min" ou "às 08:00" ou "08h00" ou "11h30min"
    let hearingTime = '';
    const timeMatch = restPart.match(
      /(?:às|as)?\s*(\d{1,2})(?:[hH:]|\s*h\s*)(\d{2})(?:min|m)?/i
    );
    if (timeMatch) {
      const hour = String(timeMatch[1]).padStart(2, '0');
      const min = String(timeMatch[2]).padStart(2, '0');
      if (Number(hour) >= 0 && Number(hour) <= 23 && Number(min) >= 0 && Number(min) <= 59) {
        hearingTime = `${hour}:${min}`;
      } else {
        issues.push('Hora fora do intervalo válido (00-23:00-59)');
      }
    }

    // Validações
    if (!officerName) {
      issues.push('Nome do policial ausente');
      status = 'revisar';
    }
    if (!noticeNumber) {
      issues.push('Número do ofício/processo não identificado na linha');
      status = 'revisar';
    }
    if (!hearingDate) {
      issues.push('Data da audiência não identificada');
      status = 'revisar';
    }
    if (!hearingTime) {
      issues.push('Hora da audiência não identificada');
      status = 'revisar';
    }

    const itemKey = `${noticeNumber || 'SEM_NUM'}-${hearingDate}-${hearingTime}-${officerName.toLowerCase()}`;
    if (seenNotices.has(itemKey)) {
      status = 'duplicado';
      issues.push('Linha duplicada no texto colado');
    } else {
      seenNotices.add(itemKey);
    }

    if (issues.length > 0 && status !== 'duplicado') {
      status = 'revisar';
    }

    return {
      id: `batch-${idx + 1}-${Date.now()}`,
      rawLine: line,
      rank,
      officerName,
      noticeNumber: noticeNumber || '',
      hearingDate: hearingDate || '',
      hearingTime: hearingTime || '',
      court: 'Vara da Justiça Militar / Estadual',
      modality: 'presencial',
      status,
      issues,
    };
  });
}

export function groupParsedHearings(lines: ParsedBatchLine[]): GroupedHearingImport[] {
  const groups = new Map<string, GroupedHearingImport>();

  for (const item of lines) {
    const key = `${item.noticeNumber || 'AVULSO'}-${item.hearingDate || 'DATA'}-${item.hearingTime || 'HORA'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        noticeNumber: item.noticeNumber,
        hearingDate: item.hearingDate,
        hearingTime: item.hearingTime,
        court: item.court || 'Vara da Justiça Militar Estadual',
        modality: item.modality || 'presencial',
        officers: [],
        status: item.status,
        issues: [...item.issues],
      });
    }

    const group = groups.get(key)!;
    group.officers.push({
      officerName: item.officerName,
      rank: item.rank,
      badge: item.badge,
      matchedOfficerId: item.matchedOfficerId,
    });

    if (item.status === 'revisar' && group.status !== 'duplicado') {
      group.status = 'revisar';
      item.issues.forEach((iss) => {
        if (!group.issues.includes(iss)) group.issues.push(iss);
      });
    }
  }

  return Array.from(groups.values());
}
