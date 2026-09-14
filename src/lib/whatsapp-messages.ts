import { formatDateBR } from './deadline-calculator.ts';

export interface WhatsAppHearingMessageParams {
  officerRank?: string | null;
  officerName?: string | null;
  processNumber?: string | null; // ou noticeNumber
  hearingDate?: string | null;
  hearingTime?: string | null;
  court?: string | null; // Vara / Comarca
  location?: string | null; // Link ou endereço
  modality?: 'presencial' | 'remota' | string | null;
  officialNoticeNumber?: string | null;
}

/**
 * Monta o texto padronizado para envio via WhatsApp para o policial militar.
 * Contém explicitamente:
 * 1. Posto/Graduação e Nome do Policial
 * 2. Número do Processo / Ofício
 * 3. Data e Hora da Audiência
 * 4. Vara do Processo (Órgão / Comarca)
 * 5. Link da Audiência (se houver e/ou modalidade virtual)
 */
export function buildHearingWhatsAppMessage(params: WhatsAppHearingMessageParams): string {
  const rank = (params.officerRank || '').trim();
  const name = (params.officerName || 'Policial Militar').trim();
  const officerTitle = rank ? `${rank} ${name}` : name;

  const processNum = (params.processNumber || 'Não informado').trim();
  const formattedDate = params.hearingDate ? formatDateBR(params.hearingDate) : 'A definir';
  const time = params.hearingTime ? params.hearingTime.trim() : 'A definir';
  const courtName = (params.court || 'Vara / Juizado não informado').trim();

  const lines: string[] = [
    `*AVISO DE CONVOCAÇÃO PARA AUDIÊNCIA JUDICIAL*`,
    ``,
    `Prezado(a) *${officerTitle}*,`,
    `Informamos que V. Sa. foi requisitado(a) para comparecer à audiência judicial com as seguintes informações:`,
    ``,
    `📋 *Processo / Ofício:* ${processNum}`,
    `📅 *Data:* ${formattedDate}`,
    `⏰ *Horário:* ${time}`,
    `⚖️ *Vara / Comarca:* ${courtName}`,
  ];

  if (params.modality) {
    const modLabel = params.modality === 'remota' ? 'Virtual / Telepresencial' : 'Presencial';
    lines.push(`🏛️ *Modalidade:* ${modLabel}`);
  }

  // Se houver link ou localização informada
  const loc = (params.location || '').trim();
  if (loc) {
    // Se for URL ou contiver link
    const isUrl = /https?:\/\/[^\s]+/i.test(loc) || loc.toLowerCase().startsWith('meet.') || loc.toLowerCase().startsWith('teams.');
    if (isUrl) {
      lines.push(`🔗 *Link de Acesso:* ${loc}`);
    } else {
      lines.push(`📍 *Local / Link:* ${loc}`);
    }
  }

  if (params.officialNoticeNumber) {
    lines.push(`📄 *Ofício de Apresentação Interno:* ${params.officialNoticeNumber.trim()}`);
  }

  lines.push(``);
  lines.push(`Favor acusar o recebimento e confirmar ciência desta notificação.`);

  return lines.join('\n');
}

/**
 * Gera a URL para abertura do WhatsApp Web ou Mobile com a mensagem formatada.
 * Utiliza o protocolo universal api.whatsapp.com / wa.me que funciona perfeitamente
 * tanto com o aplicativo nativo do WhatsApp Desktop instalado no PC quanto no WhatsApp Web.
 */
export function createWhatsAppUrl(phone: string | null | undefined, message: string): string {
  if (!phone) return '';
  const cleanPhone = phone.replace(/\D/g, '');
  // Adiciona código do país 55 caso o número brasileiro não possua
  const fullPhone = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
  const encodedMsg = encodeURIComponent(message);
  return `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodedMsg}`;
}

/**
 * Abre o WhatsApp Web ou Desktop reutilizando a mesma aba/janela ('whatsapp_tab')
 * em vez de abrir uma nova aba a cada clique ('_blank').
 * Caso o usuário já tenha o WhatsApp aberto nessa aba, o navegador apenas navega nela
 * e foca a janela existente.
 */
export function openWhatsAppChat(phone: string | null | undefined, message: string): void {
  const url = createWhatsAppUrl(phone, message);
  if (!url) return;
  // Usar nome fixo de target 'whatsapp_web' reutiliza a mesma aba no navegador
  window.open(url, 'whatsapp_web');
}

