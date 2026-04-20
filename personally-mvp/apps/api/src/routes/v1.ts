import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { agentAuth } from '../middleware/agent-auth.js';
import { meRouter } from '../modules/me/routes.js';
import { clientsRouter } from '../modules/clients/routes.js';
import { plansRouter } from '../modules/plans/routes.js';
import { exercisesRouter } from '../modules/exercises/routes.js';
import { sessionsRouter } from '../modules/sessions/routes.js';
import { notificationsRouter } from '../modules/notifications/routes.js';
import { dashboardRouter } from '../modules/dashboard/routes.js';
import { agentRouter } from '../modules/agent/routes.js';
import { internalRouter } from '../modules/internal/routes.js';

export const v1Router: Router = Router();

// Rutas publicas (futuro: signup, etc.)

// Rutas de trainer (requieren auth)
v1Router.use('/me', auth, meRouter);
v1Router.use('/clients', auth, clientsRouter);
v1Router.use('/plans', auth, plansRouter);
v1Router.use('/exercises', auth, exercisesRouter);
v1Router.use('/sessions', auth, sessionsRouter);
v1Router.use('/notifications', auth, notificationsRouter);
v1Router.use('/dashboard', auth, dashboardRouter);
v1Router.use('/agent', auth, agentRouter);

// Rutas internas (usadas por el agente WhatsApp)
v1Router.use('/internal', agentAuth, internalRouter);
