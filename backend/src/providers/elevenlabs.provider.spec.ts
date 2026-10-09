import { ElevenLabsProvider } from './elevenlabs.provider';

describe('ElevenLabsProvider', () => {
  it('sends speech with the key in the header and returns audio bytes', async () => {
    let seenUrl = '';
    let seenKey = '';
    const provider = new ElevenLabsProvider(async (url, init) => {
      seenUrl = url;
      seenKey = init.headers['xi-api-key'] ?? '';
      return { status: 200, json: null, bytes: new Uint8Array(32) };
    });
    const audio = await provider.speak({
      baseUrl: 'https://api.elevenlabs.io',
      apiKey: 'eleven-secret',
      voiceId: 'voice-1',
      text: 'Turn left.',
      timeoutMs: 1000,
    });
    expect(seenUrl).toBe('https://api.elevenlabs.io/v1/text-to-speech/voice-1?output_format=mp3_22050_32');
    expect(seenUrl).not.toContain('eleven-secret');
    expect(seenKey).toBe('eleven-secret');
    expect(audio.byteLength).toBe(32);
  });

  it('reads the transcript and does not echo the key', async () => {
    const provider = new ElevenLabsProvider(async () => ({ status: 200, json: { text: 'Nearest hospital' }, bytes: new Uint8Array() }));
    await expect(
      provider.transcribe({ baseUrl: 'https://api.elevenlabs.io/', apiKey: 'eleven-secret', audio: new Uint8Array(120), mimeType: 'audio/mp4', timeoutMs: 1000 }),
    ).resolves.toBe('Nearest hospital');
    const rejected = new ElevenLabsProvider(async () => ({ status: 401, json: { detail: 'key=eleven-secret' }, bytes: new Uint8Array() }));
    await expect(rejected.transcribe({ baseUrl: 'https://api.elevenlabs.io', apiKey: 'eleven-secret', audio: new Uint8Array(120), mimeType: 'audio/mp4', timeoutMs: 1000 })).rejects.toMatchObject({
      status: 502,
    });
  });
});
