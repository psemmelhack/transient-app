import type { CSSProperties } from 'react';

/**
 * Header icons are inline SVGs. The row must not clip them, and a button's
 * max-width of 100% collapses that SVG to nothing in the Expo WKWebView.
 */
export const shellIconRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flex: 'none',
  overflow: 'visible',
  minWidth: 'max-content',
};

export const shellIconButton: CSSProperties = {
  width: 40,
  height: 40,
  minWidth: 40,
  maxWidth: 'none',
  flex: 'none',
  overflow: 'visible',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
};
