import { Router } from 'express';
import { db } from '../../db/index.ts';
import {
  procedures,
  procedureDeadlines,
  deadlineExtensions,
  procedureTimeline,
} from '../../db/schema.ts';
import { eq, desc, asc, and, inArray } from 'drizzle-orm';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { calculateDeadline, formatDateBR } from '../../lib/deadline-calculator.ts';
import { logAudit } from '../helpers/audit.ts';

export const proceduresRouter = Router();

// GET /api/procedures
proceduresRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
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

// GET /api/procedures/:id
proceduresRouter.get('/:id', requireAuth, async (req: AuthRequest, res) => {
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

// POST /api/procedures
proceduresRouter.post('/', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// PUT /api/procedures/:id
proceduresRouter.put('/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// POST /api/procedures/:id/timeline
proceduresRouter.post('/:id/timeline', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// POST /api/procedures/:id/deadlines
proceduresRouter.post('/:id/deadlines', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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
