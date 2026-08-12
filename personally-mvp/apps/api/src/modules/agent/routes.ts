import { Router } from 'express';
import { DomainError } from '@personally/core';
import { getAgentStatus } from './store.js';

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
