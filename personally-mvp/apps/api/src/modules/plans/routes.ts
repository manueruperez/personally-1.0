import { Router } from 'express';
import { z } from 'zod';
import { DomainError } from '@personally/core';
import { createPlanDraftInput, updatePlanInput } from '@personally/types';
import { validate } from '../../middleware/validate.js';
import * as service from './service.js';
import { importPlanCsv } from './import-csv.js';

export const plansRouter: Router = Router();

plansRouter.get(
  '/by-client/:clientId',
  validate({ params: z.object({ clientId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.listPlansByClient(req.params.clientId!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/by-client/:clientId',
  validate({
    params: z.object({ clientId: z.string().uuid() }),
    body: createPlanDraftInput,
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.createPlanDraft(req.params.clientId!, req.body, req.ctx);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.get(
  '/:id',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.getPlan(req.params.id!, req.ctx);
      if (!data) throw new DomainError('NOT_FOUND', 'Plan no encontrado');
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.patch(
  '/:id',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: updatePlanInput,
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.updatePlan(req.params.id!, req.body, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/:id/activate',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.activatePlan(req.params.id!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/:id/revert-to-draft',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.revertPlanToDraft(req.params.id!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/:id/import-csv',
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ csv: z.string().min(1) }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const summary = await importPlanCsv(req.params.id!, req.body.csv, req.ctx);
      res.json({ data: summary });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/:id/archive',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.archivePlan(req.params.id!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/:id/weeks',
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.addPlanWeek(req.params.id!, req.ctx);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/weeks/:weekId/days',
  validate({
    params: z.object({ weekId: z.string().uuid() }),
    body: z.object({
      dayOfWeek: z.number().int().min(1).max(7),
      focus: z.string().max(200).nullable().optional(),
      isRestDay: z.boolean().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.addPlanDay(req.params.weekId!, req.body, req.ctx);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.post(
  '/days/:dayId/items',
  validate({
    params: z.object({ dayId: z.string().uuid() }),
    body: z.object({
      exerciseId: z.string().uuid(),
      block: z.enum(['warmup', 'exercise', 'cooldown']),
      sets: z.number().int().min(0).max(99).nullable().optional(),
      reps: z.string().max(50).nullable().optional(),
      restSeconds: z.number().int().min(0).max(3600).nullable().optional(),
      rpeTarget: z.number().int().min(1).max(10).nullable().optional(),
      cues: z.string().max(500).nullable().optional(),
      notes: z.string().max(500).nullable().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.addPlanItem(req.params.dayId!, req.body, req.ctx);
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.delete(
  '/days/:dayId',
  validate({ params: z.object({ dayId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.deletePlanDay(req.params.dayId!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.delete(
  '/items/:itemId',
  validate({ params: z.object({ itemId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.deletePlanItem(req.params.itemId!, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.patch(
  '/items/:itemId',
  validate({
    params: z.object({ itemId: z.string().uuid() }),
    body: z
      .object({
        exerciseId: z.string().uuid().optional(),
        sets: z.number().int().min(0).max(99).nullable().optional(),
        reps: z.string().max(50).nullable().optional(),
        restSeconds: z.number().int().min(0).max(3600).nullable().optional(),
        rpeTarget: z.number().int().min(1).max(10).nullable().optional(),
        cues: z.string().max(500).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
        loadSuggestion: z.string().max(100).nullable().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, {
        message: 'Al menos un campo debe enviarse',
      }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const data = await service.updatePlanItem(req.params.itemId!, req.body, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

plansRouter.delete(
  '/:id/weeks/:weekNumber',
  validate({
    params: z.object({
      id: z.string().uuid(),
      weekNumber: z.coerce.number().int().min(1).max(52),
    }),
  }),
  async (req, res, next) => {
    try {
      if (!req.ctx) throw new DomainError('AUTH_REQUIRED', '');
      const weekNumber = Number(req.params.weekNumber!);
      const data = await service.deletePlanWeek(req.params.id!, weekNumber, req.ctx);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);
