import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Usuários autenticados no sistema
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').notNull().default('somente_leitura'), // 'administrador' | 'editor' | 'somente_leitura'
  status: text('status').notNull().default('ativo'), // 'ativo' | 'revogado'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 2. Lista de e-mails autorizados (Allowlist)
export const allowlist = pgTable('allowlist', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  role: text('role').notNull().default('somente_leitura'), // 'administrador' | 'editor' | 'somente_leitura'
  status: text('status').notNull().default('ativo'), // 'ativo' | 'revogado'
  invitedBy: text('invited_by'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Policiais Militares (Cadastro interno compartilhado)
export const policeOfficers = pgTable('police_officers', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull(),
  rank: text('rank').notNull(), // 'Cel' | 'Ten Cel' | 'Maj' | 'Cap' | '1º Ten' | '2º Ten' | 'Subten' | '1º Sgt' | '2º Sgt' | '3º Sgt' | 'Cb' | 'Sd'
  badge: text('badge'), // Matrícula / identificação opcional
  shortName: text('short_name'), // Nome de guerra / abreviado
  aliases: text('aliases'), // Apelidos / variações do nome (ex. "~Tavares", "Diogenes")
  phone: text('phone'), // WhatsApp com DDI/DDD (protegido por permissão)
  active: boolean('active').notNull().default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 4. Procedimentos Disciplinares (PDS e Sindicância)
export const procedures = pgTable('procedures', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(), // Ex.: "PDS nº 001/2026 - 1ª CPM"
  type: text('type').notNull(), // 'PDS' | 'SINDICANCIA'
  seiNumber: text('sei_number'), // Número SEI oficial
  seiUrl: text('sei_url'), // Link do processo no SEI
  ordinanceNumber: text('ordinance_number'), // Número da Portaria
  subject: text('subject').notNull(), // Assunto resumido
  responsible: text('responsible').notNull(), // Encarregado / Responsável na equipe
  startDate: text('start_date').notNull(), // Data do marco inicial (YYYY-MM-DD)
  startEvent: text('start_event').notNull(), // Evento que gerou o marco inicial
  phase: text('phase').notNull().default('Instauração'), // Fase configurável
  archived: boolean('archived').notNull().default(false),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 5. Prazos dos Procedimentos
export const procedureDeadlines = pgTable('procedure_deadlines', {
  id: serial('id').primaryKey(),
  procedureId: integer('procedure_id')
    .references(() => procedures.id)
    .notNull(),
  title: text('title').notNull(), // Ex.: "Defesa Prévia", "Relatório Conclusivo"
  ruleId: text('rule_id'), // ID da regra administrativa usada
  ruleDescription: text('rule_description'), // Discriminação do cálculo (dias corridos/úteis, marco, etc.)
  daysCount: integer('days_count').notNull(),
  daysType: text('days_type').notNull().default('corridos'), // 'corridos' | 'uteis'
  excludeStartDay: boolean('exclude_start_day').notNull().default(true),
  startDate: text('start_date').notNull(), // Data marco inicial (YYYY-MM-DD)
  calculatedEndDate: text('calculated_end_date').notNull(), // Data final calculada
  confirmedEndDate: text('confirmed_end_date'), // Data final confirmada
  isConfirmed: boolean('is_confirmed').notNull().default(false), // Exige confirmação explícita
  manualJustification: text('manual_justification'),
  responsible: text('responsible'),
  status: text('status').notNull().default('proximo'), // 'a_confirmar' | 'proximo' | 'vencido' | 'concluido' | 'suspenso'
  alertDays: text('alert_days').default('15,7,3,1'),
  confirmedBy: text('confirmed_by'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 6. Prorrogações e Suspensões de Prazos (Histórico auditável sem sobrescrever origem)
export const deadlineExtensions = pgTable('deadline_extensions', {
  id: serial('id').primaryKey(),
  deadlineId: integer('deadline_id')
    .references(() => procedureDeadlines.id)
    .notNull(),
  type: text('type').notNull(), // 'prorrogacao' | 'suspensao' | 'reabertura'
  previousDate: text('previous_date').notNull(),
  newDate: text('new_date').notNull(),
  legalBasis: text('legal_basis').notNull(), // Fundamento legal / documento
  reason: text('reason').notNull(),
  performedBy: text('performed_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Andamentos / Linha do Tempo do Procedimento
export const procedureTimeline = pgTable('procedure_timeline', {
  id: serial('id').primaryKey(),
  procedureId: integer('procedure_id')
    .references(() => procedures.id)
    .notNull(),
  actionDate: text('action_date').notNull(), // YYYY-MM-DD
  author: text('author').notNull(),
  description: text('description').notNull(),
  nextStep: text('next_step'),
  seiDocumentRef: text('sei_document_ref'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 8. Audiências Judiciais
export const hearings = pgTable('hearings', {
  id: serial('id').primaryKey(),
  noticeNumber: text('notice_number').notNull(), // Número/identificador do ofício judicial ou processo (ex. 92466419)
  seiNumber: text('sei_number'), // Número SEI
  hearingDate: text('hearing_date').notNull(), // YYYY-MM-DD (America/Recife)
  hearingTime: text('hearing_time').notNull(), // HH:mm (America/Recife)
  court: text('court').notNull(), // Vara / Comarca / Juizado
  modality: text('modality').notNull().default('presencial'), // 'presencial' | 'remota'
  location: text('location'), // Sala / Link de videoconferência
  status: text('status').notNull().default('agendada'), // 'agendada' | 'remarcada' | 'cancelada' | 'realizada' | 'nao_ocorreu'
  didNotOccurReason: text('did_not_occur_reason'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 9. Histórico de Remarcações de Audiências
export const hearingReschedules = pgTable('hearing_reschedules', {
  id: serial('id').primaryKey(),
  hearingId: integer('hearing_id')
    .references(() => hearings.id)
    .notNull(),
  previousDate: text('previous_date').notNull(),
  previousTime: text('previous_time').notNull(),
  newDate: text('new_date').notNull(),
  newTime: text('new_time').notNull(),
  reason: text('reason').notNull(),
  performedBy: text('performed_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 10. Policiais convocados por Audiência e Ofício de Apresentação Interno
export const hearingOfficers = pgTable('hearing_officers', {
  id: serial('id').primaryKey(),
  hearingId: integer('hearing_id')
    .references(() => hearings.id)
    .notNull(),
  officerId: integer('officer_id')
    .references(() => policeOfficers.id)
    .notNull(),
  officialNoticeNumber: text('official_notice_number'), // Número do Ofício de Apresentação interno
  officialNoticeSei: text('official_notice_sei'), // Link ou número SEI do ofício
  issueDate: text('issue_date'), // Data de emissão do ofício
  noticeStatus: text('notice_status').notNull().default('pendente'), // 'pendente' | 'enviado' | 'aguardando_assinatura' | 'assinado' | 'ciencia_registrada' | 'termo_recebido' | 'nao_compareceu'
  signedAt: timestamp('signed_at'),
  acknowledgedAt: timestamp('acknowledged_at'), // Ciência registrada pelo policial
  attendanceTermReceivedAt: timestamp('attendance_term_received_at'), // Termo de comparecimento
  notes: text('notes'),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 11. Tentativas e Controle de Lembretes WhatsApp
export const hearingReminders = pgTable('hearing_reminders', {
  id: serial('id').primaryKey(),
  hearingId: integer('hearing_id')
    .references(() => hearings.id)
    .notNull(),
  officerId: integer('officer_id')
    .references(() => policeOfficers.id)
    .notNull(),
  scheduledFor: text('scheduled_for').notNull(), // Data prevista do lembrete (YYYY-MM-DD)
  channel: text('channel').notNull().default('whatsapp_manual'), // 'whatsapp_manual' | 'whatsapp_api'
  status: text('status').notNull().default('pendente'), // 'pendente' | 'enviado' | 'falhou' | 'cancelado'
  recipientPhone: text('recipient_phone'),
  messageBody: text('message_body'),
  sentAt: timestamp('sent_at'),
  sentBy: text('sent_by'),
  errorMessage: text('error_message'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 12. Configurações Administrativas do Sistema
export const systemConfigs = pgTable('system_configs', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(), // JSON serializado ou texto
  description: text('description'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 13. Auditoria Geral do Sistema
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(), // CREATE, UPDATE, DELETE, EXTEND_DEADLINE, CONFIRM_DEADLINE, SEND_REMINDER, RESCHEDULE_HEARING, ARCHIVE
  entityType: text('entity_type').notNull(), // procedure, deadline, hearing, officer, user, reminder, config
  entityId: text('entity_id'),
  userEmail: text('user_email').notNull(),
  details: text('details'), // JSON string com dados antes/depois
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow(),
});

// RELATIONS
export const proceduresRelations = relations(procedures, ({ many }) => ({
  deadlines: many(procedureDeadlines),
  timeline: many(procedureTimeline),
}));

export const procedureDeadlinesRelations = relations(procedureDeadlines, ({ one, many }) => ({
  procedure: one(procedures, {
    fields: [procedureDeadlines.procedureId],
    references: [procedures.id],
  }),
  extensions: many(deadlineExtensions),
}));

export const deadlineExtensionsRelations = relations(deadlineExtensions, ({ one }) => ({
  deadline: one(procedureDeadlines, {
    fields: [deadlineExtensions.deadlineId],
    references: [procedureDeadlines.id],
  }),
}));

export const procedureTimelineRelations = relations(procedureTimeline, ({ one }) => ({
  procedure: one(procedures, {
    fields: [procedureTimeline.procedureId],
    references: [procedures.id],
  }),
}));

export const hearingsRelations = relations(hearings, ({ many }) => ({
  officers: many(hearingOfficers),
  reschedules: many(hearingReschedules),
  reminders: many(hearingReminders),
}));

export const hearingOfficersRelations = relations(hearingOfficers, ({ one }) => ({
  hearing: one(hearings, {
    fields: [hearingOfficers.hearingId],
    references: [hearings.id],
  }),
  officer: one(policeOfficers, {
    fields: [hearingOfficers.officerId],
    references: [policeOfficers.id],
  }),
}));

export const hearingReschedulesRelations = relations(hearingReschedules, ({ one }) => ({
  hearing: one(hearings, {
    fields: [hearingReschedules.hearingId],
    references: [hearings.id],
  }),
}));

export const hearingRemindersRelations = relations(hearingReminders, ({ one }) => ({
  hearing: one(hearings, {
    fields: [hearingReminders.hearingId],
    references: [hearings.id],
  }),
  officer: one(policeOfficers, {
    fields: [hearingReminders.officerId],
    references: [policeOfficers.id],
  }),
}));
