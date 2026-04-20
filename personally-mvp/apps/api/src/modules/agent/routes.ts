import { Router } from 'express';
import { DomainError } from '@personally/core';
import { getAgentStatus } from './store.js';
import { sendAgentCommand } from './events.js';

export const agentRouter: Router = Router();

agentRouter.get('/status', (req, res, next) => {
  try {
    if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
    const data = getAgentStatus(req.ctx.trainerId);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

agentRouter.post('/reconnect', (req, res, next) => {
  try {
    if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
    sendAgentCommand(req.ctx.trainerId, { type: 'reinit' });
    res.status(202).json({ data: { commanded: true } });
  } catch (err) {
    next(err);
  }
});
