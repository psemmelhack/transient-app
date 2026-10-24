import { useState, type CSSProperties } from 'react';
import { downloadBlob, fileNameFor } from '../src/export/download';
import { canShareFiles, openEmail, openSms, sharePng } from '../src/share/share';
import type { ShareEntry } from '../src/storage/library';
import { ink, line, muted, paper, ui } from './theme';

export function ShareSheet({
  png,
  capturedAt,
  latitude,
  longitude,
  onClose,
  onComplete,
}: {
  png: Blob;
  capturedAt: Date;
  latitude: number;
  longitude: number;
  onClose: () => void;
  onComplete: (entry: ShareEntry) => void;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const shareLabel = canShareFiles() ? 'Share' : 'Download';

  async function finish(channel: ShareEntry['channel']) {
    if (busy) return;
    setBusy(true);
    const filename = fileNameFor(capturedAt, latitude, longitude);
    try {
      if (channel === 'share') {
        const result = await sharePng(png, filename);
        if (result === 'cancelled') {
          setBusy(false);
          return;
        }
        if (result === 'unsupported') downloadBlob(png, filename);
      } else if (channel === 'sms') {
        downloadBlob(png, filename);
        openSms(address);
      } else {
        downloadBlob(png, filename);
        openEmail(address);
      }
      onComplete({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        channel,
        recipient: name.trim() || undefined,
        address: address.trim() || undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: 'rgba(28,27,25,0.28)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-label="Share"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(440px, 100%)',
          background: paper,
          color: ink,
          fontFamily: ui,
          fontWeight: 400,
          padding: '22px 22px 18px',
          boxShadow: '0 16px 50px rgba(28,27,25,0.16)',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 style={{ margin: 0, fontFamily: ui, fontWeight: 500, fontSize: 22, letterSpacing: '0.02em', color: ink }}>Share</h2>
          <button type="button" onClick={onClose} style={textBtn}>
            Close
          </button>
        </div>
        <p style={{ margin: '8px 0 16px', fontFamily: ui, fontWeight: 400, fontSize: 15, color: muted }}>A name is optional. Skip it and nothing is remembered.</p>
        <label style={fieldLabel}>
          To whom
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" style={field} />
        </label>
        <label style={fieldLabel}>
          Phone or email
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Optional" style={field} />
        </label>
        <div style={{ display: 'flex', gap: 18, marginTop: 18 }}>
          <button type="button" disabled={busy} onClick={() => finish('share')} style={action}>
            {shareLabel}
          </button>
          <button type="button" disabled={busy} onClick={() => finish('sms')} style={action}>
            Text
          </button>
          <button type="button" disabled={busy} onClick={() => finish('email')} style={action}>
            Email
          </button>
        </div>
      </div>
    </div>
  );
}

const textBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: muted,
  cursor: 'pointer',
  padding: 0,
};

const fieldLabel: CSSProperties = {
  display: 'block',
  marginTop: 12,
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 10,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: muted,
};

const field: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  border: 'none',
  borderBottom: `1px solid ${line}`,
  background: 'transparent',
  fontFamily: ui,
  fontWeight: 400,
  fontSize: 17,
  color: ink,
  padding: '6px 0 8px',
  outline: 'none',
};

const action: CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  fontFamily: ui,
  fontWeight: 500,
  fontSize: 16,
  color: ink,
  cursor: 'pointer',
};
