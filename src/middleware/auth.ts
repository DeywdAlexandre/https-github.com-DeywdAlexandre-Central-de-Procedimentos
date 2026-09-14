import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { db } from '../db/index.ts';
import { users, allowlist } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

export interface AppUser {
  uid: string;
  email: string;
  name?: string;
  role: 'administrador' | 'editor' | 'somente_leitura';
  status: 'ativo' | 'revogado';
  dbId: number;
}

export interface AuthRequest extends Request {
  user?: AppUser;
  decodedToken?: DecodedIdToken;
}

export const INITIAL_BOOTSTRAP_ADMIN = 'deywd12@gmail.com';

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado: Token de autenticação ausente.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.decodedToken = decodedToken;

    const email = (decodedToken.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(401).json({ error: 'Não autorizado: Token não contém e-mail válido.' });
    }

    // Bootstrap ou consulta na allowlist
    let userRole: 'administrador' | 'editor' | 'somente_leitura' = 'somente_leitura';
    let userStatus: 'ativo' | 'revogado' = 'ativo';

    if (email === INITIAL_BOOTSTRAP_ADMIN) {
      userRole = 'administrador';
      userStatus = 'ativo';

      // Garantir na tabela allowlist
      try {
        const adminName = decodedToken.name || 'Deywd (Administrador Inicial)';
        await db.insert(allowlist)
          .values({
            email,
            name: adminName,
            role: 'administrador',
            status: 'ativo',
            invitedBy: 'sistema',
            notes: 'Bootstrap inicial',
          })
          .onConflictDoUpdate({
            target: allowlist.email,
            set: { name: adminName, role: 'administrador', status: 'ativo' },
          });
      } catch (err) {
        console.error('Erro ao sincronizar allowlist do bootstrap:', err);
      }
    } else {
      // Verificar allowlist no PostgreSQL
      const allowed = await db.select().from(allowlist).where(eq(allowlist.email, email)).limit(1);
      if (!allowed.length) {
        return res.status(403).json({
          error: 'Acesso Restrito: Seu e-mail não possui autorização prévia da equipe administrativa.',
          unauthorized: true,
          email,
        });
      }

      if (allowed[0].status !== 'ativo') {
        return res.status(403).json({
          error: 'Acesso Revogado: Seu acesso à Central de Procedimentos foi suspenso pelo administrador.',
          revoked: true,
          email,
        });
      }

      userRole = (allowed[0].role as any) || 'somente_leitura';
      userStatus = (allowed[0].status as any) || 'ativo';
    }

    // Sincronizar usuário na tabela users
    const [syncedUser] = await db.insert(users)
      .values({
        uid: decodedToken.uid,
        email,
        name: decodedToken.name || email.split('@')[0],
        role: userRole,
        status: userStatus,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          name: decodedToken.name || email.split('@')[0],
          role: userRole,
          status: userStatus,
          updatedAt: new Date(),
        },
      })
      .returning();

    req.user = {
      uid: decodedToken.uid,
      email,
      name: syncedUser?.name || decodedToken.name || email,
      role: userRole,
      status: userStatus,
      dbId: syncedUser?.id || 0,
    };

    next();
  } catch (error) {
    console.error('Erro ao verificar Firebase ID token:', error);
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
};

export const requireEditor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'editor' && req.user.role !== 'administrador')) {
    return res.status(403).json({ error: 'Permissão negada: Esta ação requer perfil de Editor Administrativo ou Administrador.' });
  }
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'administrador') {
    return res.status(403).json({ error: 'Permissão negada: Esta ação é restrita a Administradores do sistema.' });
  }
  next();
};
