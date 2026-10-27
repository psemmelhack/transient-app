import type { CSSProperties } from 'react';
import type { ExtendedRow } from '../src/data/extended';
import { ink } from './theme';

/**
 * Fills the band already reserved under Capture.
 * The band's height is fixed, so the poster, the header, and Capture do not move.
 * Extra rows scroll inside it. 11px is the floor; the face stays the readout mono.
 */
export function ExtendedReadout({ rows }: { rows: ExtendedRow[] }) {
  if (!rows.length) return null;
  return (
    <div data-role="extended-data" style={panel}>
      <div style={grid}>
        {rows.map((row) => (
          <div key={row.id} data-extended-row={row.id} style={line}>
            <span style={label}>{row.label}</span>
            <span style={value}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const panel: CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 36,
  left: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
  boxSizing: 'border-box',
  paddingTop: 2,
  paddingBottom: 4,
  paddingLeft: 'max(22px, env(safe-area-inset-left))',
  paddingRight: 'max(22px, env(safe-area-inset-right))',
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '4.8em minmax(0, 1fr)',
  columnGap: '0.75em',
  rowGap: 1,
  alignItems: 'baseline',
  maxWidth: 680,
  margin: '0 auto',
  fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
  fontSize: 11,
  lineHeight: 1.35,
  fontWeight: 400,
  color: ink,
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
};

const line: CSSProperties = {
  display: 'contents',
};

const label: CSSProperties = {
  letterSpacing: '0.12em',
  whiteSpace: 'nowrap',
};

const value: CSSProperties = {
  minWidth: 0,
  textAlign: 'right',
  whiteSpace: 'pre',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
