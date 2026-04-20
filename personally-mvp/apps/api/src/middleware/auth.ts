import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { DomainError } from '@personally/core';
import { prisma } from '@personally/db';
import { logger } from '../lib/logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    ctx?: AuthContext;
  }
}

export interface AuthContext {
  userId: string;
  trainerId: string;
  organizationId: string;
  role: 'trainer' | 'owner' | 'admin';
}

// Soportamos dos modos:
// 1. HS256 con SUPABASE_JWT_SECRET (default para proyectos actuales).
// 2. RS256 via JWKS (proyectos con asymmetric keys habilitadas).
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const url = process.env.SUPABASE_URL;
    if (!url) throw new Error('SUPABASE_URL not set');
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/.well-known/jwks.json`));
  }
  return jwks;
}

async function verifyToken(token: string): Promise<{ sub: string }> {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (secret) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ['HS256'],
      });
      return { sub: String(payload.sub) };
    } catch (err) {
      logger.debug({ err }, 'HS256 verify fallo, probando JWKS');
    }
  }
  const { payload } = await jwtVerify(token, getJwks());
  return { sub: String(payload.sub) };
}

export async function auth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new DomainError('AUTH_REQUIRED', 'Token requerido');
    }
    const token = header.slice('Bearer '.length);

    const { sub: userId } = await verifyToken(token);
    if (!userId) throw new DomainError('AUTH_REQUIRED', 'Token invalido');

    const trainer = await prisma.trainer.findUnique({ where: { userId } });
    if (!trainer) throw new DomainError('FORBIDDEN', 'Trainer no existe');

    req.ctx = {
      userId,
      trainerId: trainer.id,
      organizationId: trainer.organizationId,
      role: trainer.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.ctx) {
    next(new DomainError('AUTH_REQUIRED', 'No autenticado'));
    return;
  }
  next();
}
