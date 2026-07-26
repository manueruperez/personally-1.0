import { Router } from 'express';
import { z } from 'zod';
import { DomainError } from '@personally/core';
import { validate } from '../../middleware/validate.js';
import {
  listNotifications,
  markNotificationRead,
  replyToNotification,
} from './service.js';

export const notificationsRouter: Router = Router();

notificationsRouter.get(
  '/',
  validate({ query: z.object({ unread: z.enum(['true', 'false']).optional() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await listNotifications(req.ctx, {
        unreadOnly: req.query.unread === 'true',
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  '/:id/read',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await markNotificationRead(req.params.id!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  '/:id/reply',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ text: z.string().min(1).max(1000) }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await replyToNotification(req.params.id!, req.body.text, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
