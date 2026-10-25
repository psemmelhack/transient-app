import { domToBlob } from 'modern-screenshot';
import type { CssFont } from '../composition/fonts';
import { cssFontShorthand, ensureFonts } from '../composition/fontReady';
import { clampHeroElement } from '../composition/heroClearance';
import type { Scene } from '../composition/scene';
import { fitsSettled } from '../composition/fitSession';

function addSpec(specs: string[], font: Pick<CssFont, 'family' | 'weight' | 'style'> | undefined, size: number) {
  if (font) specs.push(cssFontShorthand(font, size));
}

function sceneFontShorthands(scene: Scene): string[] {
  const specs: string[] = [];
  for (const node of scene.nodes) {
    if (node.kind === 'fit-stack') addSpec(specs, node.font, 200);
    else if (node.kind === 'footer') {
      addSpec(specs, node.metaFont, node.metaSize);
      if (node.message) addSpec(specs, node.message.font, node.message.fontSize);
      if (node.telemetry) addSpec(specs, node.telemetry.font, node.telemetry.fontSize);
      if (node.mark) addSpec(specs, node.mark.font, node.mark.fontSize);
    } else if (node.kind === 'quiet') {
      for (const block of node.blocks) {
        if (block.kind === 'rule') continue;
        if (block.kind === 'rich-time') {
          addSpec(specs, block.font, block.fontSize);
          addSpec(specs, block.italicFont, block.fontSize);
        } else if (block.kind === 'rows') {
          addSpec(specs, block.labelFont, block.labelSize);
          addSpec(specs, block.valueFont, block.valueSize);
        } else if (block.kind === 'note') {
          addSpec(specs, block.font, block.fontSize);
          addSpec(specs, block.labelFont, block.labelSize);
        } else addSpec(specs, block.font, block.fontSize);
      }
    } else if (node.kind === 'mark' || node.kind === 'kicker' || node.kind === 'header-split') addSpec(specs, node.font, node.fontSize);
    else if (node.kind === 'placeholder') {
      addSpec(specs, node.font, 22);
      addSpec(specs, node.subFont, 16);
    }
  }
  return specs;
}

export async function captureStage(stage: HTMLElement, scene: Scene): Promise<Blob> {
  await ensureFonts(sceneFontShorthands(scene));
  await Promise.race([fitsSettled(), new Promise((resolve) => setTimeout(resolve, 1500))]);
  clampHeroElement(stage);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))));
  clampHeroElement(stage);
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
