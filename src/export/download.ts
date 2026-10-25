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

/** Gallery and share-sheet name: transient-YYYYMMDD-HHMMSS in the moment’s time zone. */
export function captureFileName(date: Date, timeZone = 'UTC'): string {
  const parts = dateParts(date, timeZone);
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `transient-${year}${month}${day}-${hour}${parts.minute}${parts.second}.png`;
}

function dateParts(date: Date, timeZone: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string> {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
  } catch {
    if (timeZone === 'UTC') throw new Error('Could not format the capture time');
    return dateParts(date, 'UTC');
  }
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
    second: pick('second'),
  };
}

function coordToken(value: number): string {
  const fixed = value.toFixed(6);
  return fixed === '-0.000000' ? '0.000000' : fixed;
}
