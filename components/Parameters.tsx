import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { contrastRatio, formatContrast } from '../src/color/contrast';
import { isHex, normalizeHex } from '../src/color/oklch';
import { FORMAT_ORDER, FORMATS } from '../src/composition/formats';
import { CATEGORIES, fontCss, fontsIn, getFont, monoFonts, resolveFont } from '../src/composition/fonts';
import { dataLinePlugins, isMeasurementEnabled } from '../src/data/plugins';
import {
  withAlign,
  withAutoBackground,
  withBackground,
  withDisplayFont,
  withFormat,
  withLayout,
  withMeasurement,
  withMonoFont,
  withPreset,
  withTemperatureUnit,
  withTextColor,
} from '../src/style/edit';
import { PRESETS } from '../src/style/presets';
import type { Style, TempUnit } from '../src/style/types';
import { Icon, type IconName } from './Icons';
import { ink, line, mono, muted, paper, serif } from './theme';

const SWATCHES = ['#111111', '#FFFFFF', '#D2231C', '#4B1C40', '#1E3A2D', '#CBA65E', '#14203A', '#E3F03A', '#F2E8D5', '#F7E4E1'];

export function Parameters({ style, onChange }: { style: Style; onChange: (next: Style) => void }) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '8px 22px 28px', width: '100%' }}>
      <Section label="Presets">
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {PRESETS.map((preset) => {
            const font = getFont(preset.displayFontId);
            const selected = style.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(withPreset(style, preset))}
                style={chipButton}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    height: 84,
                    padding: 8,
                    background: preset.backgroundColor,
                    boxShadow: selected ? `inset 0 0 0 1.5px ${ink}` : 'inset 0 0 0 1px rgba(28,27,25,0.14)',
                  }}
                >
                  <span style={{ ...fontCss(resolveFont(preset.displayFontId, preset.monoFontId, 'display')), color: preset.textColor, fontSize: 28, lineHeight: 0.9 }}>
                    Aa
                  </span>
                </span>
                <span style={{ marginTop: 6, fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', color: muted }}>{preset.id}</span>
                <span style={{ fontFamily: font.family, fontSize: 12, color: ink }}>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Layout">
        <div style={{ display: 'flex', gap: 8 }}>
          <IconChoice icon="poster" label="Poster" pressed={style.layout === 'poster'} onPress={() => onChange(withLayout(style, 'poster'))} />
          <IconChoice icon="quiet" label="Quiet" pressed={style.layout === 'quiet'} onPress={() => onChange(withLayout(style, 'quiet'))} />
        </div>
      </Section>

      <Section label="Alignment">
        <div style={{ display: 'flex', gap: 8 }}>
          <IconChoice icon="align-left" label="Align left" pressed={style.align === 'left'} onPress={() => onChange(withAlign(style, 'left'))} />
          <IconChoice icon="align-center" label="Align center" pressed={style.align === 'center'} onPress={() => onChange(withAlign(style, 'center'))} />
          <IconChoice icon="align-right" label="Align right" pressed={style.align === 'right'} onPress={() => onChange(withAlign(style, 'right'))} />
        </div>
      </Section>

      <Section label="Format">
        <div style={{ display: 'flex', gap: 8 }}>
          {FORMAT_ORDER.map((id) => (
            <IconChoice
              key={id}
              icon={id}
              label={`${FORMATS[id].label}, ${FORMATS[id].width} by ${FORMATS[id].height}`}
              pressed={style.format === id}
              onPress={() => onChange(withFormat(style, id))}
            />
          ))}
        </div>
      </Section>

      <Section label="Type">
        {CATEGORIES.filter((category) => category.id !== 'mono').map((category) => (
          <div key={category.id} style={{ marginBottom: 14 }}>
            <div style={minorLabel}>{category.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {fontsIn(category.id).map((font) => {
                const selected = style.displayFontId === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(withDisplayFont(style, font.id))}
                    style={{
                      ...textChoice,
                      boxShadow: selected ? `inset 0 0 0 1px ${ink}` : 'inset 0 0 0 1px transparent',
                      fontFamily: `'${font.family}', serif`,
                      fontWeight: font.weight,
                      fontStyle: font.style,
                      fontVariationSettings: font.variation,
                    }}
                  >
                    {font.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={minorLabel}>Small type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {monoFonts().map((font) => {
            const selected = style.monoFontId === font.id;
            return (
              <button
                key={font.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(withMonoFont(style, font.id))}
                style={{
                  ...textChoice,
                  fontSize: 15,
                  boxShadow: selected ? `inset 0 0 0 1px ${ink}` : 'inset 0 0 0 1px transparent',
                  fontFamily: `'${font.family}', monospace`,
                  fontWeight: font.weight,
                }}
              >
                {font.name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section label="Color">
        <div style={minorLabel}>Text</div>
        <Swatches value={style.textColor} onPick={(hex) => onChange(withTextColor(style, hex))} />
        <HexField label="Text color hex" value={style.textColor} onCommit={(hex) => onChange(withTextColor(style, hex))} />
        <div style={{ ...minorLabel, marginTop: 16 }}>Background</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button
            type="button"
            aria-pressed={style.backgroundMode === 'auto'}
            onClick={() => onChange(withAutoBackground(style))}
            style={{
              ...textChoice,
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              boxShadow: style.backgroundMode === 'auto' ? `inset 0 0 0 1px ${ink}` : `inset 0 0 0 1px ${line}`,
            }}
          >
            Auto
          </button>
          <span style={{ fontFamily: mono, fontSize: 12, color: muted }}>{formatContrast(contrastRatio(style.textColor, style.backgroundColor))}</span>
        </div>
        <Swatches value={style.backgroundColor} onPick={(hex) => onChange(withBackground(style, hex))} />
        <HexField label="Background color hex" value={style.backgroundColor} onCommit={(hex) => onChange(withBackground(style, hex))} />
      </Section>

      <Section label="Data">
        {dataLinePlugins
          .filter((plugin) => plugin.toggle)
          .map((plugin) => {
            const on = isMeasurementEnabled(style.measurements, plugin);
            return (
              <div key={plugin.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => onChange(withMeasurement(style, plugin.id, !on))}
                  style={switchRow}
                >
                  <span>{plugin.title}</span>
                  <Toggle on={on} />
                </button>
                {plugin.id === 'temperature' && on && (
                  <div style={{ display: 'flex', gap: 8, padding: '0 0 12px' }}>
                    {(['F', 'C', 'both'] as TempUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        aria-pressed={style.temperatureUnit === unit}
                        onClick={() => onChange(withTemperatureUnit(style, unit))}
                        style={{
                          ...textChoice,
                          fontFamily: mono,
                          fontSize: 13,
                          boxShadow: style.temperatureUnit === unit ? `inset 0 0 0 1px ${ink}` : `inset 0 0 0 1px ${line}`,
                        }}
                      >
                        {unit === 'both' ? '°F + °C' : `°${unit}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={sectionLabel}>{label}</h2>
      {children}
    </section>
  );
}

function IconChoice({ icon, label, pressed, onPress }: { icon: IconName; label: string; pressed: boolean; onPress: () => void }) {
  return (
    <button type="button" aria-label={label} aria-pressed={pressed} onClick={onPress} style={iconChoice(pressed)}>
      <Icon name={icon} size={22} color={ink} />
    </button>
  );
}

function Swatches({ value, onPick }: { value: string; onPick: (hex: string) => void }) {
  const current = normalizeHex(value);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {SWATCHES.map((hex) => {
        const selected = current === hex;
        return (
          <button
            key={hex}
            type="button"
            aria-label={hex}
            aria-pressed={selected}
            onClick={() => onPick(hex)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              padding: 0,
              cursor: 'pointer',
              background: hex,
              border: selected ? `2px solid ${ink}` : '1px solid rgba(28,27,25,0.2)',
            }}
          />
        );
      })}
      <input
        type="color"
        aria-label="Custom color"
        value={current}
        onChange={(event) => onPick(event.target.value)}
        style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
      />
    </div>
  );
}

function HexField({ value, onCommit, label }: { value: string; onCommit: (hex: string) => void; label: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={label}
      value={draft}
      spellCheck={false}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        if (isHex(next)) onCommit(next);
      }}
      style={{
        marginTop: 8,
        width: 108,
        border: 'none',
        borderBottom: `1px solid ${line}`,
        background: 'transparent',
        fontFamily: mono,
        fontSize: 13,
        color: ink,
        padding: '6px 0',
        outline: 'none',
      }}
    />
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        border: `1px solid ${on ? ink : line}`,
        background: on ? ink : 'transparent',
        position: 'relative',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: on ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: 999,
          background: on ? paper : muted,
          transition: 'left 180ms ease',
        }}
      />
    </span>
  );
}

const sectionLabel: CSSProperties = {
  margin: '0 0 12px',
  fontFamily: mono,
  fontSize: 11,
  fontWeight: 400,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: muted,
};

const minorLabel: CSSProperties = {
  margin: '0 0 8px',
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: muted,
};

const chipButton: CSSProperties = {
  width: 78,
  flex: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: ink,
  textAlign: 'left',
};

const textChoice: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: ink,
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: 20,
  lineHeight: 1.2,
};

function iconChoice(pressed: boolean): CSSProperties {
  return {
    width: 44,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 999,
    cursor: 'pointer',
    background: pressed ? 'rgba(28,27,25,0.06)' : 'transparent',
    boxShadow: pressed ? `inset 0 0 0 1px ${line}` : 'none',
  };
}

const switchRow: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  padding: '14px 0',
  border: 'none',
  borderBottom: `1px solid ${line}`,
  background: 'transparent',
  color: ink,
  cursor: 'pointer',
  fontFamily: serif,
  fontSize: 22,
  textAlign: 'left',
};
