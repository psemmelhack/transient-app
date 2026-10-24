let pending = 0;
const waiters: Array<() => void> = [];

export function beginFit(): void {
  pending += 1;
}

export function endFit(): void {
  pending = Math.max(0, pending - 1);
  if (pending === 0) {
    const ready = waiters.splice(0);
    ready.forEach((resolve) => resolve());
  }
}

export function fitsSettled(): Promise<void> {
  if (pending === 0) return Promise.resolve();
  return new Promise((resolve) => waiters.push(resolve));
}
