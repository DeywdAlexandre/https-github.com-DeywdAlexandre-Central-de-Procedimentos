import { Router } from 'express';
import { db } from '../../db/index.ts';
import { systemConfigs } from '../../db/schema.ts';
import { requireAuth, requireAdmin, AuthRequest } from '../../middleware/auth.ts';
import { logAudit } from '../helpers/audit.ts';

export const configsRouter = Router();

// GET /api/configs
configsRouter.get('/', requireAuth, async (req: AuthRequest, res) => {
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

// PUT /api/configs/:key
configsRouter.put('/:key', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
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
