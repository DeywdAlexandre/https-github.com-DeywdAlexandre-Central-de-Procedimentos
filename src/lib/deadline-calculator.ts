export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export interface DeadlineCalculationResult {
  startDate: string;
  calculatedEndDate: string;
  countFirstDay: string;
  daysCount: number;
  daysType: 'corridos' | 'uteis';
  excludeStartDay: boolean;
  breakdown: string;
  holidaysEncountered: Holiday[];
  workingDaysList: string[];
}

export const DEFAULT_PE_HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: 'Confraternização Universal' },
  { date: '2026-02-16', name: 'Carnaval (Ponto Facultativo)' },
  { date: '2026-02-17', name: 'Carnaval (Feriado Estadual)' },
  { date: '2026-03-06', name: 'Data Magna de Pernambuco' },
  { date: '2026-04-03', name: 'Sexta-feira da Paixão' },
  { date: '2026-04-21', name: 'Tiradentes' },
  { date: '2026-05-01', name: 'Dia Mundial do Trabalho' },
  { date: '2026-06-04', name: 'Corpus Christi' },
  { date: '2026-06-24', name: 'São João' },
  { date: '2026-09-07', name: 'Independência do Brasil' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2026-10-28', name: 'Dia do Servidor Público' },
  { date: '2026-11-02', name: 'Finados' },
  { date: '2026-11-15', name: 'Proclamação da República' },
  { date: '2026-11-20', name: 'Dia Nacional de Zumbi e da Consciência Negra' },
  { date: '2026-12-25', name: 'Natal' },
];

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6; // 0: Domingo, 6: Sábado
}

export function formatDateISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return isoDate;
}

/**
 * Retorna a data atual no fuso horário oficial de Pernambuco (America/Recife, UTC-3) no formato YYYY-MM-DD.
 * Evita o bug de virada de dia precoce gerado pelo UTC (que muda de dia às 21h em PE).
 */
export function getTodayDateBR(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Adiciona dias a uma data YYYY-MM-DD mantendo consistência de data.
 */
export function addDaysBR(dateStr: string, days: number): string {
  const d = parseDateISO(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateISO(d);
}


export function calculateDeadline(
  startDateStr: string,
  daysCount: number,
  daysType: 'corridos' | 'uteis' = 'corridos',
  excludeStartDay: boolean = true,
  customHolidays: Holiday[] = DEFAULT_PE_HOLIDAYS
): DeadlineCalculationResult {
  const holidayMap = new Map<string, string>();
  customHolidays.forEach((h) => holidayMap.set(h.date, h.name));

  const initialDate = parseDateISO(startDateStr);
  let current = new Date(initialDate.getTime());

  let countFirstDayDate: Date;
  if (excludeStartDay) {
    // Começa no dia seguinte (ou primeiro dia útil seguinte se for dias úteis)
    current.setUTCDate(current.getUTCDate() + 1);
    if (daysType === 'uteis') {
      while (isWeekend(current) || holidayMap.has(formatDateISO(current))) {
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }
    countFirstDayDate = new Date(current.getTime());
  } else {
    countFirstDayDate = new Date(current.getTime());
  }

  const holidaysEncountered: Holiday[] = [];
  const workingDaysList: string[] = [];
  let daysCounted = 0;

  if (daysType === 'corridos') {
    // Dias corridos
    while (daysCounted < daysCount) {
      const iso = formatDateISO(current);
      if (holidayMap.has(iso)) {
        holidaysEncountered.push({ date: iso, name: holidayMap.get(iso)! });
      }
      daysCounted++;
      if (daysCounted < daysCount) {
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    // Se o último dia de prazo em dias corridos cair em sábado, domingo ou feriado,
    // prorroga-se até o primeiro dia útil subsequente (regra processual geral)
    while (isWeekend(current) || holidayMap.has(formatDateISO(current))) {
      const iso = formatDateISO(current);
      if (holidayMap.has(iso)) {
        holidaysEncountered.push({ date: iso, name: holidayMap.get(iso)! });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else {
    // Dias úteis
    while (daysCounted < daysCount) {
      const iso = formatDateISO(current);
      const isHol = holidayMap.has(iso);
      const isWk = isWeekend(current);

      if (isHol) {
        holidaysEncountered.push({ date: iso, name: holidayMap.get(iso)! });
      }

      if (!isHol && !isWk) {
        workingDaysList.push(iso);
        daysCounted++;
      }

      if (daysCounted < daysCount) {
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }
  }

  const finalDateStr = formatDateISO(current);
  const countFirstDayStr = formatDateISO(countFirstDayDate);

  const breakdownLines = [
    `Marco inicial informado: ${formatDateBR(startDateStr)}`,
    excludeStartDay
      ? `Regra de marco: Exclui dia do marco (início da contagem: ${formatDateBR(countFirstDayStr)})`
      : `Regra de marco: Inclui dia do marco (início da contagem: ${formatDateBR(countFirstDayStr)})`,
    `Tipo de contagem: ${daysCount} dias ${daysType === 'uteis' ? 'úteis' : 'corridos'}`,
    holidaysEncountered.length > 0
      ? `Feriados/pontos no período: ${holidaysEncountered.map((h) => `${formatDateBR(h.date)} (${h.name})`).join(', ')}`
      : 'Nenhum feriado no período computado',
    `Data final proposta: ${formatDateBR(finalDateStr)}`,
  ];

  return {
    startDate: startDateStr,
    calculatedEndDate: finalDateStr,
    countFirstDay: countFirstDayStr,
    daysCount,
    daysType,
    excludeStartDay,
    breakdown: breakdownLines.join('\n'),
    holidaysEncountered,
    workingDaysList,
  };
}
