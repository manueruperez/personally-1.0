import { Router } from 'express';
import { DomainError } from '@personally/core';
import { getTodayDashboard } from './service.js';

export const dashboardRouter: Router = Router();

dashboardRouter.get('/today', async (req, res, next) => {
  try {
    if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
    const data = await getTodayDashboard(req.ctx);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});
