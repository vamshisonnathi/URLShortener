import { pino } from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'url-shortener' },
  // ISO timestamps read better in aggregated logs than epoch ms.
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
