import { SecretEncryptionService } from './secret-encryption.service';

describe('SecretEncryptionService', () => {
  const key = Buffer.alloc(32, 7);
  const service = new SecretEncryptionService();

  it('round-trips a secret with AES-256-GCM', () => {
    const encrypted = service.encrypt('test-key-1234', key);
    expect(encrypted.startsWith('v1.')).toBe(true);
    expect(encrypted).not.toContain('test-key-1234');
    expect(service.decrypt(encrypted, key)).toBe('test-key-1234');
  });

  it('rejects a tampered payload', () => {
    const encrypted = service.encrypt('test-key-1234', key);
    const parts = encrypted.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => service.decrypt(parts.join('.'), key)).toThrow('Stored secret could not be read.');
  });
});
