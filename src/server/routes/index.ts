import { Router } from 'express';
import { authRouter } from './auth.routes.ts';
import { dashboardRouter } from './dashboard.routes.ts';
import { proceduresRouter } from './procedures.routes.ts';
import { deadlinesRouter } from './deadlines.routes.ts';
import { officersRouter } from './officers.routes.ts';
import { hearingsRouter } from './hearings.routes.ts';
import { batchRouter } from './batch.routes.ts';
import { noticesRouter } from './notices.routes.ts';
import { remindersRouter } from './reminders.routes.ts';
import { teamRouter } from './team.routes.ts';
import { auditRouter } from './audit.routes.ts';
import { configsRouter } from './configs.routes.ts';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/', dashboardRouter);
apiRouter.use('/procedures', proceduresRouter);
apiRouter.use('/deadlines', deadlinesRouter);
apiRouter.use('/officers', officersRouter);
apiRouter.use('/hearings', hearingsRouter);
apiRouter.use('/batch', batchRouter);
apiRouter.use('/official-notice', noticesRouter);
apiRouter.use('/reminders', remindersRouter);
apiRouter.use('/team', teamRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/configs', configsRouter);
