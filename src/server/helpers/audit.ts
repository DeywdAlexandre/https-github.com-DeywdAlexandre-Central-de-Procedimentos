import { db } from '../../db/index.ts';
import { auditLogs } from '../../db/schema.ts';

/**
 * Helper para registro de Auditoria no banco de dados.
 */
export async function logAudit(
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
