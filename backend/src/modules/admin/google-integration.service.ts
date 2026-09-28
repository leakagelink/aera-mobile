import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createSign } from 'node:crypto';

import { APP_CONFIG } from '../../config/config.module';
import type { AppConfig } from '../../config/load-config';
import { DatabaseService } from '../../database/database.service';
import { SecretEncryptionService } from '../../security/secret-encryption.service';
import { AuditRepository } from './audit.repository';

const ROW_ID = 'default';
const CLIENT_ID = /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

export type GoogleIntegrationView = {
  webClientId: string | null;
  androidClientId: string | null;
  serviceAccountConfigured: boolean;
  projectId: string | null;
  clientEmail: string | null;
  updatedAt: string | null;
};

type StoredRow = {
  web_client_id: string | null;
  android_client_id: string | null;
  service_account_encrypted: string | null;
  project_id: string | null;
  client_email: string | null;
  updated_at: Date;
};

@Injectable()
export class GoogleIntegrationService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: SecretEncryptionService,
    private readonly audit: AuditRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async view(): Promise<GoogleIntegrationView> {
    const row = await this.read();
    return toView(row);
  }

  async update(
    input: { webClientId?: string; androidClientId?: string; serviceAccountJson?: string; clearServiceAccount?: boolean },
    adminId: string,
    ipAddress: string | null,
  ): Promise<GoogleIntegrationView> {
    if (input.clearServiceAccount && input.serviceAccountJson?.trim()) {
      throw new BadRequestException('Remove the service account or upload a new file, not both.');
    }
    const current = await this.read();
    const webClientId = input.webClientId === undefined ? current?.web_client_id ?? null : cleanClientId(input.webClientId, 'Web client ID');
    const androidClientId = input.androidClientId === undefined ? current?.android_client_id ?? null : cleanClientId(input.androidClientId, 'Android client ID');
    let encrypted = current?.service_account_encrypted ?? null;
    let projectId = current?.project_id ?? null;
    let clientEmail = current?.client_email ?? null;
    if (input.clearServiceAccount) {
      encrypted = null;
      projectId = null;
      clientEmail = null;
    }
    if (input.serviceAccountJson?.trim()) {
      const account = parseServiceAccount(input.serviceAccountJson);
      encrypted = this.encrypt(account.json);
      projectId = account.projectId;
      clientEmail = account.clientEmail;
    }
    await this.database.query(
      `INSERT INTO google_integration (id, web_client_id, android_client_id, service_account_encrypted, project_id, client_email, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (id) DO UPDATE SET
         web_client_id = EXCLUDED.web_client_id,
         android_client_id = EXCLUDED.android_client_id,
         service_account_encrypted = EXCLUDED.service_account_encrypted,
         project_id = EXCLUDED.project_id,
         client_email = EXCLUDED.client_email,
         updated_at = now()`,
      [ROW_ID, webClientId, androidClientId, encrypted, projectId, clientEmail],
    );
    if (input.webClientId !== undefined || input.androidClientId !== undefined) {
      await this.audit.insert({ adminId, action: 'Google sign-in client IDs updated', provider: 'google', success: true, ipAddress });
    }
    if (input.serviceAccountJson?.trim()) {
      await this.audit.insert({ adminId, action: 'Firebase service account updated', provider: 'google', success: true, ipAddress });
    }
    if (input.clearServiceAccount) {
      await this.audit.insert({ adminId, action: 'Firebase service account removed', provider: 'google', success: true, ipAddress });
    }
    return this.view();
  }

  async sendPush(deviceToken: string, title: string, body: string, fetchToken: typeof fetch = fetch): Promise<boolean> {
    const row = await this.read();
    if (!row?.service_account_encrypted || !row.project_id) return false;
    const account = parseServiceAccount(this.decrypt(row.service_account_encrypted));
    const assertion = serviceAccountAssertion(account.clientEmail, account.privateKey);
    let accessToken = '';
    try {
      const tokenResponse = await fetchToken(TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        signal: AbortSignal.timeout(10_000),
      });
      const tokenBody = (await tokenResponse.json().catch(() => null)) as { access_token?: unknown } | null;
      if (!tokenResponse.ok || typeof tokenBody?.access_token !== 'string') return false;
      accessToken = tokenBody.access_token;
      const sent = await fetchToken(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            android: { priority: 'HIGH', notification: { channel_id: 'default' } },
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      await sent.arrayBuffer().catch(() => undefined);
      return sent.ok;
    } catch {
      return false;
    }
  }

  async test(adminId: string, ipAddress: string | null, fetchToken: typeof fetch = fetch): Promise<{ ok: boolean; message: string }> {
    const row = await this.read();
    if (!row?.service_account_encrypted) throw new BadRequestException('Upload the Firebase service account JSON first.');
    const account = parseServiceAccount(this.decrypt(row.service_account_encrypted));
    const assertion = serviceAccountAssertion(account.clientEmail, account.privateKey);
    let response: Response;
    try {
      response = await fetchToken(TOKEN_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      await this.audit.insert({ adminId, action: 'Firebase service account test failed', provider: 'google', success: false, ipAddress });
      return { ok: false, message: 'Google did not respond. Try again.' };
    }
    const ok = response.ok;
    await this.audit.insert({
      adminId,
      action: ok ? 'Firebase service account test succeeded' : 'Firebase service account test failed',
      provider: 'google',
      success: ok,
      ipAddress,
    });
    await response.arrayBuffer().catch(() => undefined);
    return { ok, message: ok ? 'Firebase service account can sign in to Google.' : 'Google rejected the service account. Upload a new JSON key.' };
  }

  private encrypt(value: string): string {
    if (!this.config.secretEncryptionKey) throw new ServiceUnavailableException('Server encryption is not configured.');
    return this.encryption.encrypt(value, this.config.secretEncryptionKey);
  }

  private decrypt(value: string): string {
    if (!this.config.secretEncryptionKey) throw new ServiceUnavailableException('Server encryption is not configured.');
    try {
      return this.encryption.decrypt(value, this.config.secretEncryptionKey);
    } catch {
      throw new ServiceUnavailableException('Stored Google credential could not be read.');
    }
  }

  private async read(): Promise<StoredRow | null> {
    const result = await this.database.query<StoredRow>(
      `SELECT web_client_id, android_client_id, service_account_encrypted, project_id, client_email, updated_at
       FROM google_integration WHERE id = $1`,
      [ROW_ID],
    );
    return result.rows[0] ?? null;
  }
}

function toView(row: StoredRow | null): GoogleIntegrationView {
  return {
    webClientId: row?.web_client_id ?? null,
    androidClientId: row?.android_client_id ?? null,
    serviceAccountConfigured: Boolean(row?.service_account_encrypted),
    projectId: row?.project_id ?? null,
    clientEmail: row?.client_email ?? null,
    updatedAt: row?.updated_at ? row.updated_at.toISOString() : null,
  };
}

function cleanClientId(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!CLIENT_ID.test(trimmed) || trimmed.length > 200) {
    throw new BadRequestException(`${label} should look like 123456-abc.apps.googleusercontent.com.`);
  }
  return trimmed;
}

function parseServiceAccount(raw: string): { json: string; projectId: string; clientEmail: string; privateKey: string } {
  if (raw.length > 20_000) throw new BadRequestException('That service account file is too large.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('Upload the Firebase service account JSON file.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestException('Upload the Firebase service account JSON file.');
  const body = parsed as Record<string, unknown>;
  if (body.type !== 'service_account') throw new BadRequestException('That file is not a Google service account key.');
  if (typeof body.project_id !== 'string' || typeof body.client_email !== 'string' || typeof body.private_key !== 'string') {
    throw new BadRequestException('The service account file is missing project_id, client_email, or private_key.');
  }
  if (!body.private_key.includes('BEGIN PRIVATE KEY') || body.project_id.length > 120 || body.client_email.length > 200) {
    throw new BadRequestException('The service account file is not a usable Google key.');
  }
  return { json: raw, projectId: body.project_id, clientEmail: body.client_email, privateKey: body.private_key };
}

function serviceAccountAssertion(email: string, privateKey: string, now = Date.now()): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: email,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + 3600,
    }),
  );
  const data = `${header}.${payload}`;
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  return `${data}.${sign.sign(privateKey).toString('base64url')}`;
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}
