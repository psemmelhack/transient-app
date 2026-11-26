import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { contrastRatio, formatContrast } from '../src/color/contrast';
import { GRADIENT_ANGLES, gradientContrast } from '../src/color/gradient';
import type { PosterPhoto } from '../src/composition/posterPhoto';
import { isHex, normalizeHex } from '../src/color/oklch';
import { FORMAT_ORDER, FORMATS, formatChoiceEnabled } from '../src/composition/formats';
import { CATEGORIES, fontCss, fontsIn, getFont, monoFonts, resolveFont } from '../src/composition/fonts';
import { installMadeFont, madeFamily } from '../src/composition/madeFont';
import { dataTogglePlugins, isMeasurementEnabled } from '../src/data/plugins';
import { useNativeShell } from '../src/native/shell';
import { requestMotionAccess } from '../src/data/telemetry';
import { notifyTelemetryPermission } from '../src/location/useTelemetry';
import {
  withAlign,
  withAutoBackground,
  withBackground,
  withBackgroundFill,
  withGradientAngle,
  withGradientColor,
  withGradientStops,
  withRandomGradient,
  remixMade,
  withDisplayFont,
  withFormat,
  withLayout,
  withManualBackground,
  withMeasurement,
  withMonoFont,
  withPhotoTone,
  withPreset,
  withTemperatureUnit,
  withTextColor,
} from '../src/style/edit';
import { PRESETS } from '../src/style/presets';
import type { Style, TempUnit } from '../src/style/types';
import { Icon, type IconName } from './Icons';
import { ink, line, muted, paper, ui } from './theme';

const SWATCHES = ['#111111', '#FFFFFF', '#D2231C', '#4B1C40', '#1E3A2D', '#CBA65E', '#14203A', '#E3F03A', '#F2E8D5', '#F7E4E1'];

const MOTION_NOTE = 'Motion access is off. Location extras still show.';

export function Parameters({
  style,
  onChange,
  photo = null,
  onPickPhoto,
  onClearPhoto,
  photoNote = null,
  placeLatitude = null,
  placeLongitude = null,
}: {
  style: Style;
  onChange: (next: Style) => void;
  photo?: PosterPhoto | null;
  onPickPhoto?: () => void;
  onClearPhoto?: () => void;
  photoNote?: string | null;
  placeLatitude?: number | null;
  placeLongitude?: number | null;
}) {
  const shell = useNativeShell();
  const [motionNote, setMotionNote] = useState<string | null>(null);

  useEffect(() => {
    void installMadeFont(style.madeSeed);
  }, [style.madeSeed]);

  function onMeasurement(id: string, on: boolean) {
    const next = !on;
    if (id !== 'telemetry') {
      onChange(withMeasurement(style, id, next));
      return;
    }
    if (!next) {
      setMotionNote(null);
      onChange(withMeasurement(style, id, false));
      return;
    }
    const pending = requestMotionAccess();
    onChange(withMeasurement(style, id, true));
    void pending.then((access) => {
      setMotionNote(access === 'denied' ? MOTION_NOTE : null);
      notifyTelemetryPermission();
    }).catch(() => {
      setMotionNote(MOTION_NOTE);
      notifyTelemetryPermission();
    });
  }

  const engageTone = Boolean(photo);
  return (
    <div style={parametersStyle}>
      <Section label="Presets">
        <HScroll>
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
                <span style={{ marginTop: 6, fontFamily: ui, fontWeight: 500, fontSize: 10, letterSpacing: '0.14em', color: muted }}>{preset.id}</span>
                <span style={{ fontFamily: font.family, fontSize: 12, color: ink, maxWidth: '100%' }}>{preset.name}</span>
              </button>
            );
          })}
        </HScroll>
      </Section>

      <Section label="Camera">
        <PhotoControl
          photo={photo}
          style={style}
          onChange={onChange}
          onPickPhoto={onPickPhoto}
          onClearPhoto={onClearPhoto}
          photoNote={photoNote}
        />
      </Section>

      <Section label="Layout">
        <div style={{ display: 'flex', gap: 8 }}>
          <IconChoice icon="poster" label="Poster" pressed={style.layout === 'poster'} onPress={() => onChange(withLayout(style, 'poster'))} />
          <IconChoice icon="quiet" label="Quiet" pressed={style.layout === 'quiet'} onPress={() => onChange(withLayout(style, 'quiet'))} />
          <IconChoice icon="note" label="Note" pressed={style.layout === 'note'} onPress={() => onChange(withLayout(style, 'note'))} />
          <IconChoice icon="jam" label="Jam" pressed={style.layout === 'jam'} onPress={() => onChange(withLayout(style, 'jam'))} />
          <IconChoice icon="crush" label="Jam+" pressed={style.layout === 'crush'} onPress={() => onChange(withLayout(style, 'crush'))} />
        </div>
      </Section>

      <Section label="Alignment">
        <div style={{ display: 'flex', gap: 8 }}>
          <IconChoice icon="align-left" label="Align left" pressed={style.align === 'left'} onPress={() => onChange(withAlign(style, 'left'))} />
          <IconChoice icon="align-center" label="Align center" pressed={style.align === 'center'} onPress={() => onChange(withAlign(style, 'center'))} />
          <IconChoice icon="align-right" label="Align right" pressed={style.align === 'right'} onPress={() => onChange(withAlign(style, 'right'))} />
        </div>
      </Section>

      {formatChoiceEnabled && (
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
      )}

      <Section label="Type">
        {CATEGORIES.filter((category) => category.id !== 'mono').map((category) => (
          <div key={category.id} style={{ marginBottom: 14 }}>
            <div style={minorLabel}>{category.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0, maxWidth: '100%' }}>
              {fontsIn(category.id).map((font) => {
                const selected = style.displayFontId === font.id;
                const face = fontCss(resolveFont(font.id, style.monoFontId, 'display'));
                const preview = font.id === 'made' ? { ...face, fontFamily: `'${madeFamily(style.madeSeed)}', serif` } : face;
                return (
                  <button
                    key={font.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange(withDisplayFont(style, font.id))}
                    style={{
                      ...textChoice,
                      boxShadow: selected ? `inset 0 0 0 1px ${ink}` : 'inset 0 0 0 1px transparent',
                      ...preview,
                    }}
                  >
                    {font.name}
                  </button>
                );
              })}
              {category.id === 'made' && (
                <button
                  type="button"
                  aria-label="New made font"
                  onClick={() => onChange(remixMade(style, placeLatitude, placeLongitude))}
                  style={iconChoice(style.displayFontId === 'made')}
                >
                  <Icon name="refresh" size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
        <div style={minorLabel}>Small type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0, maxWidth: '100%' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <FillChoice label="Solid" pressed={style.backgroundFill !== 'gradient'} onPress={() => onChange(withBackgroundFill(style, 'solid'))} />
          <FillChoice label="Gradient" pressed={style.backgroundFill === 'gradient'} onPress={() => onChange(withBackgroundFill(style, 'gradient'))} />
          {style.backgroundFill === 'gradient' ? (
            <button type="button" aria-label="Randomize gradient" onClick={() => onChange(withRandomGradient(style))} style={iconChoice(false)}>
              <Icon name="die" size={18} color={ink} />
            </button>
          ) : (
            <button
              type="button"
              aria-pressed={style.backgroundMode === 'auto'}
              onClick={() => onChange(style.backgroundMode === 'auto' ? withManualBackground(style) : withAutoBackground(style))}
              style={fillChoice(style.backgroundMode === 'auto')}
            >
              Auto
            </button>
          )}
          <span style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, letterSpacing: '0.04em', color: muted }}>
            {formatContrast(style.backgroundFill === 'gradient' ? gradientContrast(style.textColor, style.gradient) : contrastRatio(style.textColor, style.backgroundColor))}
          </span>
        </div>
        {style.backgroundFill === 'gradient' ? (
          <GradientFields style={style} onChange={onChange} covered={Boolean(photo)} />
        ) : (
          <>
            <Swatches value={style.backgroundColor} onPick={(hex) => onChange(withBackground(style, hex, engageTone))} />
            <HexField label="Background color hex" value={style.backgroundColor} onCommit={(hex) => onChange(withBackground(style, hex, engageTone))} />
          </>
        )}
      </Section>

      <Section label="Data">
        {dataTogglePlugins(shell).map((plugin) => {
            const on = isMeasurementEnabled(style.measurements, plugin);
            return (
              <div key={plugin.id}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-describedby={plugin.id === 'telemetry' && motionNote ? 'telemetry-note' : undefined}
                  onClick={() => onMeasurement(plugin.id, on)}
                  style={switchRow}
                >
                  <span>{plugin.title}</span>
                  <Toggle on={on} />
                </button>
                {plugin.id === 'telemetry' && motionNote && (
                  <p id="telemetry-note" style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, lineHeight: 1.45, color: muted, margin: '8px 0 4px' }}>
                    {motionNote}
                  </p>
                )}
                {plugin.id === 'temperature' && on && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 0 12px', minWidth: 0, maxWidth: '100%' }}>
                    {(['F', 'C', 'both'] as TempUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        aria-pressed={style.temperatureUnit === unit}
                        onClick={() => onChange(withTemperatureUnit(style, unit))}
                        style={{
                          ...textChoice,
                          fontFamily: ui,
                          fontWeight: 500,
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

function PhotoControl({
  photo,
  style,
  onChange,
  onPickPhoto,
  onClearPhoto,
  photoNote,
}: {
  photo: PosterPhoto | null;
  style: Style;
  onChange: (style: Style) => void;
  onPickPhoto?: () => void;
  onClearPhoto?: () => void;
  photoNote?: string | null;
}) {
  const level = Math.round(style.photoTone * 100);
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" aria-label={photo ? 'Replace photo' : 'Add photo'} onClick={onPickPhoto} style={iconChoice(Boolean(photo))}>
          <Icon name="camera" size={22} color={ink} />
        </button>
        {photo ? (
          <>
            <img src={photo.jpeg} alt="" style={{ width: 36, height: 36, objectFit: 'cover', flex: 'none' }} />
            <button type="button" aria-label="Clear" onClick={onClearPhoto} style={clearControl}>
              <Icon name="close" size={16} color={ink} />
              <span>Clear</span>
            </button>
          </>
        ) : null}
      </div>
      {photo ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
            <div style={{ ...minorLabel, margin: 0 }}>Tone</div>
            <span style={{ fontFamily: ui, fontWeight: 500, fontSize: 12, letterSpacing: '0.06em', color: ink }}>{level}</span>
          </div>
          <ToneSlider level={style.photoTone} onChange={(next) => onChange(withPhotoTone(style, next))} />
        </div>
      ) : null}
      {photoNote ? (
        <p style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, lineHeight: 1.45, color: muted, margin: '8px 0 0' }}>{photoNote}</p>
      ) : null}
    </>
  );
}

function ToneSlider({ level, onChange }: { level: number; onChange: (level: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const amount = Math.min(1, Math.max(0, level));
  function setFromClient(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 18) return;
    const next = Math.round(Math.min(1, Math.max(0, (clientX - rect.left - 9) / (rect.width - 18))) * 100) / 100;
    onChange(next);
  }
  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Duotone level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(amount * 100)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setFromClient(event.clientX);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        setFromClient(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') onChange(Math.min(1, Math.round((amount + 0.05) * 100) / 100));
        if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') onChange(Math.max(0, Math.round((amount - 0.05) * 100) / 100));
      }}
      style={{ position: 'relative', height: 44, touchAction: 'none', cursor: 'pointer' }}
    >
      <div style={{ position: 'absolute', left: 9, right: 9, top: 21, height: 2, background: ink }} />
      <div
        style={{
          position: 'absolute',
          top: 13,
          left: `calc(9px + (100% - 18px) * ${amount})`,
          width: 18,
          height: 18,
          boxSizing: 'border-box',
          borderRadius: 999,
          background: ink,
          border: `2px solid ${paper}`,
        }}
      />
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

function FillChoice({ label, pressed, onPress, name = label }: { label: string; pressed: boolean; onPress: () => void; name?: string }) {
  return (
    <button type="button" aria-label={name} aria-pressed={pressed} onClick={onPress} style={fillChoice(pressed)}>
      {label}
    </button>
  );
}

function GradientFields({ style, onChange, covered }: { style: Style; onChange: (style: Style) => void; covered: boolean }) {
  const fields = style.gradient.stops === 3
    ? ([{ index: 0, name: 'Start' }, { index: 1, name: 'Middle' }, { index: 2, name: 'End' }] as const)
    : ([{ index: 0, name: 'Start' }, { index: 2, name: 'End' }] as const);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <FillChoice label="2" name="Two colors" pressed={style.gradient.stops === 2} onPress={() => onChange(withGradientStops(style, 2))} />
        <FillChoice label="3" name="Three colors" pressed={style.gradient.stops === 3} onPress={() => onChange(withGradientStops(style, 3))} />
      </div>
      {fields.map(({ index, name }) => {
        const hex = style.gradient.colors[index] ?? style.gradient.colors[0];
        return (
          <div key={name} style={{ marginBottom: 12 }}>
            <div style={minorLabel}>{name}</div>
            <Swatches value={hex} label={`${name} color`} onPick={(next) => onChange(withGradientColor(style, index, next))} />
            <HexField label={`${name} color hex`} value={hex} onCommit={(next) => onChange(withGradientColor(style, index, next))} />
          </div>
        );
      })}
      <div style={minorLabel}>Angle</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {GRADIENT_ANGLES.map((angle) => (
          <button
            key={angle}
            type="button"
            aria-label={`Gradient angle ${angle}`}
            aria-pressed={style.gradient.angle === angle}
            onClick={() => onChange(withGradientAngle(style, angle))}
            style={iconChoice(style.gradient.angle === angle)}
          >
            <span style={{ display: 'inline-flex', transform: `rotate(${angle}deg)` }}>
              <Icon name="angle" size={18} color={ink} />
            </span>
          </button>
        ))}
      </div>
      {covered ? (
        <p style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, lineHeight: 1.45, color: muted, margin: '10px 0 0' }}>
          The photo covers this. Clear it to show the gradient.
        </p>
      ) : null}
    </div>
  );
}

function Swatches({ value, onPick, label = 'Custom color' }: { value: string; onPick: (hex: string) => void; label?: string }) {
  const current = normalizeHex(value);
  return (
    <HScroll gap={8}>
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
              boxSizing: 'border-box',
              flex: 'none',
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
        aria-label={label}
        value={current}
        onChange={(event) => onPick(event.target.value)}
        style={{ width: 28, height: 28, boxSizing: 'border-box', flex: 'none', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
      />
    </HScroll>
  );
}

function HScroll({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ left: el.scrollLeft > 2, right: max - el.scrollLeft > 2 });
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, []);

  return (
    <div style={{ position: 'relative', minWidth: 0, maxWidth: '100%' }}>
      <div ref={ref} className="h-scroll" style={{ display: 'flex', gap, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4, maxWidth: '100%', minWidth: 0 }}>
        {children}
      </div>
      {edges.left && <div className="h-fade h-fade-left" />}
      {edges.right && <div className="h-fade h-fade-right" />}
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
        fontFamily: ui,
        fontWeight: 400,
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
        boxSizing: 'border-box',
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
  fontFamily: ui,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: muted,
};

const minorLabel: CSSProperties = {
  margin: '0 0 8px',
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: muted,
};

const parametersStyle: CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  paddingTop: 8,
  paddingBottom: 28,
  paddingLeft: 'max(22px, env(safe-area-inset-left))',
  paddingRight: 'max(22px, env(safe-area-inset-right))',
  fontFamily: ui,
  fontWeight: 400,
};

const chipButton: CSSProperties = {
  width: 78,
  flex: '0 0 78px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  padding: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: ink,
  textAlign: 'left',
  boxSizing: 'border-box',
};

function fillChoice(pressed: boolean): CSSProperties {
  return {
    ...textChoice,
    fontFamily: ui,
    fontWeight: 500,
    fontSize: 12,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: pressed ? paper : ink,
    background: pressed ? ink : 'transparent',
    boxShadow: pressed ? 'none' : `inset 0 0 0 1px ${line}`,
  };
}

const textChoice: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: ink,
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: 20,
  lineHeight: 1.2,
  maxWidth: '100%',
  boxSizing: 'border-box',
  whiteSpace: 'normal',
  textAlign: 'left',
};

const clearControl: CSSProperties = {
  minHeight: 44,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 14px 0 10px',
  border: 'none',
  borderRadius: 999,
  background: 'transparent',
  boxShadow: `inset 0 0 0 1px ${line}`,
  cursor: 'pointer',
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 14,
  letterSpacing: '0.04em',
  color: ink,
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
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
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
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 16,
  textAlign: 'left',
};
