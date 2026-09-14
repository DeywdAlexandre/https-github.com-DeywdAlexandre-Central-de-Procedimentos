import { Router } from 'express';
import { db } from '../../db/index.ts';
import {
  hearings,
  policeOfficers,
  hearingOfficers,
  hearingReminders,
  systemConfigs,
} from '../../db/schema.ts';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { logAudit } from '../helpers/audit.ts';
import { getTodayDateBR, addDaysBR } from '../../lib/deadline-calculator.ts';

export const remindersRouter = Router();

// GET /api/reminders
remindersRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
    const today = getTodayDateBR();
    const tomorrow = addDaysBR(today, 1);


    // Audiências de amanhã
    const tomHearings = await db
      .select({
        hearingId: hearings.id,
        noticeNumber: hearings.noticeNumber,
        hearingDate: hearings.hearingDate,
        hearingTime: hearings.hearingTime,
        court: hearings.court,
        modality: hearings.modality,
        location: hearings.location,
        status: hearings.status,
        officerId: policeOfficers.id,
        officerName: policeOfficers.fullName,
        officerRank: policeOfficers.rank,
        officerPhone: policeOfficers.phone,
        hearingOfficerId: hearingOfficers.id,
        noticeStatus: hearingOfficers.noticeStatus,
      })
      .from(hearings)
      .innerJoin(hearingOfficers, eq(hearings.id, hearingOfficers.hearingId))
      .innerJoin(policeOfficers, eq(hearingOfficers.officerId, policeOfficers.id))
      .where(and(eq(hearings.hearingDate, tomorrow), sql`${hearings.status} in ('agendada', 'remarcada')`));

    // Histórico recente de tentativas de lembrete
    const attempts = await db
      .select({
        id: hearingReminders.id,
        hearingId: hearingReminders.hearingId,
        officerId: hearingReminders.officerId,
        scheduledFor: hearingReminders.scheduledFor,
        channel: hearingReminders.channel,
        status: hearingReminders.status,
        recipientPhone: hearingReminders.recipientPhone,
        messageBody: hearingReminders.messageBody,
        sentAt: hearingReminders.sentAt,
        sentBy: hearingReminders.sentBy,
        errorMessage: hearingReminders.errorMessage,
        officerName: policeOfficers.fullName,
        officerRank: policeOfficers.rank,
        noticeNumber: hearings.noticeNumber,
        hearingDate: hearings.hearingDate,
        hearingTime: hearings.hearingTime,
        court: hearings.court,
        modality: hearings.modality,
        location: hearings.location,
      })
      .from(hearingReminders)
      .innerJoin(policeOfficers, eq(hearingReminders.officerId, policeOfficers.id))
      .innerJoin(hearings, eq(hearingReminders.hearingId, hearings.id))
      .orderBy(desc(hearingReminders.createdAt))
      .limit(30);

    // Obter template WhatsApp
    const tmplConfig = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, 'whatsapp_template'))
      .limit(1);

    const apiConfig = await db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, 'whatsapp_api_config'))
      .limit(1);

    const defaultTmpl =
      '*AVISO DE CONVOCAÇÃO PARA AUDIÊNCIA JUDICIAL*\n\n' +
      'Prezado(a) *{posto_nome}*,\n' +
      'Informamos que V. Sa. foi requisitado(a) para comparecer à audiência judicial com os seguintes dados:\n\n' +
      '📋 *Processo / Ofício:* {processo}\n' +
      '📅 *Data:* {data}\n' +
      '⏰ *Horário:* {hora}\n' +
      '⚖️ *Vara / Comarca:* {vara}\n' +
      '{link_info}\n' +
      'Favor acusar recebimento e confirmar ciência desta notificação.';

    res.json({
      tomorrowDate: tomorrow,
      tomorrowHearings: tomHearings,
      attempts,
      template: tmplConfig[0]?.value || defaultTmpl,
      apiConfig: apiConfig[0]?.value ? JSON.parse(apiConfig[0].value) : { configured: false },
    });
  } catch (error: any) {
    console.error('Erro ao buscar lembretes:', error);
    res.status(500).json({ error: 'Falha ao buscar lembretes.' });
  }
});

// POST /api/reminders/record-send
remindersRouter.post('/record-send', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const { hearingId, officerId, channel, recipientPhone, messageBody, status, errorMessage } = req.body;

    if (!hearingId || !officerId) {
      return res.status(400).json({ error: 'Audiência e policial são obrigatórios.' });
    }

    const today = getTodayDateBR();
    const idempotencyKey = `rem-${hearingId}-${officerId}-${today}`;

    const [recorded] = await db
      .insert(hearingReminders)
      .values({
        hearingId: Number(hearingId),
        officerId: Number(officerId),
        scheduledFor: today,
        channel: channel || 'whatsapp_manual',
        status: status || 'enviado',
        recipientPhone: recipientPhone || null,
        messageBody: messageBody || null,
        sentAt: status === 'enviado' ? new Date() : null,
        sentBy: req.user!.email,
        errorMessage: errorMessage || null,
        idempotencyKey,
      })
      .onConflictDoUpdate({
        target: hearingReminders.idempotencyKey,
        set: {
          status: status || 'enviado',
          sentAt: status === 'enviado' ? new Date() : null,
          sentBy: req.user!.email,
          errorMessage: errorMessage || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAudit('RECORD_REMINDER', 'reminder', recorded.id, req.user!.email, {
      hearingId,
      officerId,
      status,
      channel,
    });

    res.json(recorded);
  } catch (error: any) {
    console.error('Erro ao registrar envio de lembrete:', error);
    res.status(500).json({ error: 'Falha ao registrar envio de lembrete.' });
  }
});

// PUT /api/reminders/:id/status
remindersRouter.put('/:id/status', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const reminderId = Number(req.params.id);
    const { status, errorMessage, hearingId, officerId } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório.' });
    }

    let updated: any = null;

    if (reminderId && reminderId < 900000) {
      const [resUpdate] = await db
        .update(hearingReminders)
        .set({
          status,
          sentAt: status === 'enviado' || status === 'entregue' ? new Date() : undefined,
          errorMessage: errorMessage || null,
          updatedAt: new Date(),
        })
        .where(eq(hearingReminders.id, reminderId))
        .returning();
      updated = resUpdate;
    }

    // Se o lembrete ainda não estava gravado na tabela mas veio com hearingId e officerId
    if (!updated && hearingId && officerId) {
      const today = getTodayDateBR();
      const idempotencyKey = `rem-${hearingId}-${officerId}-${today}`;

      const [recorded] = await db
        .insert(hearingReminders)
        .values({
          hearingId: Number(hearingId),
          officerId: Number(officerId),
          scheduledFor: today,
          channel: 'whatsapp_manual',
          status: status || 'enviado',
          sentAt: status === 'enviado' || status === 'entregue' ? new Date() : null,
          sentBy: req.user!.email,
          errorMessage: errorMessage || null,
          idempotencyKey,
        })
        .onConflictDoUpdate({
          target: hearingReminders.idempotencyKey,
          set: {
            status: status || 'enviado',
            sentAt: status === 'enviado' || status === 'entregue' ? new Date() : null,
            sentBy: req.user!.email,
            errorMessage: errorMessage || null,
            updatedAt: new Date(),
          },
        })
        .returning();
      updated = recorded;
    }

    if (!updated) {
      return res.status(404).json({ error: 'Lembrete não encontrado.' });
    }

    await logAudit('UPDATE_REMINDER_STATUS', 'reminder', updated.id, req.user!.email, {
      newStatus: status,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar status do lembrete:', error);
    res.status(500).json({ error: 'Falha ao atualizar status do lembrete.' });
  }
});
