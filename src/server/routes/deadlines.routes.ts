import { Router } from 'express';
import { db } from '../../db/index.ts';
import { procedures, procedureDeadlines, deadlineExtensions } from '../../db/schema.ts';
import { eq, asc, sql } from 'drizzle-orm';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { calculateDeadline, getTodayDateBR } from '../../lib/deadline-calculator.ts';
import { logAudit } from '../helpers/audit.ts';


export const deadlinesRouter = Router();

// GET /api/deadlines
deadlinesRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
  try {
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

    const today = getTodayDateBR();

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

// POST /api/deadlines/calculate
deadlinesRouter.post('/calculate', requireAuth, async (req: AuthRequest, res) => {
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

// POST /api/deadlines/:id/confirm
deadlinesRouter.post('/:id/confirm', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// POST /api/deadlines/:id/extend
deadlinesRouter.post('/:id/extend', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// POST /api/deadlines/:id/complete
deadlinesRouter.post('/:id/complete', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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
