import { captureRef } from 'react-native-view-shot';

let poster: unknown = null;

/** The full-size stage registers itself. The preview copy does not. */
export function bindPoster(node: unknown): void {
  poster = node;
}

export async function capturePosterPng(width: number, height: number): Promise<Uint8Array> {
  if (!poster) throw new Error('poster');
  const base64 = await captureRef(poster, {
    format: 'png',
    quality: 1,
    result: 'base64',
    width,
    height,
  });
  return decodeBase64(base64);
}

function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
