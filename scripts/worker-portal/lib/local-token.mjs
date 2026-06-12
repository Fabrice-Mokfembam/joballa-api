import crypto from 'node:crypto';
import { loadRootDotenvOptional } from '../../lib/dotenv-lite.mjs';
import { getPrisma } from './prisma.mjs';
import { getBaseUrl, isRemoteApi } from './config.mjs';

function encJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

/**
 * Mint a short-lived access JWT for local smoke tests when /auth/login is unreachable.
 * Requires DATABASE_URL + JWT_SECRET in .env and an existing worker user.
 */
export async function loadLocalDevToken() {
  const base = getBaseUrl();
  if (isRemoteApi(base)) return null;

  loadRootDotenvOptional();
  const secret =
    (process.env.JWT_SECRET ?? '').trim() ||
    'dev-only-joballa-jwt-secret-not-for-production';

  const identifier = (
    process.env.JOBALLA_WORKER_IDENTIFIER ??
    process.env.JOBALLA_WORKER_EMAIL ??
    'fabricemokfembam@gmail.com'
  ).trim();

  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: {
      role: 'WORKER',
      OR: [{ email: identifier }, { phone: identifier }],
    },
    include: { workerProfile: true },
  });
  if (!user?.workerProfile) return null;

  const expiresSec = Number(process.env.JWT_ACCESS_EXPIRES_SEC ?? 3600);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    role: user.role,
    email: user.email ?? '',
    iat: now,
    exp: now + expiresSec,
  };

  const header = encJson({ alg: 'HS256', typ: 'JWT' });
  const body = encJson(payload);
  const data = `${header}.${body}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64url');

  const token = `${data}.${sig}`;

  return {
    base,
    workerToken: token,
    workerUserId: user.id,
    workerProfileId: user.workerProfile.id,
    workerEmail: user.email ?? identifier,
    jar: {},
  };
}
