import { Router } from 'express';
import { db } from '../../db/index.ts';
import { allowlist, users } from '../../db/schema.ts';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest, INITIAL_BOOTSTRAP_ADMIN } from '../../middleware/auth.ts';
import { logAudit } from '../helpers/audit.ts';

export const teamRouter = Router();

// GET /api/team/allowlist
teamRouter.get('/allowlist', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    try {
      await db
        .update(allowlist)
        .set({ name: req.user?.name || 'Deywd (Administrador Inicial)' })
        .where(and(eq(allowlist.email, INITIAL_BOOTSTRAP_ADMIN), sql`${allowlist.name} ILIKE '%Deyvison%'`));
    } catch (e) {
      // ignore
    }

    const list = await db.select().from(allowlist).orderBy(desc(allowlist.createdAt));
    const formatted = list.map((item) => {
      if (item.email === INITIAL_BOOTSTRAP_ADMIN && item.name?.toLowerCase().includes('deyvison')) {
        return {
          ...item,
          name: item.name.replace(/deyvison/gi, 'Deywd'),
        };
      }
      return item;
    });
    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar membros da equipe.' });
  }
});

// POST /api/team/allowlist
teamRouter.post('/allowlist', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
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

// PUT /api/team/allowlist/:id
teamRouter.put('/allowlist/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
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

// DELETE /api/team/allowlist/:id
teamRouter.delete('/allowlist/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
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
