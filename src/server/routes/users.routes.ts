import { Router } from 'express';
import { db } from '../../db/index.ts';
import { allowlist, users } from '../../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest, INITIAL_BOOTSTRAP_ADMIN } from '../../middleware/auth.ts';
import { logAudit } from '../helpers/audit.ts';

export const usersRouter = Router();

// GET /api/users - Retorna a lista de usuários para o painel de configurações
usersRouter.get('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const list = await db.select().from(allowlist).orderBy(desc(allowlist.createdAt));
    
    // Mapear para o formato esperado pelo frontend (UserProfile)
    const formatted = list.map((item) => ({
      id: item.id,
      email: item.email,
      displayName: item.name || item.email.split('@')[0],
      role: item.role === 'somente_leitura' ? 'leitor' : item.role,
      active: item.status === 'ativo',
      createdAt: item.createdAt,
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Falha ao buscar usuários do sistema.' });
  }
});

// POST /api/users - Adiciona/autoriza novo membro na equipe
usersRouter.post('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, role, displayName } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail é obrigatório.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const roleNorm = role === 'leitor' ? 'somente_leitura' : (role || 'editor');

    const [created] = await db
      .insert(allowlist)
      .values({
        email: cleanEmail,
        name: displayName || cleanEmail.split('@')[0],
        role: roleNorm,
        status: 'ativo',
        invitedBy: req.user!.email,
      })
      .onConflictDoUpdate({
        target: allowlist.email,
        set: {
          name: displayName || cleanEmail.split('@')[0],
          role: roleNorm,
          status: 'ativo',
          updatedAt: new Date(),
        },
      })
      .returning();

    // Se o usuário já tiver feito login antes, atualiza a tabela users imediatamente
    await db
      .update(users)
      .set({
        name: displayName || cleanEmail.split('@')[0],
        role: roleNorm,
        status: 'ativo',
        updatedAt: new Date(),
      })
      .where(eq(users.email, cleanEmail));

    await logAudit('ADD_USER', 'user_access', created.id, req.user!.email, {
      email: cleanEmail,
      role: roleNorm,
      displayName,
    });

    res.status(201).json({
      id: created.id,
      email: created.email,
      displayName: created.name,
      role: created.role === 'somente_leitura' ? 'leitor' : created.role,
      active: created.status === 'ativo',
    });
  } catch (error: any) {
    console.error('Erro ao adicionar usuário:', error);
    res.status(500).json({ error: 'Falha ao autorizar usuário na equipe.' });
  }
});

// PUT /api/users/:id/role - Atualiza o papel de permissão (RBAC) do usuário
usersRouter.put('/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Papel (role) é obrigatório.' });
    }

    const [target] = await db.select().from(allowlist).where(eq(allowlist.id, id)).limit(1);
    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const roleNorm = role === 'leitor' ? 'somente_leitura' : role;

    const [updated] = await db
      .update(allowlist)
      .set({
        role: roleNorm,
        updatedAt: new Date(),
      })
      .where(eq(allowlist.id, id))
      .returning();

    // Sincronizar na tabela users
    await db
      .update(users)
      .set({
        role: roleNorm,
        updatedAt: new Date(),
      })
      .where(eq(users.email, target.email));

    await logAudit('UPDATE_USER_ROLE', 'user_access', id, req.user!.email, {
      email: target.email,
      newRole: roleNorm,
    });

    res.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.name,
      role: updated.role === 'somente_leitura' ? 'leitor' : updated.role,
      active: updated.status === 'ativo',
    });
  } catch (error: any) {
    console.error('Erro ao atualizar papel do usuário:', error);
    res.status(500).json({ error: 'Falha ao atualizar papel do usuário.' });
  }
});

// PUT /api/users/:id/active - Ativa ou desativa o acesso de um usuário
usersRouter.put('/:id/active', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { active } = req.body;

    if (active === undefined) {
      return res.status(400).json({ error: 'Campo active é obrigatório.' });
    }

    const [target] = await db.select().from(allowlist).where(eq(allowlist.id, id)).limit(1);
    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Não permitir desativar o admin inicial de bootstrap
    if (target.email === INITIAL_BOOTSTRAP_ADMIN && !active) {
      return res.status(400).json({ error: 'Não é permitido desativar o administrador inicial do sistema.' });
    }

    const statusNorm = active ? 'ativo' : 'revogado';

    const [updated] = await db
      .update(allowlist)
      .set({
        status: statusNorm,
        updatedAt: new Date(),
      })
      .where(eq(allowlist.id, id))
      .returning();

    // Sincronizar na tabela users
    await db
      .update(users)
      .set({
        status: statusNorm,
        updatedAt: new Date(),
      })
      .where(eq(users.email, target.email));

    await logAudit('TOGGLE_USER_ACTIVE', 'user_access', id, req.user!.email, {
      email: target.email,
      active,
    });

    res.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.name,
      role: updated.role === 'somente_leitura' ? 'leitor' : updated.role,
      active: updated.status === 'ativo',
    });
  } catch (error: any) {
    console.error('Erro ao alternar status do usuário:', error);
    res.status(500).json({ error: 'Falha ao alternar status do usuário.' });
  }
});
