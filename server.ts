import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { db } from './src/db/index.ts';
import {
  users,
  allowlist,
  policeOfficers,
  procedures,
  procedureDeadlines,
  deadlineExtensions,
  procedureTimeline,
  hearings,
  hearingReschedules,
  hearingOfficers,
  hearingReminders,
  systemConfigs,
  auditLogs,
} from './src/db/schema.ts';
import { eq, desc, asc, and, or, sql, inArray, like, ilike } from 'drizzle-orm';
import { requireAuth, requireEditor, requireAdmin, AuthRequest, INITIAL_BOOTSTRAP_ADMIN } from './src/middleware/auth.ts';
import { calculateDeadline, DEFAULT_PE_HOLIDAYS, formatDateBR, parseDateISO } from './src/lib/deadline-calculator.ts';
import { parseWhatsAppBatch, groupParsedHearings } from './src/lib/whatsapp-batch-parser.ts';
import { parseOfficialNotice } from './src/lib/official-notice-parser.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Helper para registro de Auditoria
async function logAudit(
  action: string,
  entityType: string,
  entityId: string | number,
  userEmail: string,
  details: Record<string, any>,
  ip?: string
) {
  try {
    await db.insert(auditLogs).values({
      action,
      entityType,
      entityId: String(entityId),
      userEmail,
      details: JSON.stringify(details),
      ipAddress: ip || null,
    });
  } catch (err) {
    console.error('Falha ao gravar log de auditoria:', err);
  }
}

// -------------------------------------------------------------
// ROTAS DE AUTENTICAÇÃO E PERFIL
// -------------------------------------------------------------

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({
      user: req.user,
      isBootstrapAdmin: req.user?.email === INITIAL_BOOTSTRAP_ADMIN,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao carregar perfil do usuário.' });
  }
});

// -------------------------------------------------------------
// ROTAS DO PAINEL (DASHBOARD)
// -------------------------------------------------------------

const handleGetDashboardStats = async (req: AuthRequest, res: express.Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const in7DaysDate = new Date();
    in7DaysDate.setDate(in7DaysDate.getDate() + 7);
    const in7Days = in7DaysDate.toISOString().split('T')[0];

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
    const in15DaysDate = new Date();
    in15DaysDate.setDate(in15DaysDate.getDate() + 15);
    const in15Days = in15DaysDate.toISOString().split('T')[0];

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
    let officersByHearing: Record<number, any[]> = {};
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

app.get('/api/dashboard', requireAuth, handleGetDashboardStats);
app.get('/api/stats/dashboard', requireAuth, handleGetDashboardStats);


// -------------------------------------------------------------
// ROTAS DE PROCEDIMENTOS (PDS E SINDICÂNCIA)
// -------------------------------------------------------------

app.get('/api/procedures', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { type, phase, search, showArchived } = req.query;

    let conditions = [];
    if (showArchived !== 'true') {
      conditions.push(eq(procedures.archived, false));
    }
    if (type && (type === 'PDS' || type === 'SINDICANCIA')) {
      conditions.push(eq(procedures.type, type as string));
    }
    if (phase && typeof phase === 'string') {
      conditions.push(eq(procedures.phase, phase));
    }

    const procs = await db
      .select()
      .from(procedures)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(procedures.createdAt));

    // Buscar prazos associados para enriquecer a listagem
    const procIds = procs.map((p) => p.id);
    let deadlinesByProc: Record<number, any[]> = {};
    if (procIds.length > 0) {
      const allDls = await db
        .select()
        .from(procedureDeadlines)
        .where(inArray(procedureDeadlines.procedureId, procIds));
      allDls.forEach((dl) => {
        if (!deadlinesByProc[dl.procedureId]) deadlinesByProc[dl.procedureId] = [];
        deadlinesByProc[dl.procedureId].push(dl);
      });
    }

    let result = procs.map((p) => ({
      ...p,
      deadlines: deadlinesByProc[p.id] || [],
    }));

    if (search && typeof search === 'string') {
      const term = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.code.toLowerCase().includes(term) ||
          (p.seiNumber && p.seiNumber.toLowerCase().includes(term)) ||
          p.subject.toLowerCase().includes(term) ||
          p.responsible.toLowerCase().includes(term)
      );
    }

    res.json(result);
  } catch (error: any) {
    console.error('Erro ao listar procedimentos:', error);
    res.status(500).json({ error: 'Falha ao buscar procedimentos.' });
  }
});

app.get('/api/procedures/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const proc = await db.select().from(procedures).where(eq(procedures.id, id)).limit(1);
    if (!proc.length) {
      return res.status(404).json({ error: 'Procedimento não encontrado.' });
    }

    const deadlines = await db
      .select()
      .from(procedureDeadlines)
      .where(eq(procedureDeadlines.procedureId, id))
      .orderBy(asc(procedureDeadlines.calculatedEndDate));

    // Extensões de prazos
    const dlIds = deadlines.map((d) => d.id);
    let extensionsByDl: Record<number, any[]> = {};
    if (dlIds.length > 0) {
      const exts = await db
        .select()
        .from(deadlineExtensions)
        .where(inArray(deadlineExtensions.deadlineId, dlIds))
        .orderBy(desc(deadlineExtensions.createdAt));
      exts.forEach((e) => {
        if (!extensionsByDl[e.deadlineId]) extensionsByDl[e.deadlineId] = [];
        extensionsByDl[e.deadlineId].push(e);
      });
    }

    const timeline = await db
      .select()
      .from(procedureTimeline)
      .where(eq(procedureTimeline.procedureId, id))
      .orderBy(desc(procedureTimeline.actionDate), desc(procedureTimeline.createdAt));

    res.json({
      ...proc[0],
      deadlines: deadlines.map((d) => ({
        ...d,
        extensions: extensionsByDl[d.id] || [],
      })),
      timeline,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar detalhes do procedimento.' });
  }
});

app.post('/api/procedures', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const {
      code,
      type,
      seiNumber,
      seiUrl,
      ordinanceNumber,
      subject,
      responsible,
      startDate,
      startEvent,
      phase,
      notes,
      initialDeadline,
    } = req.body;

    if (!code || !type || !subject || !responsible || !startDate || !startEvent) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes para o procedimento.' });
    }

    if (type !== 'PDS' && type !== 'SINDICANCIA') {
      return res.status(400).json({ error: 'Tipo inválido. Deve ser "PDS" ou "SINDICANCIA".' });
    }

    const [newProc] = await db
      .insert(procedures)
      .values({
        code,
        type,
        seiNumber: seiNumber || null,
        seiUrl: seiUrl || null,
        ordinanceNumber: ordinanceNumber || null,
        subject,
        responsible,
        startDate,
        startEvent,
        phase: phase || 'Instauração',
        archived: false,
        notes: notes || null,
        createdBy: req.user?.email || 'desconhecido',
      })
      .returning();

    // Movimentação inicial na timeline
    await db.insert(procedureTimeline).values({
      procedureId: newProc.id,
      actionDate: startDate,
      author: req.user?.name || req.user?.email || 'Administração',
      description: `Procedimento autuado. Marco inicial: ${startEvent} em ${formatDateBR(startDate)}.`,
      nextStep: 'Aguardando providências instrutórias e citação/notificação.',
      seiDocumentRef: seiNumber || null,
    });

    // Se fornecido prazo inicial com regra calculada
    if (initialDeadline && initialDeadline.daysCount) {
      const calc = calculateDeadline(
        startDate,
        Number(initialDeadline.daysCount),
        initialDeadline.daysType || 'corridos',
        initialDeadline.excludeStartDay !== false
      );

      await db.insert(procedureDeadlines).values({
        procedureId: newProc.id,
        title: initialDeadline.title || 'Prazo Inicial de Instrução',
        ruleId: initialDeadline.ruleId || null,
        ruleDescription: calc.breakdown,
        daysCount: calc.daysCount,
        daysType: calc.daysType,
        excludeStartDay: calc.excludeStartDay,
        startDate,
        calculatedEndDate: calc.calculatedEndDate,
        confirmedEndDate: initialDeadline.confirmImmediately ? calc.calculatedEndDate : null,
        isConfirmed: initialDeadline.confirmImmediately === true,
        status: initialDeadline.confirmImmediately ? 'proximo' : 'a_confirmar',
        responsible: responsible,
        alertDays: '15,7,3,1',
        confirmedBy: initialDeadline.confirmImmediately ? req.user?.email : null,
        confirmedAt: initialDeadline.confirmImmediately ? new Date() : null,
      });
    }

    await logAudit('CREATE', 'procedure', newProc.id, req.user!.email, { code, type, subject });

    res.status(201).json(newProc);
  } catch (error: any) {
    console.error('Erro ao criar procedimento:', error);
    res.status(500).json({ error: error.message || 'Erro ao criar procedimento.' });
  }
});

app.put('/api/procedures/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { code, type, seiNumber, seiUrl, ordinanceNumber, subject, responsible, phase, notes, archived } =
      req.body;

    const [updated] = await db
      .update(procedures)
      .set({
        code,
        type,
        seiNumber,
        seiUrl,
        ordinanceNumber,
        subject,
        responsible,
        phase,
        notes,
        archived: archived !== undefined ? Boolean(archived) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(procedures.id, id))
      .returning();

    await logAudit('UPDATE', 'procedure', id, req.user!.email, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar procedimento.' });
  }
});

app.post('/api/procedures/:id/timeline', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const procedureId = Number(req.params.id);
    const { actionDate, description, nextStep, seiDocumentRef } = req.body;

    if (!actionDate || !description) {
      return res.status(400).json({ error: 'Data e descrição do andamento são obrigatórios.' });
    }

    const [item] = await db
      .insert(procedureTimeline)
      .values({
        procedureId,
        actionDate,
        author: req.user?.name || req.user?.email || 'Administração',
        description,
        nextStep: nextStep || null,
        seiDocumentRef: seiDocumentRef || null,
      })
      .returning();

    await logAudit('ADD_TIMELINE', 'procedure', procedureId, req.user!.email, { description });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao registrar andamento.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE PRAZOS (CÁLCULO TRANSPARENTE E CONFIRMAÇÃO EXPLÍCITA)
// -------------------------------------------------------------

app.get('/api/deadlines', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { status, procedureId } = req.query;

    let query = db
      .select({
        id: procedureDeadlines.id,
        procedureId: procedureDeadlines.procedureId,
        title: procedureDeadlines.title,
        ruleId: procedureDeadlines.ruleId,
        ruleDescription: procedureDeadlines.ruleDescription,
        daysCount: procedureDeadlines.daysCount,
        daysType: procedureDeadlines.daysType,
        excludeStartDay: procedureDeadlines.excludeStartDay,
        startDate: procedureDeadlines.startDate,
        calculatedEndDate: procedureDeadlines.calculatedEndDate,
        confirmedEndDate: procedureDeadlines.confirmedEndDate,
        isConfirmed: procedureDeadlines.isConfirmed,
        manualJustification: procedureDeadlines.manualJustification,
        responsible: procedureDeadlines.responsible,
        status: procedureDeadlines.status,
        alertDays: procedureDeadlines.alertDays,
        confirmedBy: procedureDeadlines.confirmedBy,
        confirmedAt: procedureDeadlines.confirmedAt,
        procedureCode: procedures.code,
        procedureType: procedures.type,
        procedureSubject: procedures.subject,
        procedureSei: procedures.seiNumber,
      })
      .from(procedureDeadlines)
      .innerJoin(procedures, eq(procedureDeadlines.procedureId, procedures.id))
      .where(eq(procedures.archived, false));

    const all = await query.orderBy(
      asc(sql`coalesce(${procedureDeadlines.confirmedEndDate}, ${procedureDeadlines.calculatedEndDate})`)
    );

    const today = new Date().toISOString().split('T')[0];

    // Atualizar visualmente se vencido
    const enriched = all.map((d) => {
      const targetDate = d.confirmedEndDate || d.calculatedEndDate;
      let effectiveStatus = d.status;
      if (d.status !== 'concluido' && d.status !== 'suspenso') {
        if (!d.isConfirmed) {
          effectiveStatus = 'a_confirmar';
        } else if (targetDate < today) {
          effectiveStatus = 'vencido';
        } else {
          effectiveStatus = 'proximo';
        }
      }
      return {
        ...d,
        effectiveStatus,
        targetDate,
      };
    });

    res.json(enriched);
  } catch (error: any) {
    console.error('Erro ao listar prazos:', error);
    res.status(500).json({ error: 'Falha ao buscar lista de prazos.' });
  }
});

// Pré-cálculo e discriminação sem salvar
app.post('/api/deadlines/calculate', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { startDate, daysCount, daysType, excludeStartDay } = req.body;
    if (!startDate || !daysCount) {
      return res.status(400).json({ error: 'Data marco e quantidade de dias são obrigatórios.' });
    }

    const result = calculateDeadline(
      startDate,
      Number(daysCount),
      daysType || 'corridos',
      excludeStartDay !== false
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha no cálculo do prazo.' });
  }
});

// Criar prazo para um procedimento
app.post('/api/procedures/:id/deadlines', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const procedureId = Number(req.params.id);
    const {
      title,
      ruleId,
      daysCount,
      daysType,
      excludeStartDay,
      startDate,
      manualEndDate,
      manualJustification,
      responsible,
      confirmImmediately,
    } = req.body;

    if (!title || !startDate) {
      return res.status(400).json({ error: 'Título e data do marco são obrigatórios.' });
    }

    let calculatedEndDate = manualEndDate;
    let ruleDescription = '';

    if (daysCount) {
      const calc = calculateDeadline(
        startDate,
        Number(daysCount),
        daysType || 'corridos',
        excludeStartDay !== false
      );
      calculatedEndDate = calc.calculatedEndDate;
      ruleDescription = calc.breakdown;
    } else if (manualEndDate) {
      calculatedEndDate = manualEndDate;
      ruleDescription = `Prazo informado manualmente: vencimento em ${formatDateBR(manualEndDate)}. Justificativa/Fonte: ${manualJustification || 'Não informada'}`;
    } else {
      return res.status(400).json({ error: 'Informe a quantidade de dias ou data final com justificativa.' });
    }

    const isConfirmed = confirmImmediately === true;
    const confirmedEndDate = isConfirmed ? calculatedEndDate : null;

    const [newDeadline] = await db
      .insert(procedureDeadlines)
      .values({
        procedureId,
        title,
        ruleId: ruleId || null,
        ruleDescription,
        daysCount: daysCount ? Number(daysCount) : 0,
        daysType: daysType || 'corridos',
        excludeStartDay: excludeStartDay !== false,
        startDate,
        calculatedEndDate,
        confirmedEndDate,
        isConfirmed,
        manualJustification: manualJustification || null,
        responsible: responsible || null,
        status: isConfirmed ? 'proximo' : 'a_confirmar',
        confirmedBy: isConfirmed ? req.user?.email : null,
        confirmedAt: isConfirmed ? new Date() : null,
      })
      .returning();

    await logAudit('CREATE', 'deadline', newDeadline.id, req.user!.email, {
      procedureId,
      title,
      calculatedEndDate,
      isConfirmed,
    });

    res.status(201).json(newDeadline);
  } catch (error: any) {
    console.error('Erro ao criar prazo:', error);
    res.status(500).json({ error: 'Falha ao registrar prazo.' });
  }
});

// Confirmação explícita de prazo
app.post('/api/deadlines/:id/confirm', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const dl = await db.select().from(procedureDeadlines).where(eq(procedureDeadlines.id, id)).limit(1);
    if (!dl.length) return res.status(404).json({ error: 'Prazo não encontrado.' });

    const finalDate = dl[0].calculatedEndDate;

    const [updated] = await db
      .update(procedureDeadlines)
      .set({
        confirmedEndDate: finalDate,
        isConfirmed: true,
        status: 'proximo',
        confirmedBy: req.user?.email,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(procedureDeadlines.id, id))
      .returning();

    await logAudit('CONFIRM_DEADLINE', 'deadline', id, req.user!.email, {
      confirmedEndDate: finalDate,
      procedureId: dl[0].procedureId,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao confirmar prazo.' });
  }
});

// Prorrogação, suspensão ou reabertura explícita auditável
app.post('/api/deadlines/:id/extend', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { type, newDate, legalBasis, reason } = req.body;

    if (!type || !legalBasis || !reason) {
      return res.status(400).json({ error: 'Tipo, fundamento legal e motivo são obrigatórios.' });
    }

    const [dl] = await db.select().from(procedureDeadlines).where(eq(procedureDeadlines.id, id)).limit(1);
    if (!dl) return res.status(404).json({ error: 'Prazo não encontrado.' });

    const previousDate = dl.confirmedEndDate || dl.calculatedEndDate;

    // Registrar no histórico de prorrogações sem sobrescrever a origem
    await db.insert(deadlineExtensions).values({
      deadlineId: id,
      type, // 'prorrogacao' | 'suspensao' | 'reabertura'
      previousDate,
      newDate: newDate || previousDate,
      legalBasis,
      reason,
      performedBy: req.user!.email,
    });

    let newStatus = dl.status;
    let updateFields: any = { updatedAt: new Date() };

    if (type === 'suspensao') {
      newStatus = 'suspenso';
      updateFields.status = newStatus;
    } else if (type === 'prorrogacao' || type === 'reabertura') {
      newStatus = 'proximo';
      updateFields.status = newStatus;
      if (newDate) {
        updateFields.confirmedEndDate = newDate;
        updateFields.calculatedEndDate = newDate;
      }
    }

    const [updated] = await db
      .update(procedureDeadlines)
      .set(updateFields)
      .where(eq(procedureDeadlines.id, id))
      .returning();

    await logAudit('EXTEND_DEADLINE', 'deadline', id, req.user!.email, {
      type,
      previousDate,
      newDate,
      legalBasis,
      reason,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao prorrogar prazo:', error);
    res.status(500).json({ error: 'Falha ao processar prorrogação/suspensão.' });
  }
});

// Concluir prazo
app.post('/api/deadlines/:id/complete', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [updated] = await db
      .update(procedureDeadlines)
      .set({ status: 'concluido', updatedAt: new Date() })
      .where(eq(procedureDeadlines.id, id))
      .returning();

    await logAudit('COMPLETE_DEADLINE', 'deadline', id, req.user!.email, { status: 'concluido' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao concluir prazo.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE POLICIAIS MILITARES (CADASTRO INTERNO)
// -------------------------------------------------------------

app.get('/api/officers', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { search, activeOnly } = req.query;

    let conditions = [];
    if (activeOnly === 'true') {
      conditions.push(eq(policeOfficers.active, true));
    }

    let list = await db
      .select()
      .from(policeOfficers)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(policeOfficers.rank), asc(policeOfficers.fullName));

    if (search && typeof search === 'string') {
      const term = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.fullName.toLowerCase().includes(term) ||
          (o.shortName && o.shortName.toLowerCase().includes(term)) ||
          (o.badge && o.badge.toLowerCase().includes(term)) ||
          (o.aliases && o.aliases.toLowerCase().includes(term))
      );
    }

    // Proteger telefone conforme permissão (se somente leitura, mascarar dígitos finais)
    const isEditorOrAdmin = req.user?.role === 'editor' || req.user?.role === 'administrador';
    const sanitized = list.map((o) => ({
      ...o,
      phone: isEditorOrAdmin
        ? o.phone
        : o.phone
        ? o.phone.replace(/(\d{4})$/, '****')
        : null,
    }));

    res.json(sanitized);
  } catch (error: any) {
    console.error('Erro ao listar policiais:', error);
    res.status(500).json({ error: 'Falha ao buscar policiais.' });
  }
});

app.post('/api/officers', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const { fullName, rank, badge, shortName, aliases, phone, notes } = req.body;
    if (!fullName || !rank) {
      return res.status(400).json({ error: 'Nome completo e graduação/posto são obrigatórios.' });
    }

    const [newOfficer] = await db
      .insert(policeOfficers)
      .values({
        fullName,
        rank,
        badge: badge || null,
        shortName: shortName || fullName.split(' ')[0],
        aliases: aliases || null,
        phone: phone || null,
        notes: notes || null,
        active: true,
      })
      .returning();

    await logAudit('CREATE', 'police_officer', newOfficer.id, req.user!.email, { fullName, rank });
    res.status(201).json(newOfficer);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao cadastrar policial.' });
  }
});

app.put('/api/officers/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { fullName, rank, badge, shortName, aliases, phone, active, notes } = req.body;

    const [updated] = await db
      .update(policeOfficers)
      .set({
        fullName,
        rank,
        badge,
        shortName,
        aliases,
        phone,
        active: active !== undefined ? Boolean(active) : undefined,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(policeOfficers.id, id))
      .returning();

    await logAudit('UPDATE', 'police_officer', id, req.user!.email, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar policial.' });
  }
});

// Excluir policial militar do sistema
app.delete('/api/officers/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);

    // Verificar se o policial existe
    const [officer] = await db
      .select()
      .from(policeOfficers)
      .where(eq(policeOfficers.id, id))
      .limit(1);

    if (!officer) {
      return res.status(404).json({ error: 'Policial militar não encontrado.' });
    }

    // Remover registros vinculados em hearingReminders e hearingOfficers para manter integridade
    await db.delete(hearingReminders).where(eq(hearingReminders.officerId, id));
    await db.delete(hearingOfficers).where(eq(hearingOfficers.officerId, id));

    // Excluir policial
    await db.delete(policeOfficers).where(eq(policeOfficers.id, id));

    await logAudit('DELETE', 'police_officer', id, req.user!.email, {
      fullName: officer.fullName,
      rank: officer.rank,
      badge: officer.badge,
    });

    res.json({ success: true, message: 'Policial militar excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir policial:', error);
    res.status(500).json({ error: 'Falha ao excluir policial militar.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE AUDIÊNCIAS JUDICIAIS E OFÍCIOS DE APRESENTAÇÃO
// -------------------------------------------------------------

app.get('/api/hearings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { month, year, status, officerId } = req.query;

    const allHearings = await db
      .select()
      .from(hearings)
      .orderBy(asc(hearings.hearingDate), asc(hearings.hearingTime));

    // Buscar relações muitos-para-muitos com policiais e ofícios
    const hIds = allHearings.map((h) => h.id);
    let officersByHearing: Record<number, any[]> = {};
    let reschedulesByHearing: Record<number, any[]> = {};

    if (hIds.length > 0) {
      const hOfficers = await db
        .select({
          id: hearingOfficers.id,
          hearingId: hearingOfficers.hearingId,
          officerId: hearingOfficers.officerId,
          officialNoticeNumber: hearingOfficers.officialNoticeNumber,
          officialNoticeSei: hearingOfficers.officialNoticeSei,
          issueDate: hearingOfficers.issueDate,
          noticeStatus: hearingOfficers.noticeStatus,
          signedAt: hearingOfficers.signedAt,
          acknowledgedAt: hearingOfficers.acknowledgedAt,
          attendanceTermReceivedAt: hearingOfficers.attendanceTermReceivedAt,
          notes: hearingOfficers.notes,
          officerFullName: policeOfficers.fullName,
          officerRank: policeOfficers.rank,
          officerPhone: policeOfficers.phone,
          officerBadge: policeOfficers.badge,
        })
        .from(hearingOfficers)
        .innerJoin(policeOfficers, eq(hearingOfficers.officerId, policeOfficers.id))
        .where(inArray(hearingOfficers.hearingId, hIds));

      hOfficers.forEach((ho) => {
        if (!officersByHearing[ho.hearingId]) officersByHearing[ho.hearingId] = [];
        officersByHearing[ho.hearingId].push(ho);
      });

      const reschedules = await db
        .select()
        .from(hearingReschedules)
        .where(inArray(hearingReschedules.hearingId, hIds))
        .orderBy(desc(hearingReschedules.createdAt));

      reschedules.forEach((rs) => {
        if (!reschedulesByHearing[rs.hearingId]) reschedulesByHearing[rs.hearingId] = [];
        reschedulesByHearing[rs.hearingId].push(rs);
      });
    }

    let enriched = allHearings.map((h) => {
      const polList = officersByHearing[h.id] || [];
      const reschedList = reschedulesByHearing[h.id] || [];

      // Verificar pendências pós-audiência (se audiência já passou e faltam termos/assinatura)
      const today = new Date().toISOString().split('T')[0];
      const isPast = h.hearingDate < today;
      const pendingItems: string[] = [];

      polList.forEach((pol) => {
        if (pol.noticeStatus === 'pendente' || pol.noticeStatus === 'aguardando_assinatura') {
          pendingItems.push(`${pol.officerRank} ${pol.officerFullName}: Aguarda assinatura do ofício`);
        }
        if (!pol.acknowledgedAt && pol.noticeStatus !== 'ciencia_registrada' && pol.noticeStatus !== 'termo_recebido') {
          pendingItems.push(`${pol.officerRank} ${pol.officerFullName}: Ciência não confirmada`);
        }
        // Se a audiência já foi explicitamente marcada como 'realizada' ou o termo foi dispensado (isPast),
        // só alertar falta de termo se a audiência NÃO estiver marcada como 'realizada' com termo dispensado
        if (isPast && !pol.attendanceTermReceivedAt && h.status === 'realizada') {
          // Se as notas ou status indicar que o termo foi dispensado/negligenciado pela vara, não alertar
          const termWaived = (h.notes && h.notes.includes('[Termo dispensado/não emitido pela vara]')) ||
            (pol.notes && pol.notes.includes('[Termo dispensado/não emitido pelo juízo]'));
          if (!termWaived) {
            pendingItems.push(`${pol.officerRank} ${pol.officerFullName}: Falta termo de comparecimento pós-audiência`);
          }
        }
      });

      return {
        ...h,
        officers: polList,
        reschedules: reschedList,
        pendingAlerts: pendingItems,
      };
    });

    if (status && typeof status === 'string') {
      enriched = enriched.filter((h) => h.status === status);
    }
    if (officerId) {
      const oid = Number(officerId);
      enriched = enriched.filter((h) => h.officers.some((o: any) => o.officerId === oid));
    }
    if (month && year) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      enriched = enriched.filter((h) => h.hearingDate.startsWith(prefix));
    }

    res.json(enriched);
  } catch (error: any) {
    console.error('Erro ao buscar audiências:', error);
    res.status(500).json({ error: 'Falha ao carregar audiências.' });
  }
});

app.post('/api/hearings', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const {
      noticeNumber,
      seiNumber,
      hearingDate,
      hearingTime,
      court,
      modality,
      location,
      notes,
      officers, // array de { officerId, officialNoticeNumber, officialNoticeSei }
    } = req.body;

    if (!noticeNumber || !hearingDate || !hearingTime || !court) {
      return res.status(400).json({ error: 'Número do ofício/processo, data, hora e vara são obrigatórios.' });
    }

    const [newHearing] = await db
      .insert(hearings)
      .values({
        noticeNumber,
        seiNumber: seiNumber || null,
        hearingDate,
        hearingTime,
        court,
        modality: modality || 'presencial',
        location: location || null,
        status: 'agendada',
        notes: notes || null,
        createdBy: req.user!.email,
      })
      .returning();

    // Inserir policiais associados e ofícios de apresentação
    if (Array.isArray(officers) && officers.length > 0) {
      for (const off of officers) {
        await db.insert(hearingOfficers).values({
          hearingId: newHearing.id,
          officerId: Number(off.officerId),
          officialNoticeNumber: off.officialNoticeNumber || null,
          officialNoticeSei: off.officialNoticeSei || null,
          issueDate: new Date().toISOString().split('T')[0],
          noticeStatus: off.noticeStatus || 'pendente',
          notes: off.notes || null,
        });
      }
    }

    await logAudit('CREATE', 'hearing', newHearing.id, req.user!.email, {
      noticeNumber,
      hearingDate,
      court,
      officersCount: officers?.length || 0,
    });

    res.status(201).json(newHearing);
  } catch (error: any) {
    console.error('Erro ao criar audiência:', error);
    res.status(500).json({ error: 'Falha ao registrar audiência.' });
  }
});

// Remarcação de audiência
app.post('/api/hearings/:id/reschedule', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { newDate, newTime, reason } = req.body;

    if (!newDate || !newTime || !reason) {
      return res.status(400).json({ error: 'Nova data, nova hora e motivo são obrigatórios.' });
    }

    const [hearing] = await db.select().from(hearings).where(eq(hearings.id, id)).limit(1);
    if (!hearing) return res.status(404).json({ error: 'Audiência não encontrada.' });

    // Salvar no histórico de remarcações
    await db.insert(hearingReschedules).values({
      hearingId: id,
      previousDate: hearing.hearingDate,
      previousTime: hearing.hearingTime,
      newDate,
      newTime,
      reason,
      performedBy: req.user!.email,
    });

    // Atualizar audiência
    const [updated] = await db
      .update(hearings)
      .set({
        hearingDate: newDate,
        hearingTime: newTime,
        status: 'remarcada',
        updatedAt: new Date(),
      })
      .where(eq(hearings.id, id))
      .returning();

    // Invalidar lembretes antigos para esta audiência
    await db
      .update(hearingReminders)
      .set({ status: 'cancelado', errorMessage: 'Audiência remarcada' })
      .where(eq(hearingReminders.hearingId, id));

    await logAudit('RESCHEDULE_HEARING', 'hearing', id, req.user!.email, {
      previousDate: hearing.hearingDate,
      newDate,
      newTime,
      reason,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao remarcar audiência:', error);
    res.status(500).json({ error: 'Falha ao remarcar audiência.' });
  }
});

// Registrar que audiência não ocorreu
app.post('/api/hearings/:id/did-not-occur', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'O motivo pelo qual a audiência não ocorreu é obrigatório.' });
    }

    const [updated] = await db
      .update(hearings)
      .set({
        status: 'nao_ocorreu',
        didNotOccurReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(hearings.id, id))
      .returning();

    await logAudit('HEARING_DID_NOT_OCCUR', 'hearing', id, req.user!.email, { reason });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao registrar ocorrência.' });
  }
});

// Marcar audiência como Realizada (mesmo sem termo de comparecimento emitido pela vara)
app.post('/api/hearings/:id/complete-without-term', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { note } = req.body || {};

    const [hearing] = await db.select().from(hearings).where(eq(hearings.id, id)).limit(1);
    if (!hearing) {
      return res.status(404).json({ error: 'Audiência não encontrada.' });
    }

    const notePrefix = '[Termo dispensado/não emitido pela vara]';
    const updatedNotes = hearing.notes
      ? hearing.notes.includes(notePrefix)
        ? hearing.notes
        : `${hearing.notes}\n${notePrefix}${note ? `: ${note}` : ''}`
      : `${notePrefix}${note ? `: ${note}` : ''}`;

    const [updated] = await db
      .update(hearings)
      .set({
        status: 'realizada',
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(hearings.id, id))
      .returning();

    await logAudit('HEARING_COMPLETED_WITHOUT_TERM', 'hearing', id, req.user!.email, {
      note: note || 'Audiência confirmada como realizada sem termo emitido pelo juízo',
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao marcar audiência como realizada sem termo:', error);
    res.status(500).json({ error: 'Falha ao atualizar status da audiência.' });
  }
});

// Atualizar status do ofício de apresentação por policial
app.put('/api/hearings/officers/:id/notice', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const {
      officialNoticeNumber,
      officialNoticeSei,
      noticeStatus,
      signed,
      acknowledged,
      attendanceTermReceived,
      notes,
    } = req.body;

    let updateData: any = {
      updatedAt: new Date(),
      updatedBy: req.user!.email,
    };

    if (officialNoticeNumber !== undefined) updateData.officialNoticeNumber = officialNoticeNumber;
    if (officialNoticeSei !== undefined) updateData.officialNoticeSei = officialNoticeSei;
    if (noticeStatus !== undefined) updateData.noticeStatus = noticeStatus;
    if (notes !== undefined) updateData.notes = notes;

    if (signed === true) updateData.signedAt = new Date();
    if (acknowledged === true) updateData.acknowledgedAt = new Date();
    if (attendanceTermReceived === true) updateData.attendanceTermReceivedAt = new Date();

    const [updated] = await db
      .update(hearingOfficers)
      .set(updateData)
      .where(eq(hearingOfficers.id, id))
      .returning();

    await logAudit('UPDATE_NOTICE_STATUS', 'hearing_officer', id, req.user!.email, updateData);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar ofício de apresentação.' });
  }
});

// Excluir audiência judicial do sistema
app.delete('/api/hearings/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);

    // Verificar se audiência existe
    const [hearing] = await db
      .select()
      .from(hearings)
      .where(eq(hearings.id, id))
      .limit(1);

    if (!hearing) {
      return res.status(404).json({ error: 'Audiência judicial não encontrada.' });
    }

    // Excluir em cascata registros vinculados para integridade relacional
    await db.delete(hearingReminders).where(eq(hearingReminders.hearingId, id));
    await db.delete(hearingOfficers).where(eq(hearingOfficers.hearingId, id));
    await db.delete(hearingReschedules).where(eq(hearingReschedules.hearingId, id));

    // Excluir a audiência
    await db.delete(hearings).where(eq(hearings.id, id));

    await logAudit('DELETE', 'hearing', id, req.user!.email, {
      noticeNumber: hearing.noticeNumber,
      hearingDate: hearing.hearingDate,
      court: hearing.court,
    });

    res.json({ success: true, message: 'Audiência judicial excluída com sucesso.' });
  } catch (error: any) {
    console.error('Erro ao excluir audiência:', error);
    res.status(500).json({ error: 'Falha ao excluir audiência judicial.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE IMPORTAÇÃO EM LOTE DE AUDIÊNCIAS (WHATSAPP)
// -------------------------------------------------------------

app.post('/api/batch/preview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'Nenhum texto informado para importação.' });
    }

    const parsedLines = parseWhatsAppBatch(rawText);

    // Cruzar com cadastro existente de policiais (por nome ou apelido)
    const existingOfficers = await db.select().from(policeOfficers);
    const existingHearings = await db.select().from(hearings);

    // Mapeamento tolerante de policiais
    parsedLines.forEach((item) => {
      const itemLower = item.officerName.toLowerCase().trim();
      const match = existingOfficers.find((o) => {
        const fullLower = o.fullName.toLowerCase();
        const shortLower = o.shortName ? o.shortName.toLowerCase() : '';
        const aliases = o.aliases ? o.aliases.toLowerCase() : '';
        return (
          fullLower.includes(itemLower) ||
          (shortLower && (shortLower.includes(itemLower) || itemLower.includes(shortLower))) ||
          (aliases && aliases.includes(itemLower))
        );
      });

      if (match) {
        item.matchedOfficerId = match.id;
        item.matchedOfficerName = `${match.rank} ${match.fullName}`;
      }

      // Checar se audiência já existe no banco (mesmo ofício e data)
      if (item.noticeNumber && item.hearingDate) {
        const dup = existingHearings.find(
          (h) => h.noticeNumber === item.noticeNumber && h.hearingDate === item.hearingDate
        );
        if (dup) {
          item.status = 'duplicado';
          item.issues.push(`Audiência com mesmo ofício (${item.noticeNumber}) e data (${formatDateBR(item.hearingDate)}) já cadastrada no sistema`);
        }
      }
    });

    const grouped = groupParsedHearings(parsedLines);

    res.json({
      totalLines: parsedLines.length,
      lines: parsedLines,
      groups: grouped,
      summary: {
        pronto: parsedLines.filter((l) => l.status === 'pronto').length,
        revisar: parsedLines.filter((l) => l.status === 'revisar').length,
        duplicado: parsedLines.filter((l) => l.status === 'duplicado').length,
      },
    });
  } catch (error: any) {
    console.error('Erro no preview de importação:', error);
    res.status(500).json({ error: 'Falha ao processar prévia da importação.' });
  }
});

// Confirmar importação em lote persistindo no Cloud SQL
app.post('/api/batch/commit', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const { groups } = req.body;
    if (!Array.isArray(groups) || groups.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro validado para salvar.' });
    }

    let createdHearingsCount = 0;
    let associatedOfficersCount = 0;
    const errors: string[] = [];

    for (const group of groups) {
      try {
        if (!group.noticeNumber || !group.hearingDate || !group.hearingTime) {
          errors.push(`Grupo ${group.groupKey} com dados essenciais faltando.`);
          continue;
        }

        // Criar audiência
        const [newH] = await db
          .insert(hearings)
          .values({
            noticeNumber: group.noticeNumber,
            hearingDate: group.hearingDate,
            hearingTime: group.hearingTime,
            court: group.court || 'Vara da Justiça Militar Estadual',
            modality: group.modality || 'presencial',
            status: 'agendada',
            createdBy: req.user!.email,
          })
          .returning();

        createdHearingsCount++;

        // Associar policiais
        for (const off of group.officers) {
          let officerId = off.matchedOfficerId;

          // Se policial não existir no banco, cadastrar automaticamente com dados iniciais
          if (!officerId) {
            const [newPol] = await db
              .insert(policeOfficers)
              .values({
                fullName: off.officerName,
                rank: off.rank || 'Sd',
                badge: off.badge || null,
                shortName: off.officerName,
                active: true,
                notes: 'Cadastrado automaticamente via importação em lote de mensagem de WhatsApp',
              })
              .returning();
            officerId = newPol.id;
          }

          // Associar à audiência com ofício pendente
          await db.insert(hearingOfficers).values({
            hearingId: newH.id,
            officerId,
            officialNoticeNumber: group.noticeNumber,
            issueDate: new Date().toISOString().split('T')[0],
            noticeStatus: 'pendente',
          });

          associatedOfficersCount++;
        }
      } catch (grpErr: any) {
        errors.push(`Erro ao importar grupo ${group.groupKey}: ${grpErr.message}`);
      }
    }

    await logAudit('BATCH_IMPORT_HEARINGS', 'hearing', 'multiple', req.user!.email, {
      createdHearingsCount,
      associatedOfficersCount,
      errorsCount: errors.length,
    });

    res.json({
      success: true,
      createdHearingsCount,
      associatedOfficersCount,
      errors,
    });
  } catch (error: any) {
    console.error('Erro ao efetivar importação:', error);
    res.status(500).json({ error: 'Falha ao salvar audiências importadas.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE IMPORTAÇÃO INDIVIDUAL DE OFÍCIO JUDICIAL
// -------------------------------------------------------------

// Pré-visualização e análise de texto copiado de Ofício
app.post('/api/official-notice/preview', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Texto do ofício não informado.' });
    }

    const parsed = parseOfficialNotice(rawText);

    // Carregar policiais cadastrados para cruzar por matrícula ou nome
    const existingOfficers = await db.select().from(policeOfficers);
    const existingHearings = await db.select().from(hearings);

    // Cruzar cada policial detectado
    parsed.officers = parsed.officers.map((off) => {
      let matchedOfficerId: number | undefined;
      let matchedOfficerName: string | undefined;
      let isNew = true;

      // 1. Tentar por matrícula
      if (off.badge) {
        const cleanBadge = off.badge.replace(/[^0-9]/g, '');
        const matchByBadge = existingOfficers.find((o) => {
          if (!o.badge) return false;
          const oClean = o.badge.replace(/[^0-9]/g, '');
          return oClean === cleanBadge || o.badge.trim() === off.badge.trim();
        });
        if (matchByBadge) {
          matchedOfficerId = matchByBadge.id;
          matchedOfficerName = `${matchByBadge.rank} ${matchByBadge.fullName}`;
          isNew = false;
        }
      }

      // 2. Tentar por nome completo ou partes
      if (!matchedOfficerId && off.fullName) {
        const offNameLower = off.fullName.toLowerCase().trim();
        const matchByName = existingOfficers.find((o) => {
          const oFullLower = o.fullName.toLowerCase().trim();
          const oShortLower = o.shortName ? o.shortName.toLowerCase().trim() : '';
          return (
            oFullLower === offNameLower ||
            (offNameLower.length > 5 && oFullLower.includes(offNameLower)) ||
            (oFullLower.length > 5 && offNameLower.includes(oFullLower)) ||
            (oShortLower && (oShortLower === offNameLower || offNameLower.includes(oShortLower)))
          );
        });
        if (matchByName) {
          matchedOfficerId = matchByName.id;
          matchedOfficerName = `${matchByName.rank} ${matchByName.fullName}`;
          isNew = false;
        }
      }

      return {
        ...off,
        matchedOfficerId,
        matchedOfficerName,
        isNew,
      };
    });

    // Verificar duplicidade de audiência
    let duplicateHearing: any = null;
    if (parsed.hearingDate) {
      const matchNotice = existingHearings.find(
        (h) =>
          (h.noticeNumber === parsed.noticeNumber || (parsed.processNumber && h.noticeNumber.includes(parsed.processNumber))) &&
          h.hearingDate === parsed.hearingDate
      );
      if (matchNotice) {
        duplicateHearing = {
          id: matchNotice.id,
          noticeNumber: matchNotice.noticeNumber,
          hearingDate: matchNotice.hearingDate,
          hearingTime: matchNotice.hearingTime,
          court: matchNotice.court,
          status: matchNotice.status,
        };
      }
    }

    res.json({
      parsed,
      duplicateHearing,
    });
  } catch (error: any) {
    console.error('Erro no parser do ofício:', error);
    res.status(500).json({ error: 'Falha ao processar texto do ofício judicial.' });
  }
});

// Salvar audiência importada do ofício
app.post('/api/official-notice/commit', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const {
      noticeNumber,
      processNumber,
      seiNumber,
      hearingDate,
      hearingTime,
      court,
      modality,
      location,
      notes,
      officers,
    } = req.body;

    if (!noticeNumber || !hearingDate || !hearingTime || !court) {
      return res.status(400).json({
        error: 'Número de referência/processo, data, horário e vara são obrigatórios.',
      });
    }

    // 1. Inserir audiência
    const [newHearing] = await db
      .insert(hearings)
      .values({
        noticeNumber: noticeNumber.trim(),
        seiNumber: seiNumber ? seiNumber.trim() : null,
        hearingDate,
        hearingTime,
        court: court.trim(),
        modality: modality || 'presencial',
        location: location ? location.trim() : null,
        notes: notes ? notes.trim() : null,
        status: 'agendada',
        createdBy: req.user!.email,
      })
      .returning();

    // 2. Processar policiais convocados
    const associatedOfficers = [];
    const officersList = Array.isArray(officers) ? officers : [];

    for (const off of officersList) {
      let officerId = off.matchedOfficerId;

      // Se não veio com matchedOfficerId, tentar buscar por matrícula ou nome antes de inserir
      if (!officerId && off.badge) {
        const cleanBadge = off.badge.replace(/[^0-9]/g, '');
        const allPol = await db.select().from(policeOfficers);
        const match = allPol.find((p) => {
          if (!p.badge) return false;
          return p.badge.replace(/[^0-9]/g, '') === cleanBadge || p.badge.trim() === off.badge.trim();
        });
        if (match) officerId = match.id;
      }

      if (!officerId && off.fullName) {
        const offName = off.fullName.trim().toLowerCase();
        const allPol = await db.select().from(policeOfficers);
        const match = allPol.find((p) => p.fullName.trim().toLowerCase() === offName);
        if (match) officerId = match.id;
      }

      // Se for realmente um novo policial, cadastrar com perfil completo no diretório
      if (!officerId) {
        const [newPol] = await db
          .insert(policeOfficers)
          .values({
            fullName: off.fullName.trim(),
            rank: off.rank || 'Sd',
            badge: off.badge ? off.badge.trim() : null,
            phone: off.phone ? off.phone.trim() : null,
            shortName: off.fullName.trim(),
            active: true,
            notes: `Cadastrado automaticamente via importação de Ofício Judicial (${noticeNumber})`,
          })
          .returning();
        officerId = newPol.id;
      } else {
        // Se já existe, enriquecer os dados que porventura estejam vazios (telefone, matrícula)
        const [existing] = await db
          .select({ phone: policeOfficers.phone, badge: policeOfficers.badge })
          .from(policeOfficers)
          .where(eq(policeOfficers.id, officerId))
          .limit(1);

        const updateFields: any = {};
        if (existing) {
          if (!existing.phone && off.phone) {
            updateFields.phone = off.phone.trim();
          }
          if (!existing.badge && off.badge) {
            updateFields.badge = off.badge.trim();
          }
          if (Object.keys(updateFields).length > 0) {
            updateFields.updatedAt = new Date();
            await db
              .update(policeOfficers)
              .set(updateFields)
              .where(eq(policeOfficers.id, officerId));
          }
        }
      }

      // Associar à audiência em hearingOfficers
      const [link] = await db
        .insert(hearingOfficers)
        .values({
          hearingId: newHearing.id,
          officerId,
          officialNoticeNumber: noticeNumber.trim(),
          issueDate: new Date().toISOString().split('T')[0],
          noticeStatus: 'pendente',
          notes: off.email ? `E-mail: ${off.email}` : null,
        })
        .returning();

      associatedOfficers.push(link);
    }

    // Registrar log de auditoria detalhado
    await logAudit('IMPORT_OFFICIAL_NOTICE_HEARING', 'hearing', newHearing.id, req.user!.email, {
      noticeNumber,
      processNumber,
      hearingDate,
      hearingTime,
      court,
      modality,
      officersCount: associatedOfficers.length,
    });

    res.json({
      success: true,
      hearing: newHearing,
      associatedOfficersCount: associatedOfficers.length,
    });
  } catch (error: any) {
    console.error('Erro ao salvar audiência do ofício:', error);
    res.status(500).json({ error: 'Falha ao registrar audiência importada do ofício.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE LEMBRETES E NOTIFICAÇÕES (WHATSAPP)
// -------------------------------------------------------------

app.get('/api/reminders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

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

// Registrar envio manual ou tentativa de envio de lembrete
app.post('/api/reminders/record-send', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const { hearingId, officerId, channel, recipientPhone, messageBody, status, errorMessage } = req.body;

    if (!hearingId || !officerId) {
      return res.status(400).json({ error: 'Audiência e policial são obrigatórios.' });
    }

    const today = new Date().toISOString().split('T')[0];
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

// Atualizar status de um lembrete existente
app.put('/api/reminders/:id/status', requireAuth, requireEditor, async (req: AuthRequest, res) => {
  try {
    const reminderId = Number(req.params.id);
    const { status, errorMessage } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status é obrigatório.' });
    }

    const [updated] = await db
      .update(hearingReminders)
      .set({
        status,
        sentAt: status === 'enviado' || status === 'entregue' ? new Date() : undefined,
        errorMessage: errorMessage || null,
        updatedAt: new Date(),
      })
      .where(eq(hearingReminders.id, reminderId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Lembrete não encontrado.' });
    }

    await logAudit('UPDATE_REMINDER_STATUS', 'reminder', reminderId, req.user!.email, {
      newStatus: status,
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Erro ao atualizar status do lembrete:', error);
    res.status(500).json({ error: 'Falha ao atualizar status do lembrete.' });
  }
});


// -------------------------------------------------------------
// ROTAS DE EQUIPE E CONTROLE DE ACESSO (ALLOWLIST / PERFIS)
// -------------------------------------------------------------

app.get('/api/team/allowlist', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(allowlist).orderBy(desc(allowlist.createdAt));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar membros da equipe.' });
  }
});

app.post('/api/team/allowlist', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, name, role, notes } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório.' });

    const cleanEmail = email.toLowerCase().trim();

    const [created] = await db
      .insert(allowlist)
      .values({
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        role: role || 'somente_leitura',
        status: 'ativo',
        invitedBy: req.user!.email,
        notes: notes || null,
      })
      .onConflictDoUpdate({
        target: allowlist.email,
        set: {
          name: name || cleanEmail.split('@')[0],
          role: role || 'somente_leitura',
          status: 'ativo',
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAudit('ADD_ALLOWLIST', 'user_access', created.id, req.user!.email, {
      email: cleanEmail,
      role,
    });

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao adicionar e-mail à equipe.' });
  }
});

app.put('/api/team/allowlist/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { role, status, notes } = req.body;

    const [target] = await db.select().from(allowlist).where(eq(allowlist.id, id)).limit(1);
    if (!target) return res.status(404).json({ error: 'Membro não encontrado.' });

    // Proteção: não permitir revogar o bootstrap admin inicial
    if (target.email === INITIAL_BOOTSTRAP_ADMIN && status === 'revogado') {
      return res.status(400).json({ error: 'Não é permitido revogar o administrador inicial de bootstrap.' });
    }

    const [updated] = await db
      .update(allowlist)
      .set({
        role: role !== undefined ? role : undefined,
        status: status !== undefined ? status : undefined,
        notes: notes !== undefined ? notes : undefined,
        updatedAt: new Date(),
      })
      .where(eq(allowlist.id, id))
      .returning();

    // Sincronizar imediatamente na tabela users para efeito imediato
    await db
      .update(users)
      .set({
        role: role !== undefined ? role : undefined,
        status: status !== undefined ? status : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.email, target.email));

    await logAudit('UPDATE_ALLOWLIST', 'user_access', id, req.user!.email, {
      email: target.email,
      role,
      status,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar permissões do membro.' });
  }
});

app.delete('/api/team/allowlist/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [target] = await db.select().from(allowlist).where(eq(allowlist.id, id)).limit(1);
    if (!target) return res.status(404).json({ error: 'Membro não encontrado.' });

    if (target.email === INITIAL_BOOTSTRAP_ADMIN) {
      return res.status(400).json({ error: 'O administrador inicial de bootstrap não pode ser removido.' });
    }

    await db.delete(allowlist).where(eq(allowlist.id, id));
    // Revogar imediatamente na tabela users
    await db.update(users).set({ status: 'revogado' }).where(eq(users.email, target.email));

    await logAudit('DELETE_ALLOWLIST', 'user_access', id, req.user!.email, { email: target.email });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao excluir membro da equipe.' });
  }
});

// Logs de Auditoria
app.get('/api/audit-logs', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar logs de auditoria.' });
  }
});

// -------------------------------------------------------------
// ROTAS DE CONFIGURAÇÕES DO SISTEMA (REGRAS DE PRAZO, FERIADOS, WHATSAPP)
// -------------------------------------------------------------

app.get('/api/configs', requireAuth, async (req: AuthRequest, res) => {
  try {
    const configs = await db.select().from(systemConfigs);
    const configMap: Record<string, any> = {};
    configs.forEach((c) => {
      try {
        configMap[c.key] = JSON.parse(c.value);
      } catch {
        configMap[c.key] = c.value;
      }
    });
    res.json(configMap);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao carregar configurações.' });
  }
});

app.put('/api/configs/:key', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const key = req.params.key;
    const { value, description } = req.body;

    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    const [updated] = await db
      .insert(systemConfigs)
      .values({
        key,
        value: stringValue,
        description: description || null,
        updatedBy: req.user!.email,
      })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: {
          value: stringValue,
          description: description || null,
          updatedBy: req.user!.email,
          updatedAt: new Date(),
        },
      })
      .returning();

    await logAudit('UPDATE_CONFIG', 'system_config', key, req.user!.email, { key });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao atualizar configuração.' });
  }
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & SPA SERVING
// -------------------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Central de Procedimentos rodando na porta ${PORT}`);
  });
}

startServer();
