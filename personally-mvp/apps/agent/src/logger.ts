import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  // no loguear content_text de mensajes (PII)
  redact: { paths: ['contentText', '*.contentText', 'body'], censor: '[REDACTED]' },
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss.l' },
    },
  }),
});
