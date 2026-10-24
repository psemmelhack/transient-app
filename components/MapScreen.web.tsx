import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LngLatBounds, Map as MapLibre, Marker } from 'maplibre-gl';
import { listTransients, type ShareEntry, type TransientRecord } from '../src/storage/library';
import { capturedUnshared, emptyLibrary } from '../src/ui/actions';
import { Icon } from './Icons';
import { publicAssetUrl } from '../src/web/publicUrl';
import { ink, line, muted, paper, ui } from './theme';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export function MapScreen({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [records, setRecords] = useState<TransientRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

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
    const place = () => {
      if (cancelled) return;
      markers.forEach((marker) => marker.remove());
      markers.length = 0;
      for (const record of records) {
        const dot = document.createElement('button');
        dot.type = 'button';
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
        dot.addEventListener('click', () => setSelectedId(record.id));
        markers.push(marker);
      }
      if (records.length === 1) {
        map.easeTo({ center: [records[0].longitude, records[0].latitude], zoom: 12 });
      } else if (records.length > 1) {
        const bounds = new LngLatBounds();
        records.forEach((record) => bounds.extend([record.longitude, record.latitude]));
        map.fitBounds(bounds, { padding: 64, maxZoom: 12, duration: 0 });
      }
    };
    if (map.isStyleLoaded()) place();
    else map.once('load', place);
    return () => {
      cancelled = true;
      map.off('load', place);
      markers.forEach((marker) => marker.remove());
    };
  }, [records, mapReady]);

  const selected = records.find((record) => record.id === selectedId) ?? null;

  return (
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: paper, color: ink, fontFamily: ui, fontWeight: 400 }}>
      <style>{mapCss}</style>
      <header style={{ height: 56, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', flex: 'none' }}>
        <button type="button" aria-label="Back" onClick={onBack} style={backBtn}>
          <Icon name="back" size={20} color={ink} />
        </button>
        <div style={{ fontFamily: ui, fontWeight: 500, fontSize: 20, letterSpacing: '0.02em' }}>My transients</div>
      </header>
      <div className="map-body">
        <div ref={hostRef} className="map-canvas" />
        <aside className="map-side">
          {records.length === 0 && <p style={emptyStyle}>{emptyLibrary}</p>}
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => setSelectedId(record.id)}
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
            <div style={{ padding: 16 }}>
              {urls[selected.id] && (
                <img src={urls[selected.id]} alt="" style={{ width: '100%', height: 'auto', boxShadow: '0 0 0 1px rgba(28,27,25,0.14)' }} />
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
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
};

const emptyStyle: CSSProperties = {
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 18,
  color: muted,
  padding: '24px 16px',
  margin: 0,
};

const mapCss = `
  .map-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .map-canvas { flex: 1; min-height: 240px; }
  .map-side { max-height: 46%; overflow: auto; border-top: 1px solid ${line}; background: ${paper}; }
  .maplibregl-ctrl-attrib, .maplibregl-ctrl-attrib a { font-family: ${ui}; font-weight: 400; font-size: 10px; letter-spacing: 0.02em; }
  @media (min-width: 840px) {
    .map-body { flex-direction: row; }
    .map-canvas { min-height: 0; }
    .map-side { width: 380px; max-height: none; border-top: none; border-left: 1px solid ${line}; }
  }
`;
