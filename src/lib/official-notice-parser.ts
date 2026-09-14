export interface ParsedNoticeOfficer {
  id: string; // id temporário de interface
  rank: string; // ex: "Cabo PM" ou "Cb"
  badge: string; // ex: "116345-0" (Matrícula)
  fullName: string; // ex: "ANTONIO MARCOS CORDEIRO DOS SANTOS"
  email: string; // ex: "" ou e-mail
  phone: string; // ex: "87 9 9914-9872"
  matchedOfficerId?: number;
  matchedOfficerName?: string;
  isNew?: boolean;
}

export interface ParsedOfficialNotice {
  noticeNumber: string; // Ofício nº ou Processo
  processNumber: string; // Ex: "0002582-80.2026.8.17.2210"
  seiNumber: string; // Ex: "000000000-00" ou ""
  hearingDate: string; // "YYYY-MM-DD"
  hearingTime: string; // "HH:mm"
  court: string; // Ex: "2ª Vara Cível de Araripina-PE"
  modality: 'presencial' | 'remota';
  meetingLink: string; // Link Teams/Meet/Zoom
  location: string;
  notes: string;
  officers: ParsedNoticeOfficer[];
  confidence: {
    hasProcess: boolean;
    hasDate: boolean;
    hasTime: boolean;
    hasCourt: boolean;
    hasOfficers: boolean;
  };
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

export const MILITARY_RANKS = [
  'Coronel PM',
  'Cel PM',
  'Cel',
  'Tenente-Coronel PM',
  'Ten Cel PM',
  'Ten-Cel PM',
  'Ten Cel',
  'Major PM',
  'Maj PM',
  'Maj',
  'Capitão PM',
  'Cap PM',
  'Cap',
  '1º Tenente PM',
  '1º Ten PM',
  '1º Ten',
  '2º Tenente PM',
  '2º Ten PM',
  '2º Ten',
  'Tenente PM',
  'Ten PM',
  'Ten',
  'Subtenente PM',
  'Subten PM',
  'Sub Ten PM',
  'Subten',
  '1º Sargento PM',
  '1º Sgt PM',
  '1º Sgt',
  '2º Sargento PM',
  '2º Sgt PM',
  '2º Sgt',
  '3º Sargento PM',
  '3º Sgt PM',
  '3º Sgt',
  'Sargento PM',
  'Sgt PM',
  'Sgt',
  'Cabo PM',
  'Cb PM',
  'Cabo',
  'Cb',
  'Soldado PM',
  'Sd PM',
  'Soldado',
  'Sd',
];

export function cleanInvisibleChars(str: string): string {
  if (!str) return '';
  return str
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Normaliza o posto/graduação para o padrão PMPE do sistema
 */
export function normalizeRank(rawRank: string): string {
  if (!rawRank) return 'Sd';
  const r = rawRank.toLowerCase().trim();
  if (r.includes('cel') || r.includes('coronel')) {
    if (r.includes('ten')) return 'Ten Cel';
    return 'Cel';
  }
  if (r.includes('maj')) return 'Maj';
  if (r.includes('cap')) return 'Cap';
  if (r.includes('1') && r.includes('ten')) return '1º Ten';
  if (r.includes('2') && r.includes('ten')) return '2º Ten';
  if (r.includes('ten')) return 'Ten';
  if (r.includes('sub')) return 'Subten';
  if (r.includes('1') && r.includes('sgt')) return '1º Sgt';
  if (r.includes('2') && r.includes('sgt')) return '2º Sgt';
  if (r.includes('3') && r.includes('sgt')) return '3º Sgt';
  if (r.includes('sgt') || r.includes('sargento')) return 'Sgt';
  if (r.includes('cb') || r.includes('cabo')) return 'Cb';
  if (r.includes('sd') || r.includes('soldado')) return 'Sd';
  return rawRank;
}

/**
 * Realiza o parser completo de um texto copiado de Ofício de Apresentação / Requisição
 */
export function parseOfficialNotice(text: string): ParsedOfficialNotice {
  if (!text) {
    return {
      noticeNumber: '',
      processNumber: '',
      seiNumber: '',
      hearingDate: '',
      hearingTime: '',
      court: '',
      modality: 'presencial',
      meetingLink: '',
      location: '',
      notes: '',
      officers: [],
      confidence: {
        hasProcess: false,
        hasDate: false,
        hasTime: false,
        hasCourt: false,
        hasOfficers: false,
      },
    };
  }

  // 1. Processo Judicial (ex: "Processo nº 0002582-80.2026.8.17.2210")
  let processNumber = '';
  const processMatch = text.match(/(?:processo|proc\.?|autos|pje|npu)\s*(?:n[º°o]?\.?|\:)?\s*([0-9\.\-\/]{10,32})/i);
  if (processMatch) {
    processNumber = processMatch[1].trim();
  }

  // 2. Ofício (ex: "Ofício nº 123/2026" ou "OFÍCIO Nº...")
  let noticeNumber = '';
  const noticeMatch = text.match(/(?:of[íi]cio(?:\s+circular)?)\s*(?:n[º°o]?\.?|\:)?\s*([0-9\.\-\/]+[A-Za-z0-9\-\/]*)/i);
  if (noticeMatch) {
    noticeNumber = noticeMatch[1].trim();
  } else if (processNumber) {
    noticeNumber = processNumber;
  }

  // 3. Número SEI
  let seiNumber = '';
  const seiMatch = text.match(/(?:sei|processo\s+sei)\s*(?:n[º°o]?\.?|\:)?\s*([0-9\.\-\/]{8,25})/i);
  if (seiMatch) {
    seiNumber = seiMatch[1].trim();
  }

  // 4. Data da audiência
  let hearingDate = '';
  // Ex: "no dia  15 de Setembro de 2026" ou "dia 15/09/2026"
  const dateExtensoMatch = text.match(
    /(?:no\s+dia|dia|data|realizada\s+no\s+dia|em)\s*([0-3]?[0-9])\s*(?:de|\/)\s*([a-zA-ZçÇ]+|[0-1]?[0-9])\s*(?:de|\/)?\s*([2][0-9]{3})/i
  );

  if (dateExtensoMatch) {
    const day = dateExtensoMatch[1].padStart(2, '0');
    const rawMonth = dateExtensoMatch[2].toLowerCase();
    const year = dateExtensoMatch[3];
    const month = MONTHS_MAP[rawMonth] || rawMonth.padStart(2, '0');
    hearingDate = `${year}-${month}-${day}`;
  } else {
    // Tenta formato DD/MM/AAAA
    const dateNumMatch = text.match(/\b([0-3]?[0-9])[\/\.\-]([0-1]?[0-9])[\/\.\-]([2][0-9]{3})\b/);
    if (dateNumMatch) {
      const day = dateNumMatch[1].padStart(2, '0');
      const month = dateNumMatch[2].padStart(2, '0');
      const year = dateNumMatch[3];
      hearingDate = `${year}-${month}-${day}`;
    }
  }

  // 5. Horário da audiência (ex: "às 10h00min", "às 10:00", "10h30")
  let hearingTime = '';
  const timeMatch = text.match(/(?:às|as|às?\s*horas?|hor[áa]rio[\:\s]*)\s*([0-2]?[0-9])(?:h|:)([0-5][0-9])(?:min)?/i);
  if (timeMatch) {
    const hour = timeMatch[1].padStart(2, '0');
    const min = timeMatch[2].padStart(2, '0');
    hearingTime = `${hour}:${min}`;
  } else {
    const simpleHourMatch = text.match(/(?:às|as)\s*([0-2]?[0-9])h\b/i);
    if (simpleHourMatch) {
      const hour = simpleHourMatch[1].padStart(2, '0');
      hearingTime = `${hour}:00`;
    }
  }

  // 6. Link da Videoconferência / Sala Virtual
  let meetingLink = '';
  const linkMatch = text.match(/(?:link|sala virtual|videoconfer[êe]ncia|teams|meet|zoom)[\s\:\=]*(https?:\/\/[^\s\<\>"\']+)/i);
  if (linkMatch) {
    meetingLink = linkMatch[1].trim();
  } else {
    // Qualquer link Teams, Meet, Zoom ou TJPE
    const genericLinkMatch = text.match(/(https?:\/\/(?:teams\.microsoft\.com|meet\.google\.com|zoom\.us|webex\.com|tjpe\.jus\.br|pje[^\s]+)[^\s\<\>"\']+)/i);
    if (genericLinkMatch) {
      meetingLink = genericLinkMatch[1].trim();
    }
  }

  // 7. Modalidade (Virtual vs Presencial)
  let modality: 'presencial' | 'remota' = 'presencial';
  const lowerText = text.toLowerCase();
  if (
    lowerText.includes('virtual') ||
    lowerText.includes('videoconfer') ||
    lowerText.includes('remota') ||
    lowerText.includes('teams.microsoft') ||
    lowerText.includes('meet.google') ||
    meetingLink
  ) {
    modality = 'remota';
  }

  // 8. Vara / Tribunal / Comarca
  let court = '';
  const courtMatch = text.match(/(?:na|no)\s+([^\,\;\n\r]*(?:Sala de Audi[êe]ncia|Vara|Juizado|Auditoria Militar|Tribunal|Comarca|F[óo]rum)[^\,\;\n\r]*)/i);
  if (courtMatch) {
    court = cleanInvisibleChars(courtMatch[1]);
  } else {
    // Tenta capturar "Vara Cível...", "Vara Criminal...", "Juizado..."
    const courtDirectMatch = text.match(/\b([0-9]?[ªºa-zA-Z\s\.\-]*Vara\s+[^\,\;\n\r]+)/i);
    if (courtDirectMatch) {
      court = cleanInvisibleChars(courtDirectMatch[1]);
    } else {
      court = 'Vara da Justiça Militar Estadual';
    }
  }

  // 9. Localização descritiva
  let location = '';
  if (modality === 'remota') {
    location = court ? `${court} (Videoconferência)` : 'Videoconferência Remota';
    if (meetingLink) {
      location += ` - Link: ${meetingLink}`;
    }
  } else {
    location = court || 'Fórum da Comarca';
  }

  // 10. Policiais militares da tabela
  const officers = parseOfficersFromText(text);

  return {
    noticeNumber,
    processNumber,
    seiNumber,
    hearingDate,
    hearingTime: hearingTime || '09:00',
    court,
    modality,
    meetingLink,
    location,
    notes: processNumber ? `Referente ao Processo nº ${processNumber}` : '',
    officers,
    confidence: {
      hasProcess: Boolean(processNumber),
      hasDate: Boolean(hearingDate),
      hasTime: Boolean(hearingTime),
      hasCourt: Boolean(court),
      hasOfficers: officers.length > 0,
    },
  };
}

/**
 * Analisa as linhas do texto procurando a tabela de policiais requisitados
 */
function parseOfficersFromText(text: string): ParsedNoticeOfficer[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => cleanInvisibleChars(l))
    .filter((l) => l.length > 0);

  const officers: ParsedNoticeOfficer[] = [];

  // 1. Procurar por formato com separadores de tabela (tabulações \t ou pipes |)
  for (const line of lines) {
    if (line.includes('\t') || line.includes('|')) {
      const cols = line
        .split(/[\t\|]/)
        .map((c) => cleanInvisibleChars(c))
        .filter((c) => c.length > 0);

      // Pula cabeçalho
      if (cols.some((c) => /^(QTD|POSTO|MAT|NOME|CONTATO|E-MAIL)$/i.test(c))) {
        continue;
      }

      if (cols.length >= 3) {
        // Exemplo: 01 | Cabo PM | 116345-0 | ANTONIO MARCOS... | 87 9 9914-9872
        let rank = '';
        let badge = '';
        let fullName = '';
        let email = '';
        let phone = '';

        for (const col of cols) {
          if (/^\d{5,7}-[\dXx]$|^\d{6,8}$/.test(col)) {
            badge = col;
          } else if (MILITARY_RANKS.some((r) => col.toLowerCase().startsWith(r.toLowerCase()))) {
            rank = col;
          } else if (/@/.test(col)) {
            email = col;
          } else if (/(?:\d{2}\s*9?\s*\d{4}[-\s]?\d{4})/.test(col) || /^[\d\s\-\(\)]+$/.test(col)) {
            phone = col;
          } else if (/[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(col) && !col.toLowerCase().includes('vara')) {
            fullName = col;
          }
        }

        if (fullName || badge) {
          officers.push({
            id: `off-${Date.now()}-${officers.length + 1}`,
            rank: normalizeRank(rank),
            badge,
            fullName,
            email,
            phone,
          });
        }
      }
    }
  }

  if (officers.length > 0) {
    return officers;
  }

  // 2. Parser sequencial de blocos de texto (quando copiado de PDF/Word/SEI quebrando linha por linha)
  // Como no exemplo do usuário:
  // 01
  // Cabo PM
  // 116345-0
  // ANTONIO MARCOS CORDEIRO DOS SANTOS
  // 87 9 9914-9872
  let startIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toUpperCase();
    if (l.includes('POSTO') && l.includes('MAT') && l.includes('NOME')) {
      startIndex = i + 1;
      break;
    }
    if (l === 'QTD' || l === 'POSTO' || l === 'NOME' || l === 'MAT' || l === 'CONTATO') {
      // Avança até o fim dos cabeçalhos
      startIndex = i + 1;
    }
  }

  const tableLines = startIndex >= 0 ? lines.slice(startIndex) : lines;

  // Filtrar cabeçalhos remanescentes caso tenham vindo linha a linha
  const dataLines = tableLines.filter(
    (l) => !/^(QTD|QUANTIDADE|POSTO|GRAD|GRADUAÇÃO|MAT|MATR[ÍI]CULA|NOME|NOME COMPLETO|E-MAIL|EMAIL|CONTATO|TELEFONE|WHATSAPP)$/i.test(l)
  );

  let currentOfficer: Partial<ParsedNoticeOfficer> = {};

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];

    // Detectar início de novo policial por contador de linha (ex: "01", "02", "1", "2")
    const isCounter = /^(?:0?[1-9]|[1-9][0-9])\.?$/.test(line);

    if (isCounter) {
      // Salva o anterior se tiver dados válidos
      if (currentOfficer.fullName || currentOfficer.badge) {
        officers.push({
          id: `off-${Date.now()}-${officers.length + 1}`,
          rank: normalizeRank(currentOfficer.rank || 'Sd'),
          badge: currentOfficer.badge || '',
          fullName: currentOfficer.fullName || 'Policial Militar',
          email: currentOfficer.email || '',
          phone: currentOfficer.phone || '',
        });
        currentOfficer = {};
      }
      continue;
    }

    // Detectar Posto/Graduação
    const matchedRank = MILITARY_RANKS.find(
      (r) => line.toLowerCase() === r.toLowerCase() || line.toLowerCase().startsWith(r.toLowerCase() + ' ')
    );
    if (matchedRank && !currentOfficer.rank) {
      currentOfficer.rank = line;
      continue;
    }

    // Detectar Matrícula (ex: 116345-0, 120591-9, 987654)
    if (/^\d{5,7}-[\dXx]$|^\d{6,8}$/.test(line)) {
      currentOfficer.badge = line;
      continue;
    }

    // Detectar E-mail
    if (/@/.test(line)) {
      currentOfficer.email = line;
      continue;
    }

    // Detectar Telefone / Contato (ex: 87 9 9914-9872 ou (81) 98888-7777)
    if (/(?:\d{2}\s*9?\s*\d{4}[-\s]?\d{4})/.test(line) || (/^[\d\s\-\(\)\+]+$/.test(line) && line.replace(/\D/g, '').length >= 8)) {
      currentOfficer.phone = line;
      continue;
    }

    // Se é texto alfabético sem números e tem pelo menos duas palavras, provavelmente é o NOME
    if (
      !currentOfficer.fullName &&
      /[a-zA-ZÀ-ÿ]{2,}\s+[a-zA-ZÀ-ÿ]{2,}/.test(line) &&
      !line.toLowerCase().includes('sala de audi') &&
      !line.toLowerCase().includes('processo') &&
      !line.toLowerCase().includes('link:')
    ) {
      currentOfficer.fullName = line.trim().toUpperCase();
      continue;
    }
  }

  // Adiciona o último policial em processamento
  if (currentOfficer.fullName || currentOfficer.badge) {
    officers.push({
      id: `off-${Date.now()}-${officers.length + 1}`,
      rank: normalizeRank(currentOfficer.rank || 'Sd'),
      badge: currentOfficer.badge || '',
      fullName: currentOfficer.fullName || 'Policial Militar',
      email: currentOfficer.email || '',
      phone: currentOfficer.phone || '',
    });
  }

  return officers;
}
