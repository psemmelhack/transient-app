import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import { contrastRatio } from '../color/contrast';
import { PRESETS, presetById, styleFromPreset } from '../style/presets';
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
    const mark = scene.nodes.find((node) => node.kind === 'mark');
    expect(mark && mark.kind === 'mark' && mark.left).toBe(0);
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

  it('keeps the original six presets ahead of the business set', () => {
    expect(PRESETS.slice(0, 6).map((preset) => preset.id)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(PRESETS.map((preset) => preset.name)).toEqual([
      'Anton',
      'Big Shoulders',
      'Bodoni',
      'Instrument',
      'Antonio',
      'Fraunces',
      'Ledger',
      'Boardroom',
      'Title block',
    ]);
  });

  it('sets Ledger in Inter, left, with tabular figures and wide margins', () => {
    const preset = presetById('07');
    const scene = buildScene(styleFromPreset(preset), moment, preset.sampleMessage);
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const coords = quiet.blocks.find((block) => block.kind === 'coords');
    const time = quiet.blocks.find((block) => block.kind === 'text' && block.text.includes('October'));
    expect(scene.background).toBe('#F5F3EE');
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1350);
    expect(quiet.align).toBe('left');
    expect(quiet.left).toBeGreaterThanOrEqual(140);
    expect(coords && coords.kind === 'coords' && coords.font.family).toBe('Inter');
    expect(coords && coords.kind === 'coords' && coords.font.features).toContain('tnum');
    expect(time && time.kind === 'text' && time.font.features).toContain('tnum');
    const mark = scene.nodes.find((node) => node.kind === 'mark');
    expect(mark && mark.kind === 'mark' && mark.left).toBe(quiet.left);
    expect(contrastRatio(preset.textColor, preset.backgroundColor)).toBeGreaterThan(12);
  });

  it('sets Boardroom in Instrument Serif on navy', () => {
    const preset = presetById('08');
    const scene = buildScene(styleFromPreset(preset), moment, preset.sampleMessage);
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const coords = quiet.blocks.find((block) => block.kind === 'coords');
    const note = quiet.blocks.find((block) => block.kind === 'text' && block.text === preset.sampleMessage);
    expect(scene.background).toBe('#0E1A2B');
    expect(quiet.align).toBe('left');
    expect(coords && coords.kind === 'coords' && coords.font.family).toBe('Instrument Serif');
    expect(note && note.kind === 'text' && note.font.style).toBe('italic');
    expect(contrastRatio(preset.textColor, preset.backgroundColor)).toBeGreaterThan(12);
  });

  it('sets the title block as letterspaced rows under a rule', () => {
    const preset = presetById('09');
    const scene = buildScene(styleFromPreset(preset), moment, preset.sampleMessage);
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const rule = quiet.blocks.find((block) => block.kind === 'rule');
    const rows = quiet.blocks.find((block) => block.kind === 'rows');
    expect(scene.background).toBe('#E6E8EB');
    expect(quiet.align).toBe('left');
    expect(quiet.anchor).toBe('end');
    expect(rule && rule.kind === 'rule' && rule.height).toBeGreaterThan(1);
    expect(rows && rows.kind === 'rows' && rows.tracking).toBeGreaterThanOrEqual(0.18);
    expect(rows && rows.kind === 'rows' && rows.tabular).toBe(true);
    expect(rows && rows.kind === 'rows' && rows.valueFont.family).toBe('IBM Plex Mono');
    expect(rows && rows.kind === 'rows' && rows.rows).toEqual([
      { label: 'Location', value: 'REDONDO BEACH, CALIFORNIA' },
      { label: 'Latitude', value: '33.834452\u00b0 N' },
      { label: 'Longitude', value: '118.383318\u00b0 W' },
      { label: 'Date', value: 'OCT 22 2026' },
      { label: 'Time', value: '6:12 PM PDT' },
      { label: 'Elevation', value: '18 m' },
      { label: 'UTC', value: '2026-10-23 01:12:07 UTC' },
      { label: 'Note', value: 'Issued for record.' },
    ]);
    expect(contrastRatio(preset.textColor, preset.backgroundColor)).toBeGreaterThan(10);
  });

  it('fits temperature and sun into the business presets', () => {
    const warm = { ...moment, temperatureC: 20 };
    for (const id of ['07', '08', '09']) {
      const style = styleFromPreset(presetById(id));
      style.measurements = { ...style.measurements, temperature: true, sun: true };
      const scene = buildScene(style, warm, 'Noted.');
      const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
      const text = JSON.stringify(quiet.blocks);
      expect(text).toContain('°F');
      expect(text).toContain('az');
      if (id === '09') {
        const rows = quiet.blocks.find((block) => block.kind === 'rows');
        expect(rows && rows.kind === 'rows' && rows.rows.some((row) => row.label === 'Temperature')).toBe(true);
        expect(rows && rows.kind === 'rows' && rows.rows.some((row) => row.label === 'Sun' && !row.value.startsWith('sun '))).toBe(true);
      }
    }
  });
});
