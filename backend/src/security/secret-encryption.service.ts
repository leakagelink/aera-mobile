import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class SecretEncryptionService {
  encrypt(plaintext: string, key: Buffer): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
  }

  decrypt(payload: string, key: Buffer): string {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Stored secret could not be read.');
    }
    const iv = Buffer.from(parts[1] ?? '', 'base64url');
    const tag = Buffer.from(parts[2] ?? '', 'base64url');
    const ciphertext = Buffer.from(parts[3] ?? '', 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error('Stored secret could not be read.');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Stored secret could not be read.');
    }
  }
}
