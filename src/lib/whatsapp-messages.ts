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
 * Detecta se o dispositivo atual é um smartphone ou tablet (iOS/Android)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  const isMobileUA = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(userAgent);
  const isSmallScreen = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  return isMobileUA || isSmallScreen;
}

/**
 * Formata o telefone garantindo o código DDI do Brasil (55)
 */
export function formatFullPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  return clean.length <= 11 ? `55${clean}` : clean;
}

/**
 * Gera a URL adequada para abertura do WhatsApp.
 * - No mobile: usa api.whatsapp.com (ou protocolo whatsapp://) para acionar o app instalado.
 * - No desktop: usa web.whatsapp.com para o navegador, ou whatsapp:// se configurado para app do Windows.
 */
export function createWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
  forceTarget?: 'auto' | 'app' | 'web'
): string {
  const fullPhone = formatFullPhone(phone);
  if (!fullPhone) return '';
  const encodedMsg = encodeURIComponent(message);
  const mobile = isMobileDevice();

  if (forceTarget === 'app' || (mobile && forceTarget !== 'web')) {
    // Protocolo nativo de aplicativo
    return `whatsapp://send?phone=${fullPhone}&text=${encodedMsg}`;
  }

  if (mobile) {
    // Fallback universal mobile
    return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedMsg}`;
  }

  // Desktop Web
  return `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodedMsg}`;
}

// Referência em memória da janela do WhatsApp Web aberta no Desktop
let whatsappWindowRef: Window | null = null;

/**
 * Abre a conversa do WhatsApp:
 * 1. No celular: Aciona diretamente o aplicativo WhatsApp oficial instalado no aparelho.
 * 2. No computador: Reutiliza a mesma aba do WhatsApp Web aberta anteriormente, evitando
 *    a criação de dezenas de abas repetidas, ou aciona o WhatsApp Desktop do Windows caso preferido.
 */
export function openWhatsAppChat(
  phone: string | null | undefined,
  message: string,
  options?: { preferApp?: boolean }
): void {
  const fullPhone = formatFullPhone(phone);
  if (!fullPhone) {
    alert('Número de telefone não informado para este policial.');
    return;
  }

  const encodedMsg = encodeURIComponent(message);
  const mobile = isMobileDevice();
  const preferDesktopApp =
    options?.preferApp ??
    (typeof localStorage !== 'undefined' &&
      localStorage.getItem('whatsapp_desktop_preferred') === 'true');

  if (mobile) {
    // -------------------------------------------------------------
    // NO CELULAR: ABRIR O APLICATIVO NATIVO
    // -------------------------------------------------------------
    // O protocolo whatsapp:// abre o app WhatsApp instantaneamente
    const nativeAppUrl = `whatsapp://send?phone=${fullPhone}&text=${encodedMsg}`;
    const universalWebUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedMsg}`;

    // Tentamos abrir o protocolo nativo
    const clickedAt = Date.now();
    window.location.href = nativeAppUrl;

    // Caso o dispositivo não responda ao protocolo em até 1.5s e a página continue visível
    setTimeout(() => {
      if (Date.now() - clickedAt < 2000 && !document.hidden) {
        window.location.href = universalWebUrl;
      }
    }, 1200);
    return;
  }

  // -------------------------------------------------------------
  // NO COMPUTADOR (DESKTOP)
  // -------------------------------------------------------------
  if (preferDesktopApp) {
    // Se o usuário prefere o aplicativo oficial do WhatsApp para Windows instalado
    window.location.href = `whatsapp://send?phone=${fullPhone}&text=${encodedMsg}`;
    return;
  }

  // WhatsApp Web no navegador:
  const webUrl = `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encodedMsg}`;

  // Se já temos a janela aberta e ela não foi fechada pelo usuário, reaproveitamos navegando nela
  if (whatsappWindowRef && !whatsappWindowRef.closed) {
    try {
      whatsappWindowRef.location.href = webUrl;
      whatsappWindowRef.focus();
      return;
    } catch {
      // Se políticas cross-origin restringirem a atribuição direta do href, abre usando target fixo
    }
  }

  // Abre nova aba e guarda a referência para os próximos cliques
  whatsappWindowRef = window.open(webUrl, 'central_procedimentos_whatsapp');
  if (whatsappWindowRef) {
    whatsappWindowRef.focus();
  }
}


