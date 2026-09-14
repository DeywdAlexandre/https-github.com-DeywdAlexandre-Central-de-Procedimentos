import { Router } from 'express';
import { requireAuth, AuthRequest, INITIAL_BOOTSTRAP_ADMIN } from '../../middleware/auth.ts';

export const authRouter = Router();

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    res.json({
      user: req.user,
      isBootstrapAdmin: req.user?.email === INITIAL_BOOTSTRAP_ADMIN,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Erro ao carregar perfil do usuário.' });
  }
});
