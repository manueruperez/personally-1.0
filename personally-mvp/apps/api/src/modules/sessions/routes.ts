import { Router } from 'express';
import { z } from 'zod';
import { DomainError } from '@personally/core';
import { prisma } from '@personally/db';
import { validate } from '../../middleware/validate.js';

export const sessionsRouter: Router = Router();

sessionsRouter.get(
  '/by-client/:clientId',
  validate({
    params: z.object({ clientId: z.string().uuid() }),
    query: z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      status: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await prisma.session.findMany({
        where: {
          clientId: req.params.clientId,
          organizationId: req.ctx.organizationId,
          ...(req.query.from && { scheduledDate: { gte: req.query.from as unknown as Date } }),
          ...(req.query.to && { scheduledDate: { lte: req.query.to as unknown as Date } }),
          ...(req.query.status && { status: req.query.status as never }),
        },
        orderBy: { scheduledDate: 'desc' },
      });
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

sessionsRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await prisma.session.findFirst({
        where: { id: req.params.id, organizationId: req.ctx.organizationId },
        include: {
          logs: { orderBy: { orderInSession: 'asc' }, include: { exercise: true } },
          client: true,
        },
      });
      if (!data) throw new DomainError('NOT_FOUND', 'Sesion no encontrada');
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
