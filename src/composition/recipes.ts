import type { FontRole } from './fonts';
import type { FormatId } from './formats';
import type { Token, SignStyle } from './text';

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface FooterSpec {
  arrangement: 'split' | 'stack' | 'message-then-split';
  messageFont: FontRole;
  messageSize: number;
  messageLineHeight: number;
  messageMaxWidth?: number;
  messageMargin: number;
  metaFont: FontRole;
  metaSize: number;
  metaLineHeight: number;
  metaOpacity: number;
  metaTracking?: number;
  metaTokens: Token[];
  metaJoin: boolean;
  splitLeft?: Token;
  splitRight?: Token;
  markInFlow?: { size: number; opacity: number; tracking?: number; marginTop: number };
}

export interface PosterRecipe {
  kind: 'poster';
  id: string;
  safe: boolean;
  nativeFormat: FormatId;
  nativeBox: Box;
  heroGap: number;
  heroTokens: Token[];
  heroTop: number;
  kicker?: {
    token: Token;
    size: number;
    tracking: number;
    font: FontRole;
    top: number;
    /** Shown on every alignment. Otherwise only when the poster is centered. */
    always: boolean;
  };
  headerSplit?: {
    left: Token;
    right: Token;
    size: number;
    tracking?: number;
    top: number;
  };
  footer: FooterSpec;
  absoluteMark?: { size: number; opacity: number; tracking?: number; bottom: number };
}

export type QuietBlockSpec =
  | {
      kind: 'text';
      token: Token;
      font: FontRole;
      size: number;
      lineHeight: number;
      tracking?: number;
      marginTop: number;
      opacity?: number;
      maxWidth?: number;
    }
  | {
      kind: 'coords';
      font: FontRole;
      size: number;
      lineHeight: number;
      tracking?: number;
      marginTop: number;
      sign: SignStyle;
      degree: boolean;
      hemisphere: boolean;
    }
  | {
      kind: 'rule';
      width: number;
      height: number;
      marginTop: number;
      marginBottom: number;
    }
  | {
      kind: 'rich-time';
      font: FontRole;
      size: number;
      lineHeight: number;
      marginTop: number;
    }
  | {
      kind: 'meta';
      tokens: Token[];
      font: FontRole;
      size: number;
      lineHeight: number;
      marginTop: number;
      opacity?: number;
      tracking?: number;
    }
  | {
      kind: 'note';
      font: FontRole;
      /** Size for a short note. Longer notes step down from here. */
      ceiling: number;
      lineHeight: number;
      marginTop: number;
      labelSize: number;
      tracking: number;
    }
  | {
      kind: 'rows';
      labelFont: FontRole;
      valueFont: FontRole;
      labelSize: number;
      valueSize: number;
      tracking: number;
      lineHeight: number;
      marginTop: number;
      /** Vertical padding inside each row. */
      gap: number;
      hairline: boolean;
      /** Tabular figures on the values, when the face supports them. */
      tabular: boolean;
      items: { label: string; token: Token }[];
    };

export interface QuietRecipe {
  kind: 'quiet';
  id: string;
  safe: boolean;
  nativeFormat: FormatId;
  side: number;
  top: number;
  bottom: number;
  anchor: 'center' | 'end' | 'align';
  blocks: QuietBlockSpec[];
  absoluteMark?: { size: number; opacity: number; tracking?: number; bottom: number };
  /** Optional data lines, set in the same small type as the rest of the recipe. */
  measurementMeta?: {
    font: FontRole;
    size: number;
    lineHeight: number;
    marginTop: number;
    opacity?: number;
    tracking?: number;
  };
  /** Append optional data lines as rows on the title block. */
  measurementRows?: boolean;
  /** Keep the signature on the same side margin as the type. */
  markInset?: boolean;
}

export type Recipe = PosterRecipe | QuietRecipe;

const feedBox = { left: 60, right: 60, top: 64, bottom: 64 };

export const RECIPES: Record<string, Recipe> = {
  'poster-anton': {
    kind: 'poster',
    id: 'poster-anton',
    safe: false,
    nativeFormat: 'feed',
    nativeBox: { left: 60, right: 60, top: 64, bottom: 64 },
    heroGap: 22,
    heroTokens: ['lat', 'lon', 'date-compact', 'time-zone', 'place-city-upper'],
    heroTop: 64,
    footer: {
      arrangement: 'split',
      messageFont: 'mono-medium',
      messageSize: 30,
      messageLineHeight: 1.3,
      messageMaxWidth: 420,
      messageMargin: 0,
      metaFont: 'mono',
      metaSize: 21,
      metaLineHeight: 1.5,
      metaOpacity: 1,
      metaTokens: ['coords-pair', 'alt-lower', 'utc', 'place-full'],
      metaJoin: false,
    },
  },
  'poster-shoulders': {
    kind: 'poster',
    id: 'poster-shoulders',
    safe: false,
    nativeFormat: 'feed',
    nativeBox: { left: 64, right: 64, top: 130, bottom: 56 },
    heroGap: 26,
    heroTokens: ['lat', 'lon', 'date-compact', 'time-short'],
    heroTop: 130,
    kicker: {
      token: 'place-full-upper',
      size: 20,
      tracking: 0.28,
      font: 'mono-medium',
      top: 64,
      always: true,
    },
    footer: {
      arrangement: 'stack',
      messageFont: 'mono-medium',
      messageSize: 30,
      messageLineHeight: 1.25,
      messageMargin: 22,
      metaFont: 'mono',
      metaSize: 18,
      metaLineHeight: 1.45,
      metaOpacity: 0.75,
      metaTracking: 0.04,
      metaTokens: ['alt-lower', 'utc', 'time-zone'],
      metaJoin: true,
      markInFlow: { size: 14, opacity: 0.45, tracking: 0.12, marginTop: 26 },
    },
  },
  'poster-antonio': {
    kind: 'poster',
    id: 'poster-antonio',
    safe: false,
    nativeFormat: 'story',
    nativeBox: { left: 64, right: 64, top: 260, bottom: 270 },
    heroGap: 24,
    heroTokens: ['lat', 'lon', 'date-compact', 'time-short'],
    heroTop: 260,
    footer: {
      arrangement: 'stack',
      messageFont: 'mono-medium',
      messageSize: 36,
      messageLineHeight: 1.3,
      messageMargin: 26,
      metaFont: 'mono',
      metaSize: 20,
      metaLineHeight: 1.6,
      metaOpacity: 1,
      metaTokens: ['place-full', 'alt-lower', 'utc', 'mark'],
      metaJoin: false,
    },
  },
  'poster-fraunces': {
    kind: 'poster',
    id: 'poster-fraunces',
    safe: false,
    nativeFormat: 'square',
    nativeBox: { left: 64, right: 64, top: 330, bottom: 56 },
    heroGap: 30,
    heroTokens: ['lat', 'lon-endash'],
    heroTop: 330,
    headerSplit: {
      left: 'place-full',
      right: 'alt-lower',
      size: 19,
      tracking: 0.02,
      top: 56,
    },
    footer: {
      arrangement: 'message-then-split',
      messageFont: 'display-italic',
      messageSize: 36,
      messageLineHeight: 1.4,
      messageMargin: 34,
      metaFont: 'mono',
      metaSize: 18,
      metaLineHeight: 1.4,
      metaOpacity: 0.75,
      metaTokens: [],
      metaJoin: false,
      splitLeft: 'date-time-compact',
      splitRight: 'utc',
    },
  },
  'poster-generic': {
    kind: 'poster',
    id: 'poster-generic',
    safe: true,
    nativeFormat: 'feed',
    nativeBox: feedBox,
    heroGap: 20,
    heroTokens: ['lat', 'lon', 'date-compact', 'time-zone', 'place-city-upper'],
    heroTop: 64,
    kicker: {
      token: 'place-full-upper',
      size: 18,
      tracking: 0.22,
      font: 'mono',
      top: 64,
      always: false,
    },
    footer: {
      arrangement: 'split',
      messageFont: 'mono-medium',
      messageSize: 30,
      messageLineHeight: 1.4,
      messageMaxWidth: 460,
      messageMargin: 16,
      metaFont: 'mono',
      metaSize: 18,
      metaLineHeight: 1.55,
      metaOpacity: 0.78,
      metaTokens: ['coords-pair', 'alt-lower', 'utc', 'place-full'],
      metaJoin: false,
      markInFlow: { size: 13, opacity: 0.4, tracking: 0.1, marginTop: 18 },
    },
  },
  'quiet-bodoni': {
    kind: 'quiet',
    id: 'quiet-bodoni',
    safe: false,
    nativeFormat: 'feed',
    side: 110,
    top: 0,
    bottom: 0,
    anchor: 'center',
    blocks: [
      {
        kind: 'text',
        token: 'place-full-upper',
        font: 'mono',
        size: 19,
        lineHeight: 1.4,
        tracking: 0.3,
        marginTop: 0,
      },
      {
        kind: 'coords',
        font: 'display-italic',
        size: 112,
        lineHeight: 1.08,
        tracking: -0.01,
        marginTop: 64,
        sign: 'abs',
        degree: true,
        hemisphere: true,
      },
      { kind: 'rule', width: 56, height: 1.5, marginTop: 56, marginBottom: 44 },
      {
        kind: 'text',
        token: 'date-time-quiet',
        font: 'display',
        size: 40,
        lineHeight: 1.3,
        tracking: 0.02,
        marginTop: 0,
      },
      {
        kind: 'text',
        token: 'message',
        font: 'display-italic',
        size: 32,
        lineHeight: 1.4,
        marginTop: 48,
      },
      {
        kind: 'meta',
        tokens: ['coords-alt', 'utc'],
        font: 'mono',
        size: 17,
        lineHeight: 1.7,
        marginTop: 80,
        opacity: 0.75,
      },
    ],
    absoluteMark: { size: 14, opacity: 0.5, tracking: 0.14, bottom: 48 },
  },
  'quiet-instrument': {
    kind: 'quiet',
    id: 'quiet-instrument',
    safe: false,
    nativeFormat: 'feed',
    side: 96,
    top: 0,
    bottom: 150,
    anchor: 'end',
    blocks: [
      {
        kind: 'coords',
        font: 'display',
        size: 168,
        lineHeight: 0.98,
        tracking: -0.015,
        marginTop: 0,
        sign: 'minus',
        degree: false,
        hemisphere: false,
      },
      { kind: 'rich-time', font: 'display', size: 44, lineHeight: 1.2, marginTop: 36 },
      {
        kind: 'text',
        token: 'message',
        font: 'display-italic',
        size: 34,
        lineHeight: 1.4,
        marginTop: 56,
      },
      {
        kind: 'meta',
        tokens: ['place-full', 'alt-lower', 'utc'],
        font: 'mono',
        size: 18,
        lineHeight: 1.75,
        marginTop: 40,
        opacity: 0.7,
      },
    ],
    absoluteMark: { size: 14, opacity: 0.45, tracking: 0.12, bottom: 60 },
  },
  'quiet-generic': {
    kind: 'quiet',
    id: 'quiet-generic',
    safe: true,
    nativeFormat: 'feed',
    side: 96,
    top: 0,
    bottom: 120,
    anchor: 'align',
    blocks: [
      {
        kind: 'text',
        token: 'place-full-upper',
        font: 'mono',
        size: 18,
        lineHeight: 1.4,
        tracking: 0.22,
        marginTop: 0,
      },
      {
        kind: 'coords',
        font: 'display',
        size: 104,
        lineHeight: 1.05,
        tracking: -0.01,
        marginTop: 48,
        sign: 'abs',
        degree: true,
        hemisphere: true,
      },
      { kind: 'rule', width: 48, height: 1, marginTop: 40, marginBottom: 28 },
      {
        kind: 'text',
        token: 'date-time-quiet',
        font: 'display',
        size: 36,
        lineHeight: 1.3,
        tracking: 0.01,
        marginTop: 0,
      },
      {
        kind: 'text',
        token: 'message',
        font: 'display-italic',
        size: 30,
        lineHeight: 1.4,
        marginTop: 36,
      },
      {
        kind: 'meta',
        tokens: ['coords-alt', 'utc'],
        font: 'mono',
        size: 16,
        lineHeight: 1.7,
        marginTop: 48,
        opacity: 0.72,
      },
    ],
    absoluteMark: { size: 13, opacity: 0.45, tracking: 0.14, bottom: 40 },
  },
  'quiet-ledger': {
    kind: 'quiet',
    id: 'quiet-ledger',
    safe: false,
    nativeFormat: 'feed',
    side: 156,
    top: 0,
    bottom: 0,
    anchor: 'center',
    blocks: [
      {
        kind: 'text',
        token: 'place-full-upper',
        font: 'mono',
        size: 15,
        lineHeight: 1.45,
        tracking: 0.32,
        marginTop: 0,
      },
      {
        kind: 'coords',
        font: 'display',
        size: 72,
        lineHeight: 1.12,
        tracking: -0.02,
        marginTop: 56,
        sign: 'abs',
        degree: true,
        hemisphere: true,
      },
      { kind: 'rule', width: 72, height: 1, marginTop: 44, marginBottom: 32 },
      {
        kind: 'text',
        token: 'date-time-quiet',
        font: 'display',
        size: 36,
        lineHeight: 1.4,
        tracking: 0.02,
        marginTop: 0,
      },
      {
        kind: 'text',
        token: 'message',
        font: 'display',
        size: 30,
        lineHeight: 1.4,
        marginTop: 32,
      },
      {
        kind: 'meta',
        tokens: ['coords-alt', 'utc'],
        font: 'mono',
        size: 15,
        lineHeight: 1.7,
        marginTop: 52,
        opacity: 0.86,
        tracking: 0.03,
      },
    ],
    measurementMeta: {
      font: 'mono',
      size: 15,
      lineHeight: 1.7,
      marginTop: 18,
      opacity: 0.86,
      tracking: 0.03,
    },
    absoluteMark: { size: 13, opacity: 0.55, tracking: 0.16, bottom: 56 },
    markInset: true,
  },
  'quiet-boardroom': {
    kind: 'quiet',
    id: 'quiet-boardroom',
    safe: false,
    nativeFormat: 'feed',
    side: 128,
    top: 0,
    bottom: 0,
    anchor: 'center',
    blocks: [
      {
        kind: 'text',
        token: 'place-full-upper',
        font: 'mono',
        size: 14,
        lineHeight: 1.45,
        tracking: 0.34,
        marginTop: 0,
        opacity: 0.82,
      },
      {
        kind: 'coords',
        font: 'display',
        size: 84,
        lineHeight: 1.04,
        tracking: -0.02,
        marginTop: 44,
        sign: 'abs',
        degree: true,
        hemisphere: true,
      },
      { kind: 'rule', width: 56, height: 1, marginTop: 40, marginBottom: 30 },
      {
        kind: 'text',
        token: 'date-time-quiet',
        font: 'display',
        size: 40,
        lineHeight: 1.35,
        tracking: 0.012,
        marginTop: 0,
      },
      {
        kind: 'text',
        token: 'message',
        font: 'display-italic',
        size: 32,
        lineHeight: 1.4,
        marginTop: 36,
      },
      {
        kind: 'meta',
        tokens: ['alt-lower', 'utc'],
        font: 'mono',
        size: 15,
        lineHeight: 1.75,
        marginTop: 48,
        opacity: 0.78,
        tracking: 0.03,
      },
    ],
    measurementMeta: {
      font: 'mono',
      size: 15,
      lineHeight: 1.75,
      marginTop: 16,
      opacity: 0.78,
      tracking: 0.03,
    },
    absoluteMark: { size: 13, opacity: 0.5, tracking: 0.16, bottom: 56 },
    markInset: true,
  },
  'quiet-title-block': {
    kind: 'quiet',
    id: 'quiet-title-block',
    safe: false,
    nativeFormat: 'feed',
    side: 80,
    top: 0,
    bottom: 88,
    anchor: 'end',
    blocks: [
      { kind: 'rule', width: 920, height: 2.5, marginTop: 0, marginBottom: 4 },
      { kind: 'rule', width: 920, height: 1, marginTop: 0, marginBottom: 6 },
      {
        kind: 'rows',
        labelFont: 'mono',
        valueFont: 'mono-medium',
        labelSize: 13,
        valueSize: 22,
        tracking: 0.2,
        lineHeight: 1.2,
        marginTop: 0,
        gap: 12,
        hairline: true,
        tabular: true,
        items: [
          { label: 'Location', token: 'place-full-upper' },
          { label: 'Latitude', token: 'lat-card' },
          { label: 'Longitude', token: 'lon-card' },
          { label: 'Date', token: 'date-compact' },
          { label: 'Time', token: 'time-zone' },
          { label: 'Elevation', token: 'alt-m' },
          { label: 'UTC', token: 'utc' },
        ],
      },
      {
        kind: 'note',
        font: 'mono',
        ceiling: 30,
        lineHeight: 1.4,
        marginTop: 18,
        labelSize: 13,
        tracking: 0.2,
      },
    ],
    measurementRows: true,
  },
};

export function getRecipe(id: string): Recipe {
  return RECIPES[id] ?? RECIPES['poster-generic'];
}
