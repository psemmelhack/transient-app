import { describe, expect, it } from 'vitest';
import { buildScene, footerBlockHeight, quietStackHeight, type FooterNode, type QuietBlock, type QuietNode } from '../composition/scene';
import { exampleMoment, EXAMPLE_INSTANT } from './moment';
import { dataTogglePlugins, defaultMeasurements, isExtendedEnabled } from './plugins';
import { extendedReadings, linesForCard, type PhoneTelemetry, type SensorSample } from './telemetry';
import { presetById, styleFromPreset } from '../style/presets';
import { sanitizeStyle } from '../style/persist';
import { makeRecord } from '../storage/record';
import type { Style } from '../style/types';

const NOTE_200 =
  'There is no limit to what you can add at the bottom of a transient. The note is the human voice of the piece, and it should wrap into a proper block that stays on the card and remains easy to read it.';

const motion: SensorSample = {
  acceleration: { x: 0.12, y: 9.81, z: -0.04 },
  rotationRate: { alpha: 0.4, beta: -1.2, gamma: 0 },
  orientation: { alpha: 86, beta: 12, gamma: -3 },
  heading: 274,
  battery: 0.75,
};

const iosPhone: PhoneTelemetry = {
  pressureHpa: 1009.4,
  relativeAltitudeM: 0.2,
  magneticField: { x: -31.5, y: -50.4, z: -3.2 },
  trueHeading: 101,
  magneticHeading: 90,
  stepsToday: 734,
  gravity: { x: 0.21, y: -8.9, z: -4.12 },
  batteryState: 'unplugged',
  brightness: 0.93,
  networkType: 'wifi',
  deviceModel: 'iPhone',
  illuminance: null,
};

const androidPhone: PhoneTelemetry = {
  ...iosPhone,
  relativeAltitudeM: null,
  illuminance: 860,
  deviceModel: 'Pixel 9 Pro',
};

function withPhone(phone: PhoneTelemetry): SensorSample {
  return { ...motion, phone };
}

function labelsOf(style: Style, phone: PhoneTelemetry, note = 'The light on the water, right now.'): string[] {
  const scene = buildScene(style, { ...exampleMoment(EXAMPLE_INSTANT), sensors: withPhone(phone) }, note);
  const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode | undefined;
  if (footer?.telemetry) return footer.telemetry.lines.map((line) => line.label);
  const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode | undefined;
  const block = quiet?.blocks.find((item) => item.kind === 'telemetry');
  return block && block.kind === 'telemetry' ? block.lines.map((line) => line.label) : [];
}

describe('extended data', () => {
  it('is off by default and stays off until it is saved on', () => {
    expect(defaultMeasurements().extended).toBe(false);
    expect(isExtendedEnabled(defaultMeasurements())).toBe(false);
    expect(isExtendedEnabled({ extended: true })).toBe(true);
    const saved = sanitizeStyle({ ...styleFromPreset(presetById('02')), measurements: { extended: true } });
    expect(saved.measurements.extended).toBe(true);
    expect(sanitizeStyle(styleFromPreset(presetById('04'))).measurements.extended).toBe(false);
  });

  it('shows the switch only inside the native shell, after Telemetry', () => {
    expect(dataTogglePlugins(false).map((plugin) => plugin.title)).toEqual(['Temperature', 'Sun', 'Telemetry']);
    expect(dataTogglePlugins(true).map((plugin) => plugin.title)).toEqual(['Temperature', 'Sun', 'Telemetry', 'Extended data']);
  });

  it('keeps MAG and GRAV as three short numbers and drops a missing reading', () => {
    const rows = extendedReadings({ ...exampleMoment(EXAMPLE_INSTANT), sensors: withPhone(iosPhone) });
    expect(rows.map((row) => row.label)).toEqual(['BARO', 'RALT', 'MAG', 'TRUE', 'MH', 'GRAV', 'BAT', 'BSTAT', 'BRIGHT', 'NET', 'STEPS', 'MODEL']);
    expect(rows.find((row) => row.id === 'mag')?.values).toEqual(['−31.5', '−50.4', '−3.2']);
    expect(rows.find((row) => row.id === 'grav')?.values).toEqual(['0.21', '−8.90', '−4.12']);
    expect(rows.find((row) => row.id === 'baro')?.values).toEqual(['1009.4 hPa']);
    expect(rows.map((row) => row.id)).not.toContain('light');

    const android = extendedReadings({ ...exampleMoment(EXAMPLE_INSTANT), sensors: withPhone(androidPhone) });
    expect(android.map((row) => row.id)).not.toContain('ralt');
    expect(android.find((row) => row.id === 'light')?.values).toEqual(['860 lx']);
    expect(extendedReadings(exampleMoment(EXAMPLE_INSTANT))).toEqual([]);
  });

  it('puts every extended reading on the poster the capture records, without duplicating telemetry', () => {
    const moment = { ...exampleMoment(EXAMPLE_INSTANT), accuracy: 12, sensors: withPhone(iosPhone) };
    const style = styleFromPreset(presetById('02'));
    style.measurements = { ...style.measurements, telemetry: true, extended: true };
    const scene = buildScene(style, moment, 'The light on the water, right now.');
    const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode;
    const labels = footer.telemetry?.lines.map((line) => line.label) ?? [];
    expect(labels.length).toBeGreaterThan(8);
    expect(labels.filter((label) => label === 'BARO')).toHaveLength(1);
    expect(labels.filter((label) => label === 'TRUE')).toHaveLength(1);
    expect(labels.filter((label) => label === 'BAT')).toHaveLength(1);
    for (const label of ['MAG', 'GRAV', 'BSTAT', 'BRIGHT', 'MH', 'RALT']) expect(labels).toContain(label);
    expect(labels).not.toContain('LIGHT');
    expect(footer.telemetry?.columns).toBeGreaterThanOrEqual(2);
    expect(footer.telemetry?.font.family).toBe('IBM Plex Mono');
    const mag = footer.telemetry?.lines.find((line) => line.id === 'mag');
    expect(mag?.values).toEqual(['−31.5', '−50.4', '−3.2']);

    const record = makeRecord({
      moment,
      style,
      message: 'The light on the water, right now.',
      scene,
      png: new Blob(['png']),
      shares: [],
    });
    const recorded = record.lines.map((line) => line.text);
    expect(recorded).toContain('MAG  −31.5  −50.4  −3.2');
    expect(recorded).toContain('GRAV  0.21  −8.90  −4.12');
    expect(recorded.filter((line) => line.startsWith('BARO'))).toHaveLength(1);
    expect(recorded.filter((line) => line.startsWith('BAT'))).toHaveLength(1);

    style.measurements = { ...style.measurements, telemetry: false, extended: true };
    const only = labelsOf(style, iosPhone);
    expect(only).not.toContain('HDG');
    expect(only).not.toContain('ACC');
    expect(only.filter((label) => label === 'BAT')).toHaveLength(1);
    expect(only).toContain('MAG');
  });

  it('keeps the eight-line cap until extended data is on', () => {
    const style = styleFromPreset(presetById('02'));
    style.measurements = { ...style.measurements, telemetry: true, extended: false };
    const capped = linesForCard(style.measurements, { ...exampleMoment(EXAMPLE_INSTANT), sensors: withPhone(iosPhone) });
    expect(capped.length).toBeLessThanOrEqual(8);
    expect(capped.map((line) => line.label)).not.toContain('MAG');
    expect(labelsOf(style, iosPhone)).not.toContain('MAG');
  });

  it('fits the longest cards with an iOS set and an Android set', () => {
    const generic: Style = {
      ...styleFromPreset(presetById('04')),
      presetId: null,
      recipeId: 'quiet-generic',
      layout: 'quiet',
      align: 'left',
      displayFontId: 'big-shoulders',
      monoFontId: 'space-mono',
    };
    const styles = [styleFromPreset(presetById('02')), styleFromPreset(presetById('04')), generic, styleFromPreset(presetById('09'))];
    for (const style of styles) {
      style.measurements = { ...style.measurements, telemetry: true, extended: true, temperature: true, sun: true };
      for (const phone of [iosPhone, androidPhone]) {
        const moment = {
          ...exampleMoment(EXAMPLE_INSTANT),
          accuracy: 12,
          altitudeAccuracy: 4,
          speed: 4.5,
          course: 182,
          temperatureC: 18,
          sensors: withPhone(phone),
        };
        const scene = buildScene(style, moment, NOTE_200);
        expect(scene.width).toBe(1080);
        expect(scene.height).toBe(1080);
        const footer = scene.nodes.find((node) => node.kind === 'footer') as FooterNode | undefined;
        const quiet = scene.nodes.find((node) => node.kind === 'quiet') as QuietNode | undefined;
        const block = footer?.telemetry ?? (quiet?.blocks.find((item) => item.kind === 'telemetry') as QuietBlock | undefined);
        expect(block && 'lines' in block ? block.lines.length : 0, style.recipeId).toBeGreaterThan(8);
        if (footer?.telemetry) {
          expect(footer.telemetry.columns, style.recipeId).toBeGreaterThanOrEqual(2);
          expect(footer.telemetry.fontSize, style.recipeId).toBeGreaterThanOrEqual(11);
          expect(footerBlockHeight(footer) + footer.bottom, style.recipeId).toBeLessThanOrEqual(scene.height - 24);
          const footerTop = scene.height - footer.bottom - footerBlockHeight(footer);
          expect(footerTop, style.recipeId).toBeGreaterThan(200);
        }
        if (quiet) {
          const telemetry = quiet.blocks.find((item) => item.kind === 'telemetry');
          expect(telemetry && telemetry.kind === 'telemetry' && telemetry.columns, style.recipeId).toBeGreaterThanOrEqual(2);
          expect(telemetry && telemetry.kind === 'telemetry' && telemetry.fontSize, style.recipeId).toBeGreaterThanOrEqual(11);
          expect(quietStackHeight(quiet.blocks), style.recipeId).toBeLessThanOrEqual(scene.height - quiet.top - quiet.bottom + 0.5);
          if (style.recipeId === 'quiet-title-block') {
            const rows = quiet.blocks.find((item) => item.kind === 'rows');
            expect(rows && rows.kind === 'rows' && rows.rows.some((row) => row.label === 'MAG')).toBe(false);
          }
        }
        const labels = (footer?.telemetry?.lines ?? (quiet?.blocks.find((item) => item.kind === 'telemetry') as { lines?: { label: string }[] } | undefined)?.lines ?? []).map((line) => line.label);
        expect(new Set(labels).size, style.recipeId).toBe(labels.length);
        expect(labels, style.recipeId).toContain('MAG');
        expect(labels, style.recipeId).toContain('GRAV');
        if (phone === iosPhone) expect(labels, style.recipeId).not.toContain('LIGHT');
        if (phone === androidPhone) expect(labels, style.recipeId).not.toContain('RALT');
      }
    }
  });
});
