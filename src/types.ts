export type UserRole = 'administrador' | 'editor' | 'somente_leitura';
export type UserStatus = 'ativo' | 'revogado';

export interface AppUserProfile {
  uid: string;
  email: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  dbId: number;
}

export type UserProfile = AppUserProfile;


export interface ProcedureDeadline {
  id: number;
  procedureId: number;
  title: string;
  ruleId?: string | null;
  ruleDescription?: string | null;
  daysCount: number;
  daysType: 'corridos' | 'uteis';
  excludeStartDay: boolean;
  startDate: string;
  calculatedEndDate: string;
  confirmedEndDate?: string | null;
  isConfirmed: boolean;
  manualJustification?: string | null;
  responsible?: string | null;
  status: 'a_confirmar' | 'proximo' | 'vencido' | 'concluido' | 'suspenso';
  effectiveStatus?: 'a_confirmar' | 'proximo' | 'vencido' | 'concluido' | 'suspenso';
  alertDays?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  procedureCode?: string;
  procedureType?: 'PDS' | 'SINDICANCIA';
  procedureSubject?: string;
  procedureSei?: string | null;
  extensions?: DeadlineExtension[];
}

export interface DeadlineExtension {
  id: number;
  deadlineId: number;
  type: 'prorrogacao' | 'suspensao' | 'reabertura';
  previousDate: string;
  newDate: string;
  legalBasis: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface ProcedureTimelineItem {
  id: number;
  procedureId: number;
  actionDate: string;
  author: string;
  description: string;
  nextStep?: string | null;
  seiDocumentRef?: string | null;
  createdAt?: string;
}

export interface DisciplinaryProcedure {
  id: number;
  code: string;
  type: 'PDS' | 'SINDICANCIA';
  seiNumber?: string | null;
  seiUrl?: string | null;
  ordinanceNumber?: string | null;
  subject: string;
  responsible: string;
  startDate: string;
  startEvent: string;
  phase: string;
  archived: boolean;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deadlines?: ProcedureDeadline[];
  timeline?: ProcedureTimelineItem[];
}

export interface PoliceOfficer {
  id: number;
  fullName: string;
  rank: string;
  badge?: string | null;
  shortName?: string | null;
  aliases?: string | null;
  phone?: string | null;
  active: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface HearingOfficerLink {
  id: number;
  hearingId: number;
  officerId: number;
  officialNoticeNumber?: string | null;
  officialNoticeSei?: string | null;
  issueDate?: string | null;
  noticeStatus:
    | 'pendente'
    | 'enviado'
    | 'aguardando_assinatura'
    | 'assinado'
    | 'ciencia_registrada'
    | 'termo_recebido'
    | 'nao_compareceu';
  signedAt?: string | null;
  acknowledgedAt?: string | null;
  attendanceTermReceivedAt?: string | null;
  notes?: string | null;
  officerFullName: string;
  officerRank: string;
  officerPhone?: string | null;
  officerBadge?: string | null;
}

export interface HearingRescheduleItem {
  id: number;
  hearingId: number;
  previousDate: string;
  previousTime: string;
  newDate: string;
  newTime: string;
  reason: string;
  performedBy: string;
  createdAt: string;
}

export interface JudicialHearing {
  id: number;
  noticeNumber: string;
  seiNumber?: string | null;
  hearingDate: string; // YYYY-MM-DD
  hearingTime: string; // HH:mm
  court: string;
  modality: 'presencial' | 'remota';
  location?: string | null;
  status: 'agendada' | 'remarcada' | 'cancelada' | 'realizada' | 'nao_ocorreu';
  didNotOccurReason?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  officers?: HearingOfficerLink[];
  reschedules?: HearingRescheduleItem[];
  pendingAlerts?: string[];
}

export interface HearingReminder {
  id: number;
  hearingId?: number;
  procedureId?: number;
  officerId?: number;
  targetType: 'audiencia' | 'prazo';
  scheduledFor: string;
  recipientName?: string;
  recipientPhone?: string | null;
  messageText: string;
  status: 'pendente' | 'enviado' | 'entregue' | 'lido' | 'falhou' | 'cancelado';
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  isSynthetic?: boolean;
}

export type HearingReminderAttempt = HearingReminder;


export interface AllowlistEntry {
  id: number;
  email: string;
  name?: string | null;
  role: UserRole;
  status: UserStatus;
  invitedBy?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuditLogEntry {
  id: number;
  action: string;
  entityType: string;
  entityId?: string | null;
  userEmail: string;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  metrics: {
    activeProcedures: number;
    overdueDeadlines: number;
    upcomingDeadlines7Days: number;
    upcomingHearings: number;
    pendingNotices: number;
    pendingReminders: number;
  };
  urgentDeadlines: any[];
  upcomingHearings: JudicialHearing[];
  recentActivity: AuditLogEntry[];
}

export type DashboardMetrics = DashboardStats;

