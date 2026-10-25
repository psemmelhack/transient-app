import { domToBlob } from 'modern-screenshot';
import type { Scene } from '../composition/scene';
import { fitsSettled } from '../composition/fitSession';

export async function captureStage(stage: HTMLElement, scene: Scene): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready.then(
        () => undefined,
        () => undefined,
      ),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
  await Promise.race([fitsSettled(), new Promise((resolve) => setTimeout(resolve, 1500))]);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
  const blob = await domToBlob(stage, {
    width: scene.width,
    height: scene.height,
    scale: 1,
    backgroundColor: scene.background,
    style: {
      transform: 'none',
      transformOrigin: 'top left',
      left: '0',
      top: '0',
    },
  });
  if (!blob) throw new Error('Could not render the image');
  return blob;
}
