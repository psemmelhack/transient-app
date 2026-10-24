export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    const file = new File([new Blob(['x'], { type: 'image/png' })], 'transient.png', { type: 'image/png' });
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function sharePng(blob: Blob, filename: string, text: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unsupported';
  const file = new File([blob], filename, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({
      files: [file],
      title: 'Transient',
      text: text.trim() || undefined,
    });
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    return 'unsupported';
  }
}

function openLink(href: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function openSms(address: string, body: string): void {
  const to = address.trim();
  const href = to
    ? `sms:${encodeURIComponent(to)}?&body=${encodeURIComponent(body)}`
    : `sms:?&body=${encodeURIComponent(body)}`;
  openLink(href);
}

export function openEmail(address: string, body: string): void {
  const to = address.trim();
  const params = new URLSearchParams({ subject: 'Transient', body });
  openLink(`mailto:${encodeURIComponent(to)}?${params.toString()}`);
}
