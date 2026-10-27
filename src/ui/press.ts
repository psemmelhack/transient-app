/** A finger that stayed inside this box is a tap, not a scroll. */
export const TAP_SLOP = 14;

/** Touchend and the click that follows are one press. */
export const TAP_DEDUPE_MS = 450;

export function tapWithinSlop(dx: number, dy: number, slop = TAP_SLOP): boolean {
  return dx * dx + dy * dy <= slop * slop;
}

/**
 * Count taps that land inside `windowMs`. A second event from the same finger
 * (touchend, then click) is ignored for `dedupeMs`.
 */
export function noteTripleTap(
  stamps: number[],
  now: number,
  windowMs = 700,
  dedupeMs = 80,
): { stamps: number[]; fired: boolean } {
  if (stamps.length > 0 && now - stamps[stamps.length - 1] < dedupeMs) return { stamps, fired: false };
  const next = stamps.filter((stamp) => now - stamp < windowMs);
  next.push(now);
  if (next.length >= 3) return { stamps: [], fired: true };
  return { stamps: next, fired: false };
}

/**
 * Fire `onTap` for a touch or a click inside the WebView.
 * WKWebView often delivers touchend and drops the click on a row in a scroller,
 * and it sometimes delivers only the click. Whichever arrives first runs the action.
 */
export function armTap(el: HTMLElement, onTap: () => void): () => void {
  let startX = 0;
  let startY = 0;
  let tracking = false;
  let lastFire = 0;
  const fire = () => {
    const now = Date.now();
    if (now - lastFire < TAP_DEDUPE_MS) return;
    lastFire = now;
    onTap();
  };
  const down = (x: number, y: number) => {
    tracking = true;
    startX = x;
    startY = y;
  };
  const up = (x: number, y: number, event: Event) => {
    if (!tracking) return;
    tracking = false;
    if (!tapWithinSlop(x - startX, y - startY)) return;
    event.preventDefault();
    fire();
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    down(event.clientX, event.clientY);
  };
  const onPointerUp = (event: PointerEvent) => {
    if (!tracking) return;
    up(event.clientX, event.clientY, event);
  };
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    down(touch.clientX, touch.clientY);
  };
  const onTouchEnd = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    up(touch.clientX, touch.clientY, event);
  };
  const cancel = () => {
    tracking = false;
  };
  const onClick = (event: MouseEvent) => {
    if (Date.now() - lastFire < TAP_DEDUPE_MS) {
      event.preventDefault();
      return;
    }
    fire();
  };
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchend', onTouchEnd);
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('click', onClick);
  return () => {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', cancel);
    el.removeEventListener('click', onClick);
  };
}
