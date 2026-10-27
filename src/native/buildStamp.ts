import { PACK_REVISION } from './packRevision';

/** What the shell reads from expo-updates, plus the embedded pack it installed. */
export interface BuildFacts {
  updateId: string | null;
  createdAt: string | null;
  channel: string | null;
  runtimeVersion: string | null;
  revision: string | null;
  /** Why the shell left the pack, or why the page still is not up. Empty when the pack started cleanly. */
  failure: string | null;
}

export interface UpdateReading {
  updateId?: string | null;
  createdAt?: Date | string | number | null;
  channel?: string | null;
  runtimeVersion?: string | null;
}

const MISSING = '—';

export function factsFromUpdates(updates: UpdateReading, revision: string | null, failure: string | null = null): BuildFacts {
  return {
    updateId: textOrNull(updates.updateId),
    createdAt: createdAtText(updates.createdAt),
    channel: textOrNull(updates.channel),
    runtimeVersion: textOrNull(updates.runtimeVersion),
    revision: textOrNull(revision),
    failure: textOrNull(failure),
  };
}

/** The page keeps the latest shell reading on this property. */
export function readInjectedBuild(): BuildFacts | null {
  if (typeof window === 'undefined') return null;
  const value = (window as Window & { __transientBuild?: unknown }).__transientBuild;
  return normalizeBuild(value);
}

export function normalizeBuild(value: unknown): BuildFacts | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const facts: BuildFacts = {
    updateId: textOrNull(record.updateId),
    createdAt: textOrNull(record.createdAt),
    channel: textOrNull(record.channel),
    runtimeVersion: textOrNull(record.runtimeVersion),
    revision: textOrNull(record.revision),
    failure: textOrNull(record.failure),
  };
  if (!facts.updateId && !facts.createdAt && !facts.channel && !facts.runtimeVersion && !facts.revision && !facts.failure) return null;
  return facts;
}

/**
 * A browser tab is the site, so it names itself web and the pack this source was embedded with.
 * The phone is an Expo update: the shell supplies expo-updates and the pack it actually installed.
 */
export function formatBuildStamp(input: { platform: 'web' | 'native'; revision?: string | null; update?: BuildFacts | null }): string {
  if (input.platform === 'web') {
    return ['web', `revision ${show(input.revision ?? PACK_REVISION)}`].join('\n');
  }
  const update = input.update;
  return [
    `updateId ${show(update?.updateId)}`,
    `createdAt ${show(update?.createdAt)}`,
    `channel ${show(update?.channel)}`,
    `runtimeVersion ${show(update?.runtimeVersion)}`,
    `revision ${show(update?.revision ?? input.revision)}`,
    `shell ${show(update?.failure)}`,
  ].join('\n');
}

function createdAtText(value: Date | string | number | null | undefined): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return textOrNull(value);
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function show(value: string | null | undefined): string {
  return value ? value : MISSING;
}
