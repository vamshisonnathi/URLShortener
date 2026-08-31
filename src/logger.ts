/**
 * @file Application Logger Instance
 * @description Configures Pino structured JSON logger with ISO-8601 timestamps and service metadata.
 * @module logger
 */

import { pino } from 'pino';
import { config } from './config.js';

/** Singleton Pino logger instance configured for structured JSON output. */
export const logger = pino({
  level: config.LOG_LEVEL,
  base: { service: 'url-shortener' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/** Type definition for the application Pino logger instance. */
export type Logger = typeof logger;
