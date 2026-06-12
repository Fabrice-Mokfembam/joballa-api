import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: process.env.SENTRY_SEND_PII !== 'false',
  });
}
