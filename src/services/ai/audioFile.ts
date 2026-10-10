import { File, Paths } from 'expo-file-system';

export async function readAudioBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

export async function writeReplyAudio(audioBase64: string, fileName = 'arah-reply.mp3'): Promise<string> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true, intermediates: true });
  file.write(audioBase64, { encoding: 'base64' });
  return file.uri;
}
