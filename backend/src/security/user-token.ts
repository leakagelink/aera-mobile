import { createHmac, timingSafeEqual } from 'node:crypto';

export type UserSession = {
  id: string;
  email: string;
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function signUserToken(session: UserSession, secret: string, now = Date.now()): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ sub: session.id, email: session.email, kind: 'user', exp: now + THIRTY_DAYS_MS }));
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export function readUserToken(token: string, secret: string, now = Date.now()): UserSession | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;
  const expected = sign(`${header}.${payload}`, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown; email?: unknown; exp?: unknown; kind?: unknown };
    if (body.kind !== 'user') return null;
    if (typeof body.sub !== 'string' || typeof body.email !== 'string' || typeof body.exp !== 'number') return null;
    if (body.exp <= now) return null;
    return { id: body.sub, email: body.email };
  } catch {
    return null;
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
