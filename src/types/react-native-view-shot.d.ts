export function captureRef(
  view: unknown,
  options?: {
    format?: 'png' | 'jpg' | 'webm';
    quality?: number;
    result?: 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';
    width?: number;
    height?: number;
  },
): Promise<string>;
