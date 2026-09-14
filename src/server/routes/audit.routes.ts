import { Router } from 'express';
import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';
import { desc } from 'drizzle-orm';
import { requireAuth, requireAdmin, AuthRequest } from '../../middleware/auth.ts';

export const auditRouter = Router();

// GET /api/audit-logs
auditRouter.get('/', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'Falha ao buscar logs de auditoria.' });
  }
});
