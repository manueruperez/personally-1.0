import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

type Part = 'body' | 'query' | 'params';

export function validate(schemas: Partial<Record<Part, ZodTypeAny>>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query) as Record<string, unknown>;
      if (schemas.params) req.params = schemas.params.parse(req.params) as Record<string, string>;
      next();
    } catch (err) {
      next(err);
    }
  };
}
