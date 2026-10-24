import { describe, expect, it } from 'vitest';
import { exampleMoment, EXAMPLE_INSTANT } from '../data/moment';
import type { SensorSample } from '../data/telemetry';
import { contrastRatio } from '../color/contrast';
import { PRESETS, presetById, styleFromPreset } from '../style/presets';
import { buildScene, type FitStackNode, type FooterNode, type QuietNode } from './scene';

const moment = exampleMoment(EXAMPLE_INSTANT);

const sensors: SensorSample = {
  acceleration: { x: 0.12, y: 9.81, z: -0.04 },
  rotationRate: { alpha: 0.4, beta: -1.2, gamma: 0 },
  orientation: { alpha: 86, beta: 12, gamma: -3 },
  heading: 274,
  battery: null,
};

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
    const scene = buildScene(styleFromPreset(presetById('01')), moment, 'We were here.');
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1080);
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
    const shoulders = presetById('02');
    const scene = buildScene(styleFromPreset(shoulders), moment, shoulders.sampleMessage);
    expect(fitLines('02', shoulders.sampleMessage)).toEqual([
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
    const scene = buildScene(styleFromPreset(presetById('03')), moment, presetById('03').sampleMessage);
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
    const scene = buildScene(styleFromPreset(presetById('04')), moment, 'We were here.');
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const time = quiet.blocks.find((block) => block.kind === 'rich-time');
    expect(time && time.kind === 'rich-time' && time.weekday).toBe('Thursday,');
    expect(time && time.kind === 'rich-time' && time.spoken).toBe('6:12 in the evening');
    expect(scene.background).toBe('#121110');
  });

  it('composes Antonio in the square frame', () => {
    const antonio = presetById('05');
    const scene = buildScene(styleFromPreset(antonio), moment, antonio.sampleMessage);
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1080);
    expect(styleFromPreset(antonio).format).toBe('square');
    expect(scene.background).toBe('#E3F03A');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.align).toBe('right');
    expect(footer.metaLines).toContain('latlon.art');
  });

  it('composes every preset as a square', () => {
    for (const preset of PRESETS) {
      const scene = buildScene(styleFromPreset(preset), moment, preset.sampleMessage);
      expect(scene.width).toBe(1080);
      expect(scene.height).toBe(1080);
      expect(styleFromPreset(preset).format).toBe('square');
    }
  });

  it('still composes a story when that ratio is passed to the scene', () => {
    const antonio = presetById('05');
    const style = { ...styleFromPreset(antonio), format: 'story' as const };
    const scene = buildScene(style, moment, antonio.sampleMessage);
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1920);
    expect(scene.background).toBe('#E3F03A');
  });

  it('uses an en dash on the Fraunces square', () => {
    const fraunces = presetById('06');
    expect(fitLines('06', fraunces.sampleMessage)).toEqual(['33.834452', '\u2013118.383318']);
    const scene = buildScene(styleFromPreset(fraunces), moment, fraunces.sampleMessage);
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1080);
  });

  it('hides an empty note', () => {
    const scene = buildScene(styleFromPreset(presetById('01')), moment, '   ');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.message).toBeUndefined();
  });

  it('appends optional measurements under the small type', () => {
    const style = styleFromPreset(presetById('01'));
    style.measurements = { ...style.measurements, temperature: true, sun: true };
    const warm = { ...moment, temperatureC: 20 };
    const scene = buildScene(style, warm, 'Hi');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.extraLines.some((line) => line.includes('°F'))).toBe(true);
    expect(footer.extraLines.some((line) => line.startsWith('sun '))).toBe(true);
  });

  it('lists the business presets first, then the original six', () => {
    expect(PRESETS.map((preset) => preset.name)).toEqual([
      'Ledger',
      'Boardroom',
      'Title block',
      'Anton',
      'Big Shoulders',
      'Bodoni',
      'Instrument',
      'Antonio',
      'Fraunces',
    ]);
    expect(PRESETS.map((preset) => preset.id)).toEqual(['07', '08', '09', '01', '02', '03', '04', '05', '06']);
  });

  it('sets Ledger in Inter, left, with tabular figures and wide margins', () => {
    const preset = presetById('07');
    const scene = buildScene(styleFromPreset(preset), moment, preset.sampleMessage);
    const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const coords = quiet.blocks.find((block) => block.kind === 'coords');
    const time = quiet.blocks.find((block) => block.kind === 'text' && block.text.includes('October'));
    expect(scene.background).toBe('#F5F3EE');
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1080);
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

  it('sets telemetry in IBM Plex Mono and joins the title block', () => {
    const sensed = {
      ...moment,
      accuracy: 12,
      altitudeAccuracy: 4,
      speed: 1.4,
      course: 182,
      sensors,
    };
    for (const id of PRESETS.map((preset) => preset.id)) {
      const style = styleFromPreset(presetById(id));
      style.measurements = { ...style.measurements, telemetry: true };
      const scene = buildScene(style, sensed, 'Noted.');
      expect(scene.width).toBe(1080);
      expect(scene.height).toBe(1080);
      const text = JSON.stringify(scene.nodes);
      expect(text).toContain('274° W');
      expect(text).toContain('IBM Plex Mono');
    }

    const poster = styleFromPreset(presetById('02'));
    poster.measurements = { ...poster.measurements, telemetry: true };
    const posterScene = buildScene(poster, sensed, 'Noted.');
    const footer = posterScene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.telemetry?.font.family).toBe('IBM Plex Mono');
    expect(footer.telemetry?.lines.map((line) => line.label)).toEqual(['ACC', 'GYRO', 'ORIENT', 'HDG', '±ACC', '±ALT', 'SPD', 'CRS']);
    expect(footer.extraLines.some((line) => line.startsWith('±'))).toBe(false);
    const hero = posterScene.nodes.find((node) => node.kind === 'fit-stack') as FitStackNode;
    expect(hero.footerCue).toContain('hdg');

    const ledger = styleFromPreset(presetById('07'));
    ledger.measurements = { ...ledger.measurements, telemetry: true };
    const ledgerScene = buildScene(ledger, sensed, 'Noted.');
    const ledgerQuiet = ledgerScene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const table = ledgerQuiet.blocks.find((block) => block.kind === 'telemetry');
    expect(table && table.kind === 'telemetry' && table.font.family).toBe('IBM Plex Mono');
    expect(table && table.kind === 'telemetry' && table.fontSize).toBeLessThanOrEqual(16);

    const title = styleFromPreset(presetById('09'));
    title.measurements = { ...title.measurements, telemetry: true };
    const titleScene = buildScene(title, sensed, 'Noted.');
    const titleQuiet = titleScene.nodes.find((node) => node.kind === 'quiet') as QuietNode;
    const rows = titleQuiet.blocks.find((block) => block.kind === 'rows');
    expect(rows && rows.kind === 'rows' && rows.rows.some((row) => row.label === 'HDG' && row.value === '274° W')).toBe(true);
    expect(rows && rows.kind === 'rows' && rows.rows.some((row) => row.label === 'ACC' && row.value === '0.12  9.81  −0.04')).toBe(true);
    expect(rows && rows.kind === 'rows' && rows.rows.some((row) => row.label === 'Accuracy')).toBe(false);
    if (rows && rows.kind === 'rows') {
      const estimated = rows.rows.length * (rows.gap * 2 + rows.valueSize * rows.lineHeight);
      expect(estimated).toBeLessThan(1080 - 88);
    }
  });

  it('hides telemetry until it is turned on', () => {
    const sensed = { ...moment, accuracy: 8, sensors };
    const scene = buildScene(styleFromPreset(presetById('01')), sensed, 'Hi');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    expect(footer.telemetry).toBeUndefined();
    expect(footer.extraLines).toEqual(['±8 m']);
  });
});
