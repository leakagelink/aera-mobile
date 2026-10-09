import { File, Paths } from 'expo-file-system';

export async function readAudioBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

export async function writeReplyAudio(audioBase64: string): Promise<string> {
  const file = new File(Paths.cache, 'arah-reply.mp3');
  file.create({ overwrite: true, intermediates: true });
  file.write(audioBase64, { encoding: 'base64' });
  return file.uri;
}
