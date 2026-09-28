import { generateKeyPairSync } from 'node:crypto';

import { BadRequestException } from '@nestjs/common';

import { SecretEncryptionService } from '../../security/secret-encryption.service';
import { GoogleIntegrationService } from './google-integration.service';

const key = Buffer.alloc(32, 7);

function service(query: jest.Mock) {
  return new GoogleIntegrationService(
    { query } as never,
    new SecretEncryptionService(),
    { insert: jest.fn(async () => undefined) } as never,
    { secretEncryptionKey: key } as never,
  );
}

describe('GoogleIntegrationService', () => {
  it('stores a service account without returning the private key', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const json = JSON.stringify({
      type: 'service_account',
      project_id: 'arah-app',
      client_email: 'arah@arah-app.iam.gserviceaccount.com',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    });
    const stored: { row: Record<string, unknown> | null } = { row: null };
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (String(sql).includes('SELECT')) return { rows: stored.row ? [stored.row] : [] };
      stored.row = {
        web_client_id: params?.[1],
        android_client_id: params?.[2],
        service_account_encrypted: params?.[3],
        project_id: params?.[4],
        client_email: params?.[5],
        updated_at: new Date('2026-09-28T00:00:00.000Z'),
      };
      return { rows: [] };
    });
    const google = service(query);
    const saved = await google.update(
      { webClientId: '123-web.apps.googleusercontent.com', serviceAccountJson: json },
      'admin-1',
      null,
    );
    expect(saved.serviceAccountConfigured).toBe(true);
    expect(saved.projectId).toBe('arah-app');
    expect(JSON.stringify(saved)).not.toContain('BEGIN PRIVATE KEY');
    expect(String(stored.row?.service_account_encrypted)).not.toContain('BEGIN PRIVATE KEY');
    await expect(google.update({ webClientId: 'not-a-client' }, 'admin-1', null)).rejects.toBeInstanceOf(BadRequestException);
    await expect(google.update({ serviceAccountJson: '{"type":"user"}' }, 'admin-1', null)).rejects.toBeInstanceOf(BadRequestException);
  });
});
