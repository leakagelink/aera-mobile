import { UnauthorizedException } from '@nestjs/common';

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
};

export async function readGoogleIdToken(idToken: string, audience: string, fetchToken: typeof fetch = fetch): Promise<GoogleProfile> {
  const url = new URL('https://oauth2.googleapis.com/tokeninfo');
  url.searchParams.set('id_token', idToken);
  let response: Response;
  try {
    response = await fetchToken(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new UnauthorizedException('Google sign-in could not be checked. Try again.');
  }
  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !body) throw new UnauthorizedException('Google sign-in was rejected.');
  const aud = typeof body.aud === 'string' ? body.aud : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const sub = typeof body.sub === 'string' ? body.sub : '';
  const verified = body.email_verified === true || body.email_verified === 'true';
  if (!verified || !email || !sub || aud !== audience) throw new UnauthorizedException('Google sign-in was rejected.');
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  return { sub, email, name: name || null };
}
