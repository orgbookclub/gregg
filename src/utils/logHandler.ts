import pino from 'pino';

/**
 * Log Handler using pino
 */
export const logger = pino({
  name: 'gregg',
  level: 'debug',
  transport: {
    target: 'pino-pretty',
  },
});
