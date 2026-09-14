import { Router } from 'express';
import { db } from '../../db/index.ts';
import { policeOfficers, hearingReminders, hearingOfficers } from '../../db/schema.ts';
import { eq, asc, and } from 'drizzle-orm';
import { requireAuth, requireEditor, AuthRequest } from '../../middleware/auth.ts';
import { logAudit } from '../helpers/audit.ts';

export const officersRouter = Router();

// GET /api/officers
officersRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
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

// POST /api/officers
officersRouter.post('/', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// PUT /api/officers/:id
officersRouter.put('/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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

// DELETE /api/officers/:id
officersRouter.delete('/:id', requireAuth, requireEditor, async (req: AuthRequest, res) => {
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
