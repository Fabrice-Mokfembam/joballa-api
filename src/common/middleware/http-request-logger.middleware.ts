import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const httpAccess = new Logger('HTTP');

/**
 * Logs every request on arrival and again when the response finishes (status + duration).
 */
export function httpRequestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  const url = req.originalUrl || req.url || '';
  const ip = req.ip || req.socket?.remoteAddress || '-';

  httpAccess.log(`→ ${req.method} ${url} [${ip}]`);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const line = `← ${req.method} ${url} ${res.statusCode} ${ms}ms`;

    if (res.statusCode >= 500) {
      httpAccess.error(line);
      return;
    }
    if (res.statusCode >= 400) {
      httpAccess.warn(line);
      return;
    }
    httpAccess.log(line);
  });

  next();
}
