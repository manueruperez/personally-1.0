import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './lib/logger.js';
import { v1Router } from './routes/v1.js';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean) || true,
      credentials: true,
    }),
  );
  // Guardamos el cuerpo crudo: la firma del webhook de Meta es un HMAC sobre
  // los bytes originales, y re-serializar el JSON parseado la invalida.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(pinoHttp({ logger }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1', v1Router);

  app.use(errorHandler);

  return app;
}
