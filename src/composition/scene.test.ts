import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { PRESETS, styleFromPreset } from '../style/presets';
import { buildScene, type FitStackNode, type FooterNode, type QuietNode } from './scene';

const moment = exampleMoment(EXAMPLE_INSTANT);

function fitLines(styleId: string, message: string): string[] {
  const preset = PRESETS.find((item) => item.id === styleId)!;
  const scene = buildScene(styleFromPreset(preset), moment, message);
  const stack = scene.nodes.find((node) => node.kind === 'fit-stack') as FitStackNode | undefined;
  return stack?.lines ?? [];
}

describe('preset compositions', () => {
  it('stacks the Anton poster edge to edge', () => {
    expect(fitLines('01', 'We were here.')).toEqual([
      '33.834452',
      '-118.383318',
      'OCT 22 2026',
      '6:12 PM PDT',
      'REDONDO BEACH',
    ]);
    const scene = buildScene(styleFromPreset(PRESETS[0]), moment, 'We were here.');
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1350);
    expect(scene.background).toBe('#DCEFE4');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.metaLines).toEqual([
      '33.834452, -118.383318',
      'alt 18 m',
      '2026-10-23 01:12:07 UTC',
      'Redondo Beach, California',
    ]);
    expect(footer.message?.text).toBe('We were here.');
    expect(footer.arrangement).toBe('split');
  });

  it('centers Big Shoulders and joins the small print', () => {
    const scene = buildScene(styleFromPreset(PRESETS[1]), moment, PRESETS[1].sampleMessage);
    expect(fitLines('02', PRESETS[1].sampleMessage)).toEqual([
      '33.834452',
      '-118.383318',
      'OCT 22 2026',
      '6:12 PM',
    ]);
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.metaLines[0]).toContain('alt 18 m');
    expect(footer.metaLines[0]).toContain('2026-10-23 01:12:07 UTC');
    expect(footer.metaLines[0]).toContain('6:12 PM PDT');
    expect(scene.nodes.some((node) => node.kind === 'kicker')).toBe(true);
  });

  it('sets the quiet Bodoni coordinates with hemispheres', () => {
    const scene = buildScene(styleFromPreset(PRESETS[2]), moment, PRESETS[2].sampleMessage);
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const coords = quiet.blocks.find((block) => block.kind === 'coords');
    expect(coords && coords.kind === 'coords' && coords.lines.map((line) => `${line.value}${line.suffix ?? ''}`)).toEqual([
      '33.834452N',
      '118.383318W',
    ]);
    expect(scene.background).toBe('#F7E4E1');
  });

  it('speaks the evening on the Instrument poster', () => {
    const scene = buildScene(styleFromPreset(PRESETS[3]), moment, 'We were here.');
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const time = quiet.blocks.find((block) => block.kind === 'rich-time');
    expect(time && time.kind === 'rich-time' && time.weekday).toBe('Thursday,');
    expect(time && time.kind === 'rich-time' && time.spoken).toBe('6:12 in the evening');
    expect(scene.background).toBe('#121110');
  });

  it('uses the story frame for Antonio', () => {
    const scene = buildScene(styleFromPreset(PRESETS[4]), moment, PRESETS[4].sampleMessage);
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1920);
    expect(scene.background).toBe('#E3F03A');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.align).toBe('right');
    expect(footer.metaLines).toContain('latlon.art');
  });

  it('uses an en dash on the Fraunces square', () => {
    expect(fitLines('06', PRESETS[5].sampleMessage)).toEqual(['33.834452', '\u2013118.383318']);
    const scene = buildScene(styleFromPreset(PRESETS[5]), moment, PRESETS[5].sampleMessage);
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1080);
  });

  it('hides an empty note', () => {
    const scene = buildScene(styleFromPreset(PRESETS[0]), moment, '   ');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.message).toBeUndefined();
  });

  it('appends optional measurements under the small type', () => {
    const style = styleFromPreset(PRESETS[0]);
    style.measurements = { ...style.measurements, temperature: true, sun: true };
    const warm = { ...moment, temperatureC: 20 };
    const scene = buildScene(style, warm, 'Hi');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.extraLines.some((line) => line.includes('°F'))).toBe(true);
    expect(footer.extraLines.some((line) => line.startsWith('sun '))).toBe(true);
  });
});
