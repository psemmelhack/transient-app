import { clampHeroElement, heroScaleToClear } from './heroClearance';

/** Smallest telemetry size still readable on the 1080 card. */
export const TELEMETRY_FONT_FLOOR = 11;

/** Columns across the card. Two is the start; four is as far as a label still fits. */
export const TELEMETRY_COLUMN_CAP = 4;

/** Room kept above a poster footer so the coordinates and date can stay large. */
export const POSTER_HERO_BAND = 400;

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function boxesIntersect(a: Box, b: Box, slop = 0.5): boolean {
  return a.left < b.right - slop && a.right > b.left + slop && a.top < b.bottom - slop && a.bottom > b.top + slop;
}

export function boxOutside(inner: Box, outer: Box, slop = 1): boolean {
  return inner.left < outer.left - slop || inner.top < outer.top - slop || inner.right > outer.right + slop || inner.bottom > outer.bottom + slop;
}

/**
 * Column count and size for an extended telemetry block.
 * Extra columns come first. The size steps down only when more columns still overflow.
 */
export function layoutSpreadTelemetry(
  lineCount: number,
  fontSize: number,
  lineHeight: number,
  maxHeight: number,
): { columns: number; fontSize: number } {
  if (lineCount <= 0) return { columns: 1, fontSize };
  const height = (columns: number, size: number) => Math.ceil(lineCount / columns) * size * lineHeight;
  let columns = 2;
  let size = fontSize;
  if (!(maxHeight > 0)) {
    return { columns: Math.min(TELEMETRY_COLUMN_CAP, Math.max(2, Math.ceil(lineCount / 4))), fontSize: TELEMETRY_FONT_FLOOR };
  }
  while (height(columns, size) > maxHeight && columns < TELEMETRY_COLUMN_CAP) columns += 1;
  while (height(columns, size) > maxHeight && size > TELEMETRY_FONT_FLOOR) size -= 1;
  return { columns, fontSize: size };
}

const OBSTACLES = ['kicker', 'header-split', 'coords', 'date', 'place', 'mark'];

function rectOf(el: Element): Box {
  const rect = el.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function telemetryTooWide(node: HTMLElement): boolean {
  if (node.scrollWidth > node.clientWidth + 1) return true;
  const rows = node.querySelectorAll<HTMLElement>('[data-telemetry-row]');
  for (const row of rows) {
    if (row.scrollWidth > row.clientWidth + 1) return true;
  }
  return false;
}

/** A full-size hero may cover the footer. Shrinking it clears that cover. */
function heroCanClear(stage: HTMLElement): boolean {
  const hero = stage.querySelector<HTMLElement>('[data-role="fit-stack"]');
  const footer = stage.querySelector<HTMLElement>('[data-role="footer"]');
  if (!hero || !footer) return true;
  if (!boxesIntersect(rectOf(hero), rectOf(footer), 1)) return true;
  if (footer.offsetTop < hero.offsetTop + 8) return false;
  return heroScaleToClear(hero.offsetTop, hero.offsetHeight, footer.offsetTop) < 0.999;
}

function telemetryClashes(node: HTMLElement, stage: HTMLElement): boolean {
  const card = rectOf(stage);
  const box = rectOf(node);
  if (box.right - box.left < 1 || box.bottom - box.top < 1) return false;
  if (boxOutside(box, card, 1.5) || telemetryTooWide(node)) return true;
  for (const role of OBSTACLES) {
    for (const el of stage.querySelectorAll(`[data-role="${role}"]`)) {
      if (!(el instanceof HTMLElement) || el === node || el.contains(node) || node.contains(el)) continue;
      const obstacle = rectOf(el);
      if (obstacle.right - obstacle.left < 1 || obstacle.bottom - obstacle.top < 1) continue;
      if (boxesIntersect(box, obstacle, 1)) return true;
    }
  }
  return !heroCanClear(stage);
}

function refitQuietStack(stage: HTMLElement) {
  const stack = stage.querySelector<HTMLElement>('[data-role="quiet-stack"]');
  const quiet = stack?.parentElement;
  if (!stack || !quiet) return;
  const available = quiet.clientHeight;
  const natural = stack.offsetHeight;
  const scale = available > 0 && natural > available + 0.5 ? available / natural : 1;
  stack.style.transform = scale === 1 ? 'none' : `scale(${scale})`;
}

/**
 * After fonts load, step columns and then type so the block stays inside the card.
 * The size never goes below the legible floor.
 */
export function fitSpreadTelemetry(node: HTMLElement, stage: HTMLElement): { fontSize: number; columns: number } {
  const initialColumns = Number(node.dataset.columns || '1');
  const initialSize = Number.parseFloat(node.dataset.fontSize || node.style.fontSize || '16');
  if (!(initialColumns > 1)) return { fontSize: initialSize, columns: Math.max(1, initialColumns) };
  const stack = stage.querySelector<HTMLElement>('[data-role="quiet-stack"]');
  if (stack) stack.style.transform = 'none';
  let size = initialSize;
  let columns = initialColumns;
  const apply = () => {
    node.style.fontSize = `${size}px`;
    node.style.gridTemplateColumns = `repeat(${columns}, max-content)`;
    node.dataset.fontSize = String(size);
    node.dataset.columns = String(columns);
  };
  apply();
  let guard = 0;
  while (telemetryClashes(node, stage) && guard < 32) {
    guard += 1;
    if (!telemetryTooWide(node) && columns < TELEMETRY_COLUMN_CAP) columns += 1;
    else if (size > TELEMETRY_FONT_FLOOR) size -= 1;
    else break;
    apply();
  }
  clampHeroElement(stage);
  refitQuietStack(stage);
  node.dataset.fitted = '1';
  return { fontSize: size, columns };
}
