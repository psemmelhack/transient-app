import { useSyncExternalStore, type CSSProperties } from 'react';
import { fontsStatus, fontSnapshots } from '../src/composition/fontReady';
import { getFitStore, setDiagnosticOpen, subscribeFitStore, type FitLineReport } from '../src/composition/fitReport';
import { ink, paper } from './theme';

function round(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(Math.round(value * 10) / 10);
}

function faceLine(report: FitLineReport): string {
  if (report.faces.length === 0) return 'faces: none registered';
  return report.faces.map((face) => `${face.family} ${face.weight} ${face.style} ${face.status}`).join('\n');
}

function lineBlock(line: FitLineReport): string {
  const ratio =
    line.canvasAdvance != null && line.domAdvance > 1 ? round(line.canvasAdvance / line.domAdvance) : '—';
  return [
    `“${line.text}”`,
    `  dom w ${round(line.domAdvance)}  line ${round(line.domLine)}  trim ${round(line.domTrim)}  base ${round(line.domBaseline)}`,
    `  canvas w ${round(line.canvasAdvance)}  asc ${round(line.canvasAscent)}  desc ${round(line.canvasDescent)}  fontAsc ${round(line.canvasFontAscent)}`,
    `  canvas/dom ${ratio}`,
    `  ${line.source}  ${round(line.fontSize)}px  h ${round(line.height)}`,
  ].join('\n');
}

function body(lines: FitLineReport[]): string {
  const live = `fonts.status ${fontsStatus()}`;
  const registered = fontSnapshots()
    .map((face) => `${face.family} ${face.status}`)
    .join('\n');
  if (lines.length === 0) {
    return [live, registered || 'faces: none registered', '', 'No poster lines measured yet.'].join('\n');
  }
  const first = lines[0];
  return [
    live,
    `check ${first.check == null ? '—' : first.check ? 'yes' : 'no'}  at measure: ${first.fontsStatus}`,
    faceLine(first),
    `${first.family} ${first.weight} ${first.style}${first.variation ? `  ${first.variation}` : ''}`,
    '',
    ...lines.map(lineBlock),
  ].join('\n');
}

/** Hidden until a triple-tap on the poster. Shows the font load and the line metrics. */
export function FitDiagnostic() {
  const store = useSyncExternalStore(subscribeFitStore, getFitStore, getFitStore);
  if (!store.open) return null;
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return (
    <div role="dialog" aria-label="Font metrics" data-role="fit-diagnostic" style={panel}>
      <div style={bar}>
        <span>Font metrics</span>
        <button type="button" onClick={() => setDiagnosticOpen(false)} style={close}>
          Close
        </button>
      </div>
      <pre style={text}>{body(store.lines)}</pre>
      {agent && <div style={agentStyle}>{agent}</div>}
    </div>
  );
}

const panel: CSSProperties = {
  position: 'fixed',
  left: 10,
  right: 10,
  bottom: 'max(10px, env(safe-area-inset-bottom))',
  zIndex: 80,
  maxHeight: '48%',
  overflow: 'auto',
  background: 'rgba(20, 18, 16, 0.94)',
  color: paper,
  border: `1px solid ${ink}`,
  padding: '10px 12px 12px',
  boxSizing: 'border-box',
};

const bar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
  fontSize: 12,
  letterSpacing: '0.04em',
  marginBottom: 8,
};

const close: CSSProperties = {
  border: `1px solid ${paper}`,
  background: 'transparent',
  color: paper,
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '4px 8px',
  cursor: 'pointer',
};

const text: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
  fontSize: 11,
  lineHeight: 1.45,
};

const agentStyle: CSSProperties = {
  marginTop: 8,
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
  fontSize: 10,
  lineHeight: 1.4,
  opacity: 0.75,
};
