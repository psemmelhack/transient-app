import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { buildScene } from '../src/composition/scene';
import { captureStage } from '../src/export/capture';
import { captureFileName, downloadBlob } from '../src/export/download';
import { saveImage } from '../src/share/share';
import { insertPngText, metadataFor } from '../src/export/pngMeta';
import { telemetryLineText, telemetryLines } from '../src/data/telemetry';
import { previewBox, PIN_HEADER } from '../src/layout/previewSize';
import { useMoment } from '../src/location/useMoment';
import { applyTelemetry, useTelemetry, type TelemetryLive } from '../src/location/useTelemetry';
import { isTelemetryEnabled } from '../src/data/plugins';
import type { Moment } from '../src/data/moment';
import { sunPosition } from '../src/data/solar';
import type { Scene } from '../src/composition/scene';
import { makeRecord, sharesForCapture } from '../src/storage/record';
import { saveTransient } from '../src/storage/library';
import { CompositionStage } from './CompositionStage';
import { Icon } from './Icons';
import { Parameters } from './Parameters';
import { useStyle } from './StyleContext';
import { captureLabel, capturedToast, savedToDownloads, sharedWithLabel } from '../src/ui/actions';
import { ink, line, muted, paper, ui } from './theme';

const NOTE_LIMIT = 200;

export function MakeScreen({ onMap, fixture = false }: { onMap: () => void; fixture?: boolean }) {
  const { style, update, randomize, undo, canUndo } = useStyle();
  const { moment, now, retry } = useMoment(fixture);
  const telemetryOn = isTelemetryEnabled(style.measurements);
  const telemetry = useTelemetry(telemetryOn);
  const [note, setNote] = useState('');
  const [sharedWith, setSharedWith] = useState('');
  const [lock, setLock] = useState<Moment | null>(null);
  const [atControls, setAtControls] = useState(false);
  const [viewport, setViewport] = useState({ width: 390, height: 800 });
  const [dockHeight, setDockHeight] = useState(156);
  const [roll, setRoll] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const [heldUrl, setHeldUrl] = useState<string | null>(null);
  const heldUrlRef = useRef<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);

  const shown = useMemo(() => {
    const base = lock ?? moment;
    if (!base || lock) return base;
    return applyTelemetry(base, telemetryOn ? telemetry.sensors : null, telemetryOn ? telemetry.location : null);
  }, [lock, moment, telemetry.sensors, telemetry.location, telemetryOn]);
  const scene = useMemo(() => buildScene(style, shown, note, shown?.at ?? now), [style, shown, note, now]);
  const box = previewBox({
    sceneWidth: scene.width,
    sceneHeight: scene.height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    dockHeight,
  });

  useEffect(() => {
    return () => {
      if (heldUrlRef.current) URL.revokeObjectURL(heldUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const apply = () => {
      setViewport({ width: scroller.clientWidth, height: scroller.clientHeight });
      const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      const show = remaining > 72;
      setMoreBelow((prev) => (prev === show ? prev : show));
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(scroller);
    for (const child of scroller.children) observer.observe(child);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const apply = () => setDockHeight(dock.offsetHeight);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const next = scroller.scrollTop > 8;
    setAtControls((prev) => (prev === next ? prev : next));
    const remaining = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const show = remaining > 72;
    setMoreBelow((prev) => (prev === show ? prev : show));
  }

  function onMore() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollBy({ top: scroller.clientHeight, behavior: reduce ? 'auto' : 'smooth' });
  }

  function onStyle() {
    const scroller = scrollerRef.current;
    const params = paramsRef.current;
    const pin = pinRef.current;
    if (!scroller || !params || !pin) return;
    if (scroller.scrollTop > 8) {
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    scroller.scrollTo({ top: Math.max(0, params.offsetTop - pin.offsetHeight + 4), behavior: 'smooth' });
  }

  function onDie() {
    setRoll((value) => value + 1);
    setDimmed(true);
    randomize();
    window.setTimeout(() => setDimmed(false), 60);
  }

  async function renderPng(frozen: Moment): Promise<{ png: Blob; scene: Scene }> {
    flushSync(() => setLock(frozen));
    const stage = stageRef.current;
    if (!stage) throw new Error('The composition is not ready');
    const sceneNow = buildScene(style, frozen, note, frozen.at);
    const raw = await captureStage(stage, sceneNow);
    let png = raw;
    try {
      const bytes = new Uint8Array(await raw.arrayBuffer());
      const sun = sunPosition(frozen.at, frozen.latitude, frozen.longitude);
      const stamped = insertPngText(
        bytes,
        metadataFor({
          latitude: frozen.latitude,
          longitude: frozen.longitude,
          altitude: frozen.altitude,
          accuracy: frozen.accuracy,
          utc: frozen.at.toISOString(),
          timezone: frozen.timezone,
          message: note,
          place: frozen.place?.full ?? null,
          temperatureC: frozen.temperatureC,
          sunAzimuth: sun.azimuth,
          sunAltitude: sun.altitude,
          telemetry: telemetryLines(frozen).map((line) => telemetryLineText(line)),
        }),
      );
      const copy = new Uint8Array(stamped.byteLength);
      copy.set(stamped);
      png = new Blob([copy], { type: 'image/png' });
    } catch {
      png = raw.type === 'image/png' ? raw : new Blob([raw], { type: 'image/png' });
    }
    return { png, scene: sceneNow };
  }

  function presentImage(blob: Blob) {
    const url = URL.createObjectURL(blob);
    if (heldUrlRef.current) URL.revokeObjectURL(heldUrlRef.current);
    heldUrlRef.current = url;
    setHeldUrl(url);
  }

  function dismissHeld() {
    if (heldUrlRef.current) URL.revokeObjectURL(heldUrlRef.current);
    heldUrlRef.current = null;
    setHeldUrl(null);
  }

  async function onSave() {
    if (!moment || working) return;
    setWorking(true);
    let produced = false;
    try {
      const frozen = freeze(moment, telemetry.capture());
      const rendered = await renderPng(frozen);
      produced = true;
      const delivered = await saveImage(rendered.png, captureFileName(frozen.at, frozen.timezone), downloadBlob, presentImage);
      if (delivered === 'cancelled') return;
      await saveTransient(
        makeRecord({
          moment: frozen,
          style,
          message: note,
          scene: rendered.scene,
          png: rendered.png,
          shares: sharesForCapture(delivered === 'saved' ? '' : sharedWith),
        }),
      );
      setSharedWith('');
      setToast(delivered === 'downloads' ? savedToDownloads : capturedToast);
    } catch {
      setToast(produced ? 'Couldn’t share the image' : 'Couldn’t make the image');
    } finally {
      setLock(null);
      setWorking(false);
    }
  }

  const sample = shown?.source === 'example' && !fixture;

  return (
    <div style={{ height: '100%', width: '100%', minWidth: 0, minHeight: 0, background: paper, color: ink, fontFamily: ui, fontWeight: 400 }}>
      <style>{chromeCss}</style>
      <div ref={scrollerRef} onScroll={onScroll} style={scrollerStyle}>
        <div ref={pinRef} style={{ ...pinStyle, height: box.pinHeight }}>
          <header style={headerStyle}>
            <div style={{ fontFamily: ui, fontWeight: 500, fontSize: 20, letterSpacing: '0.04em' }}>Transient</div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button type="button" aria-label="Undo" onClick={undo} style={{ ...iconBtn, opacity: canUndo ? 1 : 0, pointerEvents: canUndo ? 'auto' : 'none' }}>
                <Icon name="undo" size={20} color={ink} />
              </button>
              <button type="button" aria-label="Randomize style" onClick={onDie} style={iconBtn}>
                <span key={roll} className={roll > 0 ? 'tumble' : undefined} style={{ display: 'inline-flex' }}>
                  <Icon name="die" size={20} color={ink} />
                </span>
              </button>
              <button type="button" aria-label={atControls ? 'Hide style' : 'Style'} aria-pressed={atControls} onClick={onStyle} style={iconBtn}>
                <Icon name="sliders" size={20} color={ink} />
              </button>
              <button type="button" aria-label="My transients" onClick={onMap} style={iconBtn}>
                <Icon name="map" size={20} color={ink} />
              </button>
            </div>
          </header>
          <div style={{ height: box.height, display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: box.width,
                transition: 'width 320ms ease, opacity 280ms ease',
                opacity: dimmed ? 0.45 : 1,
                boxShadow: '0 0 0 1px rgba(28,27,25,0.14)',
              }}
            >
              <CompositionStage
                scene={scene}
                ref={(node: unknown) => {
                  stageRef.current = node instanceof HTMLElement ? node : null;
                }}
              />
            </div>
          </div>
          <div className="pin-fade" />
        </div>

        <div ref={dockRef} style={dockStyle}>
          <label style={{ display: 'block' }}>
            <span className="sr">Note</span>
            <textarea
              value={note}
              maxLength={NOTE_LIMIT}
              rows={2}
              placeholder="A note, if you want one"
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_LIMIT))}
              style={noteStyle}
            />
          </label>
          <input
            value={sharedWith}
            onChange={(event) => setSharedWith(event.target.value)}
            placeholder={sharedWithLabel}
            aria-label={sharedWithLabel}
            autoComplete="off"
            enterKeyHint="done"
            style={sharedStyle}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, letterSpacing: '0.04em', color: note.length > 180 ? ink : muted }}>
              {note.length} / {NOTE_LIMIT}
            </span>
            <button type="button" aria-label={captureLabel} disabled={!moment || working} onClick={onSave} style={textAction(!moment || working)}>
              {captureLabel}
            </button>
          </div>
          {sample && (
            <p style={sampleStyle}>
              Sample place, while location is off.{' '}
              <button type="button" onClick={retry} style={retryStyle}>
                Try again
              </button>
            </p>
          )}
        </div>

        <div style={{ height: box.gap, transition: 'height 320ms ease' }} />

        <div ref={paramsRef} style={{ scrollMarginTop: box.pinHeight, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <Parameters style={style} onChange={update} />
          <div style={{ height: 'max(64px, env(safe-area-inset-bottom))' }} />
        </div>
      </div>

      <div className="fold-hint-slot">
        <button
          type="button"
          aria-label="More below"
          tabIndex={moreBelow && !heldUrl ? 0 : -1}
          onClick={onMore}
          className={moreBelow && !heldUrl ? 'fold-hint' : 'fold-hint fold-hint-hidden'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6.5 9.25 12 14.75 17.5 9.25" fill="none" stroke={muted} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
        </div>
      )}

      {heldUrl && (
        <div role="dialog" aria-label="Captured image" style={heldStyle}>
          <button type="button" aria-label="Close" onClick={dismissHeld} style={heldClose}>
            <Icon name="close" size={20} color={ink} />
          </button>
          <img src={heldUrl} alt="Captured transient" style={heldImg} />
          <p style={heldHint}>Long-press the image to save it</p>
        </div>
      )}
    </div>
  );
}

function freeze(moment: Moment, captured: ReturnType<TelemetryLive['capture']>): Moment {
  return { ...applyTelemetry(moment, captured.sensors, captured.location), at: new Date() };
}

const scrollerStyle: CSSProperties = {
  height: '100%',
  width: '100%',
  minWidth: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  position: 'relative',
  WebkitOverflowScrolling: 'touch',
};

const pinStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 5,
  background: paper,
  boxSizing: 'border-box',
  transition: 'height 320ms ease',
};

const headerStyle: CSSProperties = {
  height: PIN_HEADER,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 'max(22px, env(safe-area-inset-left))',
  paddingRight: 'max(12px, env(safe-area-inset-right))',
  boxSizing: 'border-box',
};

const iconBtn: CSSProperties = {
  width: 40,
  height: 40,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: ink,
};

function textAction(disabled: boolean): CSSProperties {
  return {
    minWidth: 44,
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    border: 'none',
    background: 'transparent',
    padding: '0 14px',
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: ui,
    fontWeight: 500,
    fontSize: 14,
    letterSpacing: '0.04em',
    color: disabled ? muted : ink,
  };
}

const dockStyle: CSSProperties = {
  maxWidth: 680,
  margin: '0 auto',
  paddingTop: 6,
  paddingBottom: 8,
  paddingLeft: 'max(22px, env(safe-area-inset-left))',
  paddingRight: 'max(22px, env(safe-area-inset-right))',
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
};

const sharedStyle: CSSProperties = {
  width: '100%',
  marginTop: 8,
  border: 'none',
  background: 'transparent',
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 13,
  lineHeight: 1.4,
  color: ink,
  padding: '4px 0',
  outline: 'none',
};

const noteStyle: CSSProperties = {
  width: '100%',
  resize: 'none',
  border: 'none',
  borderBottom: `1px solid ${line}`,
  background: 'transparent',
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 17,
  lineHeight: 1.35,
  color: ink,
  padding: '8px 0',
  outline: 'none',
};

const sampleStyle: CSSProperties = {
  margin: '8px 0 0',
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 12,
  letterSpacing: '0.02em',
  color: muted,
};

const retryStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 12,
  color: ink,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
};

const heldStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: paper,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  gap: 14,
  paddingTop: 'max(12px, env(safe-area-inset-top))',
  paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
  paddingLeft: 'max(18px, env(safe-area-inset-left))',
  paddingRight: 'max(18px, env(safe-area-inset-right))',
  boxSizing: 'border-box',
};

const heldClose: CSSProperties = {
  alignSelf: 'flex-end',
  width: 44,
  height: 44,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  color: ink,
};

const heldImg: CSSProperties = {
  width: '100%',
  height: 'auto',
  maxHeight: 'calc(100% - 88px)',
  objectFit: 'contain',
  alignSelf: 'center',
  WebkitTouchCallout: 'default',
};

const heldHint: CSSProperties = {
  margin: 0,
  textAlign: 'center',
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 13,
  letterSpacing: '0.02em',
  color: muted,
};

const toastStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 28,
  transform: 'translateX(-50%)',
  zIndex: 40,
  background: ink,
  color: paper,
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: '0.08em',
  padding: '8px 14px',
  pointerEvents: 'none',
};

const chromeCss = `
  button, input, textarea { font: inherit; color: inherit; box-sizing: border-box; max-width: 100%; }
  textarea::placeholder, input::placeholder { color: ${muted}; }
  .h-scroll { scrollbar-width: none; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; }
  .h-scroll::-webkit-scrollbar { display: none; }
  .h-fade { position: absolute; top: 0; bottom: 4px; width: 28px; pointer-events: none; }
  .h-fade-right { right: 0; background: linear-gradient(to right, rgba(243, 240, 234, 0), ${paper}); }
  .h-fade-left { left: 0; background: linear-gradient(to left, rgba(243, 240, 234, 0), ${paper}); }
  .pin-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 36px;
    transform: translateY(100%);
    pointer-events: none;
    background: linear-gradient(to bottom, ${paper} 0%, rgba(243, 240, 234, 0) 100%);
  }
  .tumble { animation: tumble 460ms ease; display: inline-flex; }
  @keyframes tumble { from { transform: rotate(0deg); } to { transform: rotate(180deg); } }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
  .fold-hint-slot {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(10px + env(safe-area-inset-bottom));
    z-index: 20;
    height: 24px;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }
  .fold-hint {
    width: 24px;
    height: 24px;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.46;
    pointer-events: auto;
    transition: opacity 420ms ease;
    animation: fold-bob 3.6s ease-in-out infinite;
  }
  .fold-hint-hidden {
    opacity: 0;
    pointer-events: none;
    animation: none;
  }
  @keyframes fold-bob {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(3px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tumble { animation: none; }
    .fold-hint { animation: none; transition: none; }
  }
`;
