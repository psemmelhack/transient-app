import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LngLatBounds, Map as MapLibre, Marker } from 'maplibre-gl';
import { listTransients, type ShareEntry, type TransientRecord } from '../src/storage/library';
import { capturedUnshared, emptyLibrary, libraryShareLabel } from '../src/ui/actions';
import { Icon } from './Icons';
import { publicAssetUrl } from '../src/web/publicUrl';
import { ink, line, muted, paper, ui } from './theme';
import { clusterTransients } from '../src/map/cluster';
import { openLibraryRow, panelShowsIndex, selectMapPin } from '../src/map/libraryDetail';
import { SHELL_HEADER_PADDING_RIGHT, useNativeShell } from '../src/native/shell';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

function useLibraryWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth));
  useEffect(() => {
    const apply = () => setWidth(window.innerWidth);
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);
  return width;
}

export function MapScreen({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const shell = useNativeShell();
  const libraryWidth = useLibraryWidth();
  const showIndex = panelShowsIndex(libraryWidth);
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [records, setRecords] = useState<TransientRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [view, setView] = useState<'map' | 'list'>('map');
  const focusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    listTransients().then((items) => {
      if (!cancelled) {
        setRecords(items);
        setSelectedId((current) => current ?? items[0]?.id ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const record of records) next[record.id] = URL.createObjectURL(record.png);
    setUrls(next);
    return () => {
      for (const url of Object.values(next)) URL.revokeObjectURL(url);
    };
  }, [records]);

  useEffect(() => {
    if (!active) return;
    const host = hostRef.current;
    if (!host) return;
    if (!document.querySelector('link[data-maplibre]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = publicAssetUrl('vendor/maplibre-gl.css');
      link.setAttribute('data-maplibre', '1');
      document.head.appendChild(link);
    }
    const map = new MapLibre({
      container: host,
      style: STYLE_URL,
      center: [-118.383318, 33.834452],
      zoom: 9,
    });
    mapRef.current = map;
    setMapReady(true);
    const timers = [80, 300].map((delay) => window.setTimeout(() => map.resize(), delay));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [active]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: Marker[] = [];
    let cancelled = false;
    const render = () => {
      if (cancelled) return;
      markers.forEach((marker) => marker.remove());
      markers.length = 0;
      const viewBounds = map.getBounds();
      const groups = clusterTransients(
        records.map((record) => ({ id: record.id, longitude: record.longitude, latitude: record.latitude })),
        {
          zoom: map.getZoom(),
          bbox: [viewBounds.getWest(), viewBounds.getSouth(), viewBounds.getEast(), viewBounds.getNorth()],
        },
      );
      for (const group of groups) {
        if (group.kind === 'cluster') {
          const size = group.count >= 100 ? 32 : group.count >= 10 ? 26 : 22;
          const dot = document.createElement('button');
          dot.type = 'button';
          dot.dataset.role = 'cluster';
          dot.textContent = String(group.count);
          dot.setAttribute('aria-label', `${group.count} transients`);
          dot.style.width = `${size}px`;
          dot.style.height = `${size}px`;
          dot.style.borderRadius = '999px';
          dot.style.border = 'none';
          dot.style.padding = '0';
          dot.style.display = 'inline-flex';
          dot.style.alignItems = 'center';
          dot.style.justifyContent = 'center';
          dot.style.background = ink;
          dot.style.color = paper;
          dot.style.boxShadow = '0 0 0 4px rgba(28,27,25,0.12)';
          dot.style.fontFamily = ui;
          dot.style.fontWeight = '500';
          dot.style.fontSize = group.count >= 100 ? '11px' : '12px';
          dot.style.lineHeight = '1';
          dot.style.cursor = 'pointer';
          const marker = new Marker({ element: dot }).setLngLat([group.longitude, group.latitude]).addTo(map);
          dot.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            const current = map.getZoom();
            const zoom = group.expansionZoom > current ? group.expansionZoom : current + 1;
            map.easeTo({ center: [group.longitude, group.latitude], zoom });
          });
          markers.push(marker);
          continue;
        }
        const record = records.find((item) => item.id === group.id);
        if (!record) continue;
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.dataset.role = 'pin';
        dot.setAttribute('aria-label', record.placeFull || 'Transient');
        dot.style.width = '12px';
        dot.style.height = '12px';
        dot.style.borderRadius = '999px';
        dot.style.border = 'none';
        dot.style.padding = '0';
        dot.style.background = ink;
        dot.style.boxShadow = '0 0 0 4px rgba(28,27,25,0.12)';
        dot.style.cursor = 'pointer';
        const marker = new Marker({ element: dot }).setLngLat([record.longitude, record.latitude]).addTo(map);
        armPin(dot, () => {
          const next = selectMapPin(record.id);
          setSelectedId(next.selectedId);
        });
        markers.push(marker);
      }
    };
    const place = () => {
      if (cancelled) return;
      if (records.length === 1) {
        map.jumpTo({ center: [records[0].longitude, records[0].latitude], zoom: 12 });
      } else if (records.length > 1) {
        const bounds = new LngLatBounds();
        records.forEach((record) => bounds.extend([record.longitude, record.latitude]));
        map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 0 });
      }
      render();
    };
    map.on('moveend', render);
    if (map.isStyleLoaded()) place();
    else map.once('load', place);
    return () => {
      cancelled = true;
      map.off('load', place);
      map.off('moveend', render);
      markers.forEach((marker) => marker.remove());
    };
  }, [records, mapReady]);

  useEffect(() => {
    if (view !== 'map') return;
    const map = mapRef.current;
    if (!map) return;
    map.resize();
    const id = focusRef.current;
    if (!id) return;
    const record = records.find((item) => item.id === id);
    focusRef.current = null;
    if (record) map.easeTo({ center: [record.longitude, record.latitude], zoom: 13 });
  }, [view, mapReady, records]);

  function showOnMap(id: string) {
    const next = openLibraryRow(id);
    focusRef.current = next.focusId;
    setSelectedId(next.selectedId);
    setView(next.view);
  }

  useEffect(() => {
    if (view !== 'map') return;
    const side = document.querySelector('.map-side');
    if (side instanceof HTMLElement) side.scrollTop = 0;
  }, [selectedId, view]);

  const selected = records.find((record) => record.id === selectedId) ?? null;

  return (
    <div style={{ height: '100%', width: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: paper, color: ink, fontFamily: ui, fontWeight: 400, overflow: 'hidden' }}>
      <style>{mapCss}</style>
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px 0 8px',
          flex: 'none',
          minWidth: 0,
          overflow: 'hidden',
          ...(shell ? { paddingRight: SHELL_HEADER_PADDING_RIGHT } : {}),
        }}
      >
        <button type="button" aria-label="Back" onClick={onBack} style={backBtn}>
          <Icon name="back" size={20} color={ink} />
        </button>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontFamily: ui, fontWeight: 500, fontSize: 18, letterSpacing: '0.02em' }}>My transients</div>
        <div role="group" aria-label="Library view" style={segment}>
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')} style={segmentButton(view === 'map')}>
            Map
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} style={segmentButton(view === 'list')}>
            List
          </button>
        </div>
      </header>
      {view === 'list' && (
        <div data-view="list" style={listStyle}>
          {records.length === 0 && <p style={emptyStyle}>{emptyLibrary}</p>}
          {records.map((record) => (
            <button key={record.id} type="button" data-role="library-row" className="map-row" onClick={() => showOnMap(record.id)} style={rowStyle}>
              <Thumbnail record={record} url={urls[record.id]} />
              <span style={rowCopy}>
                <span style={placeStyle}>{record.placeFull || record.placeCity || 'Unplaced'}</span>
                <span style={metaStyle}>{formatWhen(record.capturedAt, record.timezone)}</span>
                {record.message && <span style={noteStyle}>{record.message}</span>}
                <span style={metaStyle}>{formatCoords(record.latitude, record.longitude)}</span>
                <span style={metaStyle}>{libraryShareLabel(record.shares)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="map-body" style={{ display: view === 'map' ? undefined : 'none' }}>
        <div ref={hostRef} className="map-canvas" />
        <aside className="map-side">
          {records.length === 0 && <p style={emptyStyle}>{emptyLibrary}</p>}
          {showIndex &&
            records.map((record) => (
              <button
                key={record.id}
                type="button"
                className="map-row"
                onClick={() => {
                  const next = selectMapPin(record.id);
                  setSelectedId(next.selectedId);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  borderBottom: `1px solid ${line}`,
                  background: record.id === selectedId ? 'rgba(28,27,25,0.04)' : 'transparent',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  color: ink,
                }}
              >
                <div style={{ fontFamily: ui, fontWeight: 500, fontSize: 16 }}>{record.message || 'No note'}</div>
                <div style={{ fontFamily: ui, fontWeight: 400, fontSize: 12, letterSpacing: '0.02em', color: muted, marginTop: 4 }}>{formatWhen(record.capturedAt, record.timezone)}</div>
              </button>
            ))}
          {selected && (
            <div data-role="library-detail" data-record={selected.id} style={{ padding: 16 }}>
              {urls[selected.id] && selected.png.size > 0 && (
                <img src={urls[selected.id]} alt="" className="map-detail-image" style={{ width: '100%', height: 'auto', boxShadow: '0 0 0 1px rgba(28,27,25,0.14)' }} />
              )}
              <p style={{ fontFamily: ui, fontWeight: 500, fontSize: 18, margin: '14px 0 6px' }}>{selected.message || 'No note'}</p>
              <p style={{ fontFamily: ui, fontWeight: 400, fontSize: 13, color: muted, margin: 0 }}>{formatWhen(selected.capturedAt, selected.timezone)}</p>
              {selected.placeFull && <p style={{ fontFamily: ui, fontWeight: 400, fontSize: 13, color: muted, margin: '4px 0 0' }}>{selected.placeFull}</p>}
              {selected.lines.length > 0 && (
                <p style={{ fontFamily: ui, fontWeight: 400, fontSize: 13, letterSpacing: '0.01em', color: ink, margin: '10px 0 0' }}>{selected.lines.map((item) => item.text).join(' · ')}</p>
              )}
              <div style={{ marginTop: 14 }}>
                {selected.shares.length === 0 && <div style={{ fontFamily: ui, fontWeight: 400, fontSize: 13, color: muted }}>{capturedUnshared}</div>}
                {selected.shares.map((entry) => (
                  <div key={entry.id} style={{ fontFamily: ui, fontWeight: 400, fontSize: 13, color: ink, marginTop: 4 }}>
                    {shareLabel(entry)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Thumbnail({ record, url }: { record: TransientRecord; url?: string }) {
  if (url && record.png.size > 0) return <img src={url} alt="" style={thumb} />;
  const background = record.style?.backgroundColor || paper;
  const color = record.style?.textColor || ink;
  return (
    <span aria-hidden style={{ ...thumb, background, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 6 }}>
      <span style={{ width: 18, height: 18, background: color }} />
    </span>
  );
}

function formatCoords(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function formatWhen(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
      .format(new Date(iso))
      .replace(/\u202f/g, ' ');
  } catch {
    return iso;
  }
}

function shareLabel(entry: ShareEntry): string {
  const who = entry.recipient || entry.address;
  if (entry.channel === 'sms') return who ? `Text to ${who}` : 'Text';
  if (entry.channel === 'email') return who ? `Email to ${who}` : 'Email';
  return who ? `Shared · ${who}` : 'Shared';
}

const backBtn: CSSProperties = {
  width: 40,
  height: 40,
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
};

const segment: CSSProperties = {
  display: 'flex',
  flex: 'none',
  border: `1px solid ${line}`,
};

function segmentButton(on: boolean): CSSProperties {
  return {
    minWidth: 52,
    minHeight: 32,
    padding: '0 10px',
    border: 'none',
    background: on ? 'rgba(28,27,25,0.06)' : 'transparent',
    color: on ? ink : muted,
    fontFamily: ui,
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: '0.04em',
    cursor: 'pointer',
  };
}

const listStyle: CSSProperties = {
  flex: 1,
  width: '100%',
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  WebkitOverflowScrolling: 'touch',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  width: '100%',
  minWidth: 0,
  maxWidth: '100%',
  textAlign: 'left',
  border: 'none',
  borderBottom: `1px solid ${line}`,
  background: 'transparent',
  padding: '12px 16px',
  cursor: 'pointer',
  color: ink,
  touchAction: 'manipulation',
};

const rowCopy: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  flex: 1,
  gap: 2,
};

const placeStyle: CSSProperties = {
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 16,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const noteStyle: CSSProperties = {
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 14,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const metaStyle: CSSProperties = {
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 12,
  letterSpacing: '0.02em',
  color: muted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontVariantNumeric: 'tabular-nums',
};

const thumb: CSSProperties = {
  width: 64,
  height: 64,
  flex: 'none',
  objectFit: 'cover',
  boxShadow: '0 0 0 1px rgba(28,27,25,0.14)',
};

const emptyStyle: CSSProperties = {
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 18,
  color: muted,
  padding: '24px 16px',
  margin: 0,
};

function armPin(dot: HTMLElement, select: () => void) {
  let touched = false;
  dot.addEventListener('touchend', (event) => {
    event.preventDefault();
    event.stopPropagation();
    touched = true;
    select();
  });
  dot.addEventListener('click', (event) => {
    event.stopPropagation();
    if (touched) {
      touched = false;
      return;
    }
    select();
  });
}

const mapCss = `
  .map-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .map-canvas { flex: 1; min-height: 180px; }
  .map-side { max-height: 68%; overflow: auto; border-top: 1px solid ${line}; background: ${paper}; }
  .map-row > * { pointer-events: none; }
  .map-detail-image { max-height: 220px; object-fit: contain; background: rgba(28,27,25,0.04); }
  .maplibregl-ctrl-attrib, .maplibregl-ctrl-attrib a { font-family: ${ui}; font-weight: 400; font-size: 10px; letter-spacing: 0.02em; }
  @media (min-width: 840px) {
    .map-body { flex-direction: row; }
    .map-canvas { min-height: 0; }
    .map-side { width: 380px; max-height: none; border-top: none; border-left: 1px solid ${line}; }
    .map-detail-image { max-height: none; object-fit: fill; background: transparent; }
  }
`;
