export const SITE = 'https://transient.notarist.art/';

/** How long the WebView may sit without a ready message before the shell gives up on that page. */
export const PACK_READY_MS = 5000;

export const PACK_WATCHDOG_REASON = 'The saved page didn’t start.';
export const SITE_WATCHDOG_REASON = 'The page didn’t start. Check the connection and try again.';
export const TERMINATE_REASON = 'The page stopped.';

export type PackTarget = {
  kind: 'pack';
  indexUrl: string;
  readAccessUrl: string;
};

export type SiteTarget = {
  kind: 'site';
};

export type ShellTarget = PackTarget | SiteTarget;

export type WebViewLoad = {
  uri: string;
  allowingReadAccessToURL?: string;
};

/**
 * iOS WebView 14 only applies allowingReadAccessToURL for a file URI.
 * An html + baseUrl source loads the document and then blocks its scripts.
 */
export function webViewSource(target: ShellTarget): WebViewLoad {
  if (target.kind === 'pack') {
    return { uri: target.indexUrl, allowingReadAccessToURL: target.readAccessUrl };
  }
  return { uri: SITE };
}

export type FailureStep = { kind: 'site'; reason: string } | { kind: 'give-up'; reason: string };

/** The pack falls back to the site once. A site that also fails stays on the retry screen. */
export function nextAfterFailure(current: ShellTarget | null, reason: string): FailureStep {
  if (!current || current.kind === 'pack') return { kind: 'site', reason };
  return { kind: 'give-up', reason };
}

export function watchdogReason(target: ShellTarget): string {
  return target.kind === 'pack' ? PACK_WATCHDOG_REASON : SITE_WATCHDOG_REASON;
}

export function httpFailureText(status: number | undefined): string {
  if (typeof status === 'number' && Number.isFinite(status) && status > 0) return `The page returned ${status}.`;
  return 'The page returned an error.';
}

export function failureText(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'The page could not be opened.';
}

export function appendFailure(previous: string | null, reason: string): string {
  const next = reason.trim();
  if (!next) return previous?.trim() || 'The page could not be opened.';
  if (!previous?.trim()) return next;
  if (previous.split('\n').includes(next)) return previous;
  return `${previous}\n${next}`;
}
