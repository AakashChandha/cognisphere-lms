import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import type { WinstonModuleOptions } from 'nest-winston';

/**
 * Centralized logging configuration. All application logs (HTTP access logs,
 * business events, errors) flow through this single Winston instance so log
 * format and transports are configured in exactly one place.
 */
export function createLoggerOptions(): WinstonModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    level: isProduction ? 'info' : 'debug',
    transports: [
      new winston.transports.Console({
        format: isProduction
          ? winston.format.combine(winston.format.timestamp(), winston.format.json())
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              nestWinstonModuleUtilities.format.nestLike('LMS', {
                colors: true,
                prettyPrint: true,
              }),
            ),
      }),
    ],
  };
}
