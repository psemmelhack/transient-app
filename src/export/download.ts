export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/** Neutral file name: latitude, longitude, and UTC time. No app name. */
export function fileNameFor(date: Date, latitude: number, longitude: number): string {
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${coordToken(latitude)}_${coordToken(longitude)}_${stamp}.png`;
}

function coordToken(value: number): string {
  const fixed = value.toFixed(6);
  return fixed === '-0.000000' ? '0.000000' : fixed;
}
