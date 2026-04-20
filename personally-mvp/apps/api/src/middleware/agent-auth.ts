import type { NextFunction, Request, Response } from 'express';
import { DomainError } from '@personally/core';

/**
 * Auth para rutas internas usadas por el agente WhatsApp.
 * Token compartido via env (AGENT_TOKEN).
 */
export function agentAuth(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.AGENT_TOKEN;
  const received = req.header('x-agent-token');
  if (!expected || expected.length < 16) {
    return next(new DomainError('INTERNAL', 'AGENT_TOKEN mal configurado'));
  }
  if (received !== expected) {
    return next(new DomainError('FORBIDDEN', 'Token de agente invalido'));
  }
  next();
}
