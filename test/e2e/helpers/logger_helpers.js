// eslint-disable-next-line import/no-unresolved
import * as winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize({ level: true, message: false }),
    timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }),
    align(),
    printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`),
  ),
  transports: [
    // TODO: Look into formatting log file name
    new winston.transports.Console(),
  ],
});
