import { BadRequestException } from '@nestjs/common';

const MAX_CREDENTIAL_URL_LENGTH = 2048;

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
];

const URL_SHORTENER_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
]);

export function validateCredentialUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestException('credentialUrl must be a string.');
  }
  const trimmed = value.trim();
  if (trimmed.length > MAX_CREDENTIAL_URL_LENGTH) {
    throw new BadRequestException(
      `credentialUrl must be at most ${MAX_CREDENTIAL_URL_LENGTH} characters.`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('credentialUrl must be a valid URL.');
  }
  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('credentialUrl must use https:// only.');
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOST_PATTERNS.some((p) => p.test(host))) {
    throw new BadRequestException('credentialUrl host is not allowed.');
  }
  if (URL_SHORTENER_HOSTS.has(host)) {
    throw new BadRequestException(
      'credentialUrl shortener links are not allowed.',
    );
  }
  return trimmed;
}
