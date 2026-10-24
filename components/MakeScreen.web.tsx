import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { buildScene } from '../src/composition/scene';
import { captureStage } from '../src/export/capture';
import { downloadBlob, fileNameFor } from '../src/export/download';
import { insertPngText, metadataFor } from '../src/export/pngMeta';
import { previewBox, PIN_HEADER } from '../src/layout/previewSize';
import { useMoment } from '../src/location/useMoment';
import type { Moment } from '../src/data/moment';
import { sunPosition } from '../src/data/solar';
import type { Scene } from '../src/composition/scene';
import { makeRecord } from '../src/storage/record';
import { saveTransient, type ShareEntry } from '../src/storage/library';
import { CompositionStage } from './CompositionStage';
import { Icon } from './Icons';
import { Parameters } from './Parameters';
import { ShareSheet } from './ShareSheet';
import { useStyle } from './StyleContext';
import { ink, line, muted, paper, ui } from './theme';

const NOTE_LIMIT = 200;

interface PendingShare {
  png: Blob;
  moment: Moment;
  scene: Scene;
}

export function MakeScreen({ onMap, fixture = false }: { onMap: () => void; fixture?: boolean }) {
  const { style, update, randomize, undo, canUndo } = useStyle();
  const { moment, now, retry } = useMoment(fixture);
  const [note, setNote] = useState('');
  const [lock, setLock] = useState<Moment | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [viewport, setViewport] = useState({ width: 390, height: 800 });
  const [dockHeight, setDockHeight] = useState(156);
  const [roll, setRoll] = useState(0);
  const [dimmed, setDimmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingShare | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const wantReveal = useRef(false);

  const shown = lock ?? moment;
  const scene = useMemo(() => buildScene(style, shown, note, shown?.at ?? now), [style, shown, note, now]);
  const box = previewBox({
    sceneWidth: scene.width,
    sceneHeight: scene.height,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    engaged,
    dockHeight,
  });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const apply = () => setViewport({ width: scroller.clientWidth, height: scroller.clientHeight });
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(scroller);
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
    if (!engaged || !wantReveal.current) return;
    const timer = window.setTimeout(() => {
      wantReveal.current = false;
      const scroller = scrollerRef.current;
      const params = paramsRef.current;
      const pin = pinRef.current;
      if (!scroller || !params || !pin) return;
      scroller.scrollTo({ top: Math.max(0, params.offsetTop - pin.offsetHeight + 4), behavior: 'smooth' });
    }, 340);
    return () => window.clearTimeout(timer);
  }, [engaged, box.pinHeight]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function onScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || wantReveal.current) return;
    const y = scroller.scrollTop;
    if (!engaged && y > 56) setEngaged(true);
    else if (engaged && y <= 1) setEngaged(false);
  }

  function onStyle() {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (engaged && scroller.scrollTop > 8) {
      wantReveal.current = false;
      scroller.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    wantReveal.current = true;
    setEngaged(true);
    if (engaged) {
      const params = paramsRef.current;
      const pin = pinRef.current;
      if (params && pin) {
        wantReveal.current = false;
        scroller.scrollTo({ top: Math.max(0, params.offsetTop - pin.offsetHeight + 4), behavior: 'smooth' });
      }
    }
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
      }),
    );
    const copy = new Uint8Array(stamped.byteLength);
    copy.set(stamped);
    return { png: new Blob([copy.buffer]), scene: sceneNow };
  }

  async function onSave() {
    if (!moment || working) return;
    setWorking(true);
    try {
      const frozen = freeze(moment);
      const rendered = await renderPng(frozen);
      await saveTransient(makeRecord({ moment: frozen, style, message: note, scene: rendered.scene, png: rendered.png, shares: [] }));
      downloadBlob(rendered.png, fileNameFor(frozen.at, frozen.latitude, frozen.longitude));
      setToast('Saved');
    } catch {
      setToast('Couldn’t make the image');
    } finally {
      setLock(null);
      setWorking(false);
    }
  }

  async function onShare() {
    if (!moment || working) return;
    setWorking(true);
    try {
      const frozen = freeze(moment);
      const rendered = await renderPng(frozen);
      setPending({ png: rendered.png, moment: frozen, scene: rendered.scene });
    } catch {
      setLock(null);
      setToast('Couldn’t make the image');
    } finally {
      setWorking(false);
    }
  }

  async function onShared(entry: ShareEntry) {
    if (!pending) return;
    try {
      await saveTransient(
        makeRecord({
          moment: pending.moment,
          style,
          message: note,
          scene: pending.scene,
          png: pending.png,
          shares: [entry],
        }),
      );
      setToast('Shared');
    } catch {
      setToast('Couldn’t keep the record');
    } finally {
      setPending(null);
      setLock(null);
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
              <button type="button" aria-label={engaged ? 'Hide style' : 'Style'} aria-pressed={engaged} onClick={onStyle} style={iconBtn}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, letterSpacing: '0.04em', color: note.length > 180 ? ink : muted }}>
              {note.length} / {NOTE_LIMIT}
            </span>
            <div style={{ display: 'flex' }}>
              <button type="button" aria-label="Save image" disabled={!moment || working} onClick={onSave} style={iconBtn}>
                <Icon name="download" size={20} color={ink} />
              </button>
              <button type="button" aria-label="Share" disabled={!moment || working} onClick={onShare} style={iconBtn}>
                <Icon name="share" size={20} color={ink} />
              </button>
            </div>
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
          <div style={{ height: Math.max(48, viewport.height - box.pinHeight) }} />
        </div>
      </div>

      {pending && (
        <ShareSheet
          png={pending.png}
          capturedAt={pending.moment.at}
          latitude={pending.moment.latitude}
          longitude={pending.moment.longitude}
          onClose={() => {
            setPending(null);
            setLock(null);
          }}
          onComplete={onShared}
        />
      )}
      {toast && (
        <div role="status" style={toastStyle}>
          {toast}
        </div>
      )}
    </div>
  );
}

function freeze(moment: Moment): Moment {
  return { ...moment, at: new Date() };
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
  textarea::placeholder { color: ${muted}; }
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
  @media (prefers-reduced-motion: reduce) {
    .tumble { animation: none; }
  }
`;
