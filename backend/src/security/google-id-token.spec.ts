import { UnauthorizedException } from '@nestjs/common';

import { readGoogleIdToken } from './google-id-token';

const audience = '123-web.apps.googleusercontent.com';

describe('readGoogleIdToken', () => {
  it('accepts a verified token for the configured audience', async () => {
    const fetchToken = jest.fn(async () => ({
      ok: true,
      json: async () => ({ aud: audience, email: 'Ada@Example.com', email_verified: 'true', sub: 'sub-1', name: 'Ada' }),
    })) as unknown as typeof fetch;
    await expect(readGoogleIdToken('token', audience, fetchToken)).resolves.toEqual({
      sub: 'sub-1',
      email: 'ada@example.com',
      name: 'Ada',
    });
  });

  it('rejects a token for another app', async () => {
    const fetchToken = jest.fn(async () => ({
      ok: true,
      json: async () => ({ aud: 'other', email: 'ada@example.com', email_verified: 'true', sub: 'sub-1' }),
    })) as unknown as typeof fetch;
    await expect(readGoogleIdToken('token', audience, fetchToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
