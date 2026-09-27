import { createHmac, timingSafeEqual } from 'node:crypto';

export type AdminSession = {
  id: string;
  email: string;
};

export function signAdminToken(session: AdminSession, secret: string, now = Date.now()): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ sub: session.id, email: session.email, exp: now + 12 * 60 * 60 * 1000 }));
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export function readAdminToken(token: string, secret: string, now = Date.now()): AdminSession | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;
  const expected = sign(`${header}.${payload}`, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: unknown; email?: unknown; exp?: unknown };
    if (typeof body.sub !== 'string' || typeof body.email !== 'string' || typeof body.exp !== 'number') return null;
    if (body.exp <= now) return null;
    return { id: body.sub, email: body.email };
  } catch {
    return null;
  }
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

function base64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
