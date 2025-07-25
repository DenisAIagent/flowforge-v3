import pino from 'pino';
import { config } from '../config.js';
export const logger = pino({
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  timestamp: pino.stdTimeFunctions.isoTime
});

