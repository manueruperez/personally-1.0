import { Router } from 'express';
import { prisma } from '@personally/db';
import { DomainError } from '@personally/core';

export const meRouter: Router = Router();

meRouter.get('/', async (req, res, next) => {
  try {
    if (!req.ctx) throw new DomainError('AUTH_REQUIRED', 'No autenticado');
    const trainer = await prisma.trainer.findUnique({
      where: { id: req.ctx.trainerId },
      include: { organization: true },
    });
    res.json({ data: trainer });
  } catch (err) {
    next(err);
  }
});
