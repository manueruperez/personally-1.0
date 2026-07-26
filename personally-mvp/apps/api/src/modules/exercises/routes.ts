import { Router } from 'express';
import { z } from 'zod';
import { DomainError } from '@personally/core';
import {
  createExerciseInput,
  searchExercisesQuery,
} from '@personally/types';
import { searchExercises, findExerciseById, createCustomExercise } from '@personally/exercises';
import { validate } from '../../middleware/validate.js';

export const exercisesRouter: Router = Router();

exercisesRouter.get(
  '/',
  validate({ query: searchExercisesQuery }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const result = await searchExercises(
        req.query as unknown as z.infer<typeof searchExercisesQuery>,
        { organizationId: req.ctx.organizationId },
      );
      res.json({
        data: result.items,
        meta: { total: result.total, page: result.page, pageSize: result.pageSize },
      });
    } catch (err) {
      next(err);
    }
  },
);

exercisesRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const ex = await findExerciseById(req.params.id!, { organizationId: req.ctx.organizationId });
      if (!ex) throw new DomainError('NOT_FOUND', 'Ejercicio no encontrado');
      res.json({ data: ex });
    } catch (err) {
      next(err);
    }
  },
);

exercisesRouter.post(
  '/',
  validate({ body: createExerciseInput }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const ex = await createCustomExercise(req.body, {
        organizationId: req.ctx.organizationId,
        trainerId: req.ctx.trainerId,
      });
      res.status(201).json({ data: ex });
    } catch (err) {
      next(err);
    }
  },
);
