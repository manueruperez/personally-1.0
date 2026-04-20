import { Router } from 'express';
import { z } from 'zod';
import { DomainError } from '@personally/core';
import { createClientInput, updateClientInput } from '@personally/types';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';

export const clientsRouter: Router = Router();

clientsRouter.get(
  '/',
  validate({
    query: z.object({
      status: z.enum(['active', 'paused', 'archived', 'all']).default('active'),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const status = (req.query as { status: 'active' | 'paused' | 'archived' | 'all' }).status;
      const data = await service.listClients(req.ctx, { status });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.post(
  '/',
  validate({ body: createClientInput }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.createClient(req.body, req.ctx);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.getClient(req.params.id, req.ctx);
      if (!data) throw new DomainError('NOT_FOUND', 'Cliente no encontrado');
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updateClientInput,
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.updateClient(req.params.id, req.body, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.delete(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.archiveClient(req.params.id, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.get(
  '/:id/messages',
  validate({
    params: z.object({ id: z.string().uuid() }),
    query: z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      before: z.coerce.date().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.listClientMessages(req.params.id, req.ctx, {
        limit: Number((req.query as { limit: number }).limit),
        before: (req.query as { before?: Date }).before,
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.get(
  '/:id/today-session',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.getTodaySession(req.params.id, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.delete(
  '/:id/today-session',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.resetTodaySession(req.params.id, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.post(
  '/:id/send-daily-greeting',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.triggerDailyGreeting(req.params.id, req.ctx);
      res.status(202).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

clientsRouter.post(
  '/:id/send-test-message',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ text: z.string().min(1).max(1000) }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.sendTestMessage(req.params.id, req.body.text, req.ctx);
      res.status(202).json({ data });
    } catch (err) {
      next(err);
    }
  },
);
