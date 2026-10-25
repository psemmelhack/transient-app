/** Space kept between the last hero line and the metadata block. */
export const HERO_FOOTER_GAP = 36;

/**
 * Scale that keeps the hero's layout bottom at least `gap` above the footer.
 * A scale of 1 means the hero already clears the metadata.
 * Footer coordinates that are not laid out yet (above the hero) leave the scale alone.
 */
export function heroScaleToClear(heroTop: number, heroHeight: number, footerTop: number, gap = HERO_FOOTER_GAP): number {
  if (!(heroHeight > 0) || !Number.isFinite(heroTop) || !Number.isFinite(footerTop)) return 1;
  if (footerTop < heroTop + 8) return 1;
  const available = footerTop - gap - heroTop;
  if (!(available > 0)) return 0.35;
  if (heroHeight <= available + 0.5) return 1;
  return Math.max(0.2, available / heroHeight);
}

export interface ClearanceBox {
  fontSize: number;
  height: number;
  shiftTop: number;
  shiftLeft: number;
}

/** Shrink a fitted line in place. The gap between lines scales with the type. */
export function scaleClearanceBox<T extends ClearanceBox>(box: T, scale: number): T {
  if (!(scale > 0) || scale >= 0.999) return box;
  return {
    ...box,
    fontSize: box.fontSize * scale,
    height: box.height * scale,
    shiftTop: box.shiftTop * scale,
    shiftLeft: box.shiftLeft * scale,
  };
}

/**
 * Read the live hero and footer and bake a shrink into their font sizes.
 * A CSS scale on the hero does not move the absolutely positioned metadata,
 * and a capture can paint the unscaled glyphs on top of it.
 */
export function clampHeroElement(stage: HTMLElement, gap = HERO_FOOTER_GAP): number {
  const hero = stage.querySelector<HTMLElement>('[data-role="fit-stack"]');
  const footer = stage.querySelector<HTMLElement>('[data-role="footer"]');
  if (!hero || !footer) return 1;
  const scale = heroScaleToClear(hero.offsetTop, hero.offsetHeight, footer.offsetTop, gap);
  if (scale >= 0.999) return 1;
  const currentGap = Number.parseFloat(hero.style.gap || '0');
  if (Number.isFinite(currentGap)) hero.style.gap = `${currentGap * scale}px`;
  hero.style.transform = 'none';
  for (const row of hero.querySelectorAll<HTMLElement>('[data-fit]')) {
    const fontSize = Number.parseFloat(row.style.fontSize || '');
    const height = Number.parseFloat(row.style.height || '');
    if (Number.isFinite(fontSize) && fontSize > 0) row.style.fontSize = `${fontSize * scale}px`;
    if (Number.isFinite(height) && height > 0) row.style.height = `${height * scale}px`;
    const span = row.firstElementChild;
    if (span instanceof HTMLElement) {
      const top = Number.parseFloat(span.style.top || '0');
      const left = Number.parseFloat(span.style.left || '0');
      if (Number.isFinite(top)) span.style.top = `${top * scale}px`;
      if (Number.isFinite(left)) span.style.left = `${left * scale}px`;
    }
  }
  return scale;
}
