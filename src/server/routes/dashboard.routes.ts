import { Router, Response } from 'express';
import { db } from '../../db/index.ts';
import {
  procedures,
  procedureDeadlines,
  hearings,
  hearingOfficers,
  policeOfficers,
  hearingReminders,
  auditLogs,
} from '../../db/schema.ts';
import { eq, desc, asc, and, sql, inArray } from 'drizzle-orm';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { getTodayDateBR, addDaysBR } from '../../lib/deadline-calculator.ts';

export const dashboardRouter = Router();

export const handleGetDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const today = getTodayDateBR();
    const in7Days = addDaysBR(today, 7);


    // 1. Procedimentos ativos
    const activeProcedures = await db
      .select({ count: sql<number>`count(*)` })
      .from(procedures)
      .where(and(eq(procedures.archived, false), sql`${procedures.phase} != 'Arquivado'`));

    // 2. Prazos
    const allDeadlines = await db
      .select({
        id: procedureDeadlines.id,
        procedureId: procedureDeadlines.procedureId,
        title: procedureDeadlines.title,
        dueDate: sql<string>`coalesce(${procedureDeadlines.confirmedEndDate}, ${procedureDeadlines.calculatedEndDate})`,
        isConfirmed: procedureDeadlines.isConfirmed,
        status: procedureDeadlines.status,
        procedureCode: procedures.code,
        procedureSubject: procedures.subject,
        responsible: procedureDeadlines.responsible,
      })
      .from(procedureDeadlines)
      .innerJoin(procedures, eq(procedureDeadlines.procedureId, procedures.id))
      .where(and(eq(procedures.archived, false), sql`${procedureDeadlines.status} != 'concluido'`));

    let overdueCount = 0;
    let upcoming7DaysCount = 0;
    const urgentDeadlines: any[] = [];

    allDeadlines.forEach((d) => {
      if (d.status === 'suspenso') return;
      const dDate = d.dueDate || '';
      if (dDate && dDate < today) {
        overdueCount++;
        urgentDeadlines.push({ ...d, urgency: 'vencido' });
      } else if (dDate && dDate <= in7Days) {
        upcoming7DaysCount++;
        urgentDeadlines.push({ ...d, urgency: 'proximo' });
      }
    });

    // 3. Audiências próximas (próximos 15 dias)
    const in15Days = addDaysBR(today, 15);


    const upcomingHearings = await db
      .select({
        id: hearings.id,
        noticeNumber: hearings.noticeNumber,
        hearingDate: hearings.hearingDate,
        hearingTime: hearings.hearingTime,
        court: hearings.court,
        status: hearings.status,
        modality: hearings.modality,
      })
      .from(hearings)
      .where(
        and(
          sql`${hearings.hearingDate} >= ${today}`,
          sql`${hearings.hearingDate} <= ${in15Days}`,
          sql`${hearings.status} in ('agendada', 'remarcada')`
        )
      )
      .orderBy(asc(hearings.hearingDate), asc(hearings.hearingTime));

    // Buscar policiais associados às audiências para exibição correta no painel
    const hearingIds = upcomingHearings.map((h) => h.id);
    const officersByHearing: Record<number, any[]> = {};
    if (hearingIds.length > 0) {
      const associatedOfficers = await db
        .select({
          id: hearingOfficers.id,
          hearingId: hearingOfficers.hearingId,
          officerId: hearingOfficers.officerId,
          noticeStatus: hearingOfficers.noticeStatus,
          officerFullName: policeOfficers.fullName,
          officerRank: policeOfficers.rank,
        })
        .from(hearingOfficers)
        .innerJoin(policeOfficers, eq(hearingOfficers.officerId, policeOfficers.id))
        .where(inArray(hearingOfficers.hearingId, hearingIds));

      associatedOfficers.forEach((ho) => {
        if (!officersByHearing[ho.hearingId]) officersByHearing[ho.hearingId] = [];
        officersByHearing[ho.hearingId].push(ho);
      });
    }

    const enrichedUpcomingHearings = upcomingHearings.map((h) => ({
      ...h,
      officers: officersByHearing[h.id] || [],
    }));

    // 4. Ofícios pendentes de assinatura/ciência
    const pendingNotices = await db
      .select({ count: sql<number>`count(*)` })
      .from(hearingOfficers)
      .where(
        sql`${hearingOfficers.noticeStatus} in ('pendente', 'enviado', 'aguardando_assinatura', 'assinado')`
      );

    // 5. Lembretes pendentes ou com falha
    const pendingReminders = await db
      .select({ count: sql<number>`count(*)` })
      .from(hearingReminders)
      .where(sql`${hearingReminders.status} in ('pendente', 'falhou')`);

    // 6. Últimas movimentações da auditoria
    const recentAudit = await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    res.json({
      metrics: {
        activeProcedures: Number(activeProcedures[0]?.count || 0),
        overdueDeadlines: overdueCount,
        upcomingDeadlines7Days: upcoming7DaysCount,
        upcomingHearings: enrichedUpcomingHearings.length,
        pendingNotices: Number(pendingNotices[0]?.count || 0),
        pendingReminders: Number(pendingReminders[0]?.count || 0),
      },
      urgentDeadlines: urgentDeadlines
        .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
        .slice(0, 10),
      upcomingHearings: enrichedUpcomingHearings.slice(0, 8),
      recentActivity: recentAudit,
    });
  } catch (error: any) {
    console.error('Erro ao montar dashboard:', error);
    res.status(500).json({ error: 'Falha ao carregar indicadores do painel.' });
  }
};

// GET /api/dashboard e GET /api/stats/dashboard
dashboardRouter.get('/dashboard', requireAuth, handleGetDashboardStats);
dashboardRouter.get('/stats/dashboard', requireAuth, handleGetDashboardStats);
