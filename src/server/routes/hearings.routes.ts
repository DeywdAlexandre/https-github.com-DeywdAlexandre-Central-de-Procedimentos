import { Router } from 'express';
import { db } from '../../db/index.ts';
import {
  hearings,
  hearingOfficers,
  hearingReschedules,
  hearingReminders,
  policeOfficers,
} from '../../db/schema.ts';
import { eq, desc, asc, inArray } from 'drizzle-orm';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { logAudit } from '../helpers/audit.ts';
import { getTodayDateBR } from '../../lib/deadline-calculator.ts';

export const hearingsRouter = Router();


// GET /api/hearings
hearingsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
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
      const today = getTodayDateBR();
      const isPast = h.hearingDate < today;

      const pendingItems: string[] = [];

      polList.forEach((pol) => {
        if (pol.noticeStatus === 'pendente' || pol.noticeStatus === 'aguardando_assinatura') {
          pendingItems.push(`${pol.officerRank} ${pol.officerFullName}: Aguarda assinatura do ofício`);
        }
        if (!pol.acknowledgedAt && pol.noticeStatus !== 'ciencia_registrada' && pol.noticeStatus !== 'termo_recebido') {
          pendingItems.push(`${pol.officerRank} ${pol.officerFullName}: Ciência não confirmada`);
        }
        if (isPast && !pol.attendanceTermReceivedAt && h.status === 'realizada') {
          const termWaived =
            (h.notes && h.notes.includes('[Termo dispensado/não emitido pela vara]')) ||
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

// POST /api/hearings
hearingsRouter.post('/', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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
          issueDate: getTodayDateBR(),
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

// POST /api/hearings/:id/reschedule
hearingsRouter.post('/:id/reschedule', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// POST /api/hearings/:id/did-not-occur
hearingsRouter.post('/:id/did-not-occur', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// POST /api/hearings/:id/complete-without-term
hearingsRouter.post('/:id/complete-without-term', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// PUT /api/hearings/officers/:id/notice
hearingsRouter.put('/officers/:id/notice', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// DELETE /api/hearings/:id
hearingsRouter.delete('/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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
