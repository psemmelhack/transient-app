import { measurementLines, isTelemetryEnabled } from '../data/plugins';
import { deviceTimeZone, type Moment } from '../data/moment';
import { omitSupersededAccuracy, telemetryLines, type TelemetryLine } from '../data/telemetry';
import type { Style } from '../style/types';
import { FORMATS } from './formats';
import { getFont, resolveFont, type CssFont, type FontRole } from './fonts';
import { getRecipe, type PosterRecipe, type QuietBlockSpec, type QuietRecipe } from './recipes';
import { clockLabel, coordLines, linesFor, MARK, momentText, renderToken, type CoordLineModel } from './text';

export type Align = 'left' | 'center' | 'right';

export interface Scene {
  width: number;
  height: number;
  background: string;
  nodes: SceneNode[];
}

export type SceneNode =
  | FitStackNode
  | FooterNode
  | QuietNode
  | MarkNode
  | KickerNode
  | HeaderSplitNode
  | PlaceholderNode;

export interface FitStackNode {
  kind: 'fit-stack';
  left: number;
  right: number;
  top: number;
  gap: number;
  color: string;
  font: CssFont;
  lines: string[];
  align: Align;
  /** Line count of the footer extras, so the hero refits when telemetry appears. */
  footerCue: string;
}

export interface FooterNode {
  kind: 'footer';
  left: number;
  right: number;
  bottom: number;
  align: Align;
  arrangement: 'split' | 'stack' | 'message-then-split';
  color: string;
  message?: {
    text: string;
    font: CssFont;
    fontSize: number;
    lineHeight: number;
    maxWidth?: number;
    marginBottom: number;
  };
  metaLines: string[];
  metaFont: CssFont;
  metaSize: number;
  metaLineHeight: number;
  metaOpacity: number;
  metaTracking?: number;
  splitLeft?: string;
  splitRight?: string;
  extraLines: string[];
  telemetry?: TelemetryBlock;
  mark?: { text: string; font: CssFont; fontSize: number; opacity: number; tracking?: number; marginTop: number };
}

export interface TelemetryBlock {
  lines: TelemetryLine[];
  font: CssFont;
  fontSize: number;
  lineHeight: number;
  opacity: number;
}

export interface QuietNode {
  kind: 'quiet';
  left: number;
  right: number;
  top: number;
  bottom: number;
  align: Align;
  anchor: 'center' | 'end';
  color: string;
  blocks: QuietBlock[];
}

export type QuietBlock =
  | {
      kind: 'text';
      text: string;
      font: CssFont;
      fontSize: number;
      lineHeight: number;
      tracking?: number;
      marginTop: number;
      opacity?: number;
      maxWidth?: number;
    }
  | {
      kind: 'coords';
      lines: CoordLineModel[];
      font: CssFont;
      fontSize: number;
      lineHeight: number;
      tracking?: number;
      marginTop: number;
    }
  | { kind: 'rule'; width: number; height: number; marginTop: number; marginBottom: number; color: string }
  | {
      kind: 'rich-time';
      weekday: string;
      date: string;
      spoken: string;
      font: CssFont;
      italicFont: CssFont;
      fontSize: number;
      lineHeight: number;
      marginTop: number;
    }
  | {
      kind: 'meta';
      lines: string[];
      font: CssFont;
      fontSize: number;
      lineHeight: number;
      marginTop: number;
      opacity?: number;
      tracking?: number;
    }
  | {
      kind: 'rows';
      labelFont: CssFont;
      valueFont: CssFont;
      labelSize: number;
      valueSize: number;
      tracking: number;
      lineHeight: number;
      marginTop: number;
      gap: number;
      hairline: boolean;
      tabular: boolean;
      color: string;
      rows: { label: string; value: string }[];
    }
  | {
      kind: 'telemetry';
      lines: TelemetryLine[];
      font: CssFont;
      fontSize: number;
      lineHeight: number;
      marginTop: number;
      opacity: number;
    };

export interface MarkNode {
  kind: 'mark';
  left: number;
  right: number;
  bottom: number;
  align: Align;
  text: string;
  font: CssFont;
  fontSize: number;
  color: string;
  opacity: number;
  tracking?: number;
}

export interface KickerNode {
  kind: 'kicker';
  left: number;
  right: number;
  top: number;
  text: string;
  font: CssFont;
  fontSize: number;
  color: string;
  align: Align;
  tracking?: number;
}

export interface HeaderSplitNode {
  kind: 'header-split';
  left: number;
  right: number;
  top: number;
  leftText: string;
  rightText: string;
  font: CssFont;
  fontSize: number;
  color: string;
  tracking?: number;
}

export interface PlaceholderNode {
  kind: 'placeholder';
  text: string;
  sub?: string;
  font: CssFont;
  subFont: CssFont;
  color: string;
}

function fontOf(style: Style, role: FontRole): CssFont {
  return resolveFont(style.displayFontId, style.monoFontId, role);
}

function extras(style: Style, moment: Moment): string[] {
  return measured(style, moment).map((line) => line.text);
}

function measured(style: Style, moment: Moment) {
  const lines = measurementLines(style.measurements, style.temperatureUnit, moment);
  return omitSupersededAccuracy(lines, telemetryFor(style, moment));
}

function telemetryFor(style: Style, moment: Moment): TelemetryLine[] {
  if (!isTelemetryEnabled(style.measurements)) return [];
  return telemetryLines(moment);
}

function plexFont(): CssFont {
  const font = getFont('plex');
  return { family: font.family, weight: font.weight, style: 'normal', features: '"tnum" 1' };
}

function telemetryBlock(lines: TelemetryLine[], fontSize: number, lineHeight: number, opacity: number): TelemetryBlock | undefined {
  if (!lines.length) return undefined;
  return { lines, font: plexFont(), fontSize, lineHeight, opacity };
}

export function buildScene(style: Style, moment: Moment | null, message: string, now = new Date()): Scene {
  const format = FORMATS[style.format];
  if (!moment) {
    return {
      width: format.width,
      height: format.height,
      background: style.backgroundColor,
      nodes: [
        {
          kind: 'placeholder',
          text: 'Finding this place',
          sub: clockLabel(now, deviceTimeZone()),
          font: fontOf(style, 'mono'),
          subFont: fontOf(style, 'mono'),
          color: style.textColor,
        },
      ],
    };
  }
  const recipe = getRecipe(style.recipeId);
  const nodes =
    recipe.kind === 'poster'
      ? posterNodes(recipe, style, moment, message)
      : quietNodes(recipe, style, moment, message);
  return {
    width: format.width,
    height: format.height,
    background: style.backgroundColor,
    nodes,
  };
}

function posterNodes(recipe: PosterRecipe, style: Style, moment: Moment, message: string): SceneNode[] {
  const format = FORMATS[style.format];
  const native = !recipe.safe && style.format === recipe.nativeFormat;
  const box = native
    ? recipe.nativeBox
    : { left: format.inset.left, right: format.inset.right, top: format.inset.top, bottom: format.inset.bottom };
  const nodes: SceneNode[] = [];
  const showKicker =
    recipe.kicker &&
    (recipe.kicker.always || style.align === 'center') &&
    Boolean(renderToken(recipe.kicker.token, moment, message));

  let heroTop = native ? recipe.heroTop : box.top;
  if (showKicker && recipe.kicker) {
    const kickerTop = native ? recipe.kicker.top : box.top;
    const text = renderToken(recipe.kicker.token, moment, message)!;
    nodes.push({
      kind: 'kicker',
      left: recipe.kicker.always ? 0 : box.left,
      right: recipe.kicker.always ? 0 : box.right,
      top: kickerTop,
      text,
      font: fontOf(style, recipe.kicker.font),
      fontSize: recipe.kicker.size,
      color: style.textColor,
      align: style.align === 'right' && !recipe.kicker.always ? 'right' : recipe.kicker.always ? 'center' : style.align,
      tracking: recipe.kicker.tracking,
    });
    if (!native) heroTop = kickerTop + recipe.kicker.size + 46;
  }

  if (recipe.headerSplit) {
    const leftText = renderToken(recipe.headerSplit.left, moment, message);
    const rightText = renderToken(recipe.headerSplit.right, moment, message);
    if (leftText || rightText) {
      nodes.push({
        kind: 'header-split',
        left: box.left,
        right: box.right,
        top: native ? recipe.headerSplit.top : box.top,
        leftText: leftText ?? '',
        rightText: rightText ?? '',
        font: fontOf(style, 'mono'),
        fontSize: recipe.headerSplit.size,
        color: style.textColor,
        tracking: recipe.headerSplit.tracking,
      });
      if (!native) heroTop = (native ? recipe.headerSplit.top : box.top) + 80;
    }
  }

  let heroTokens = recipe.heroTokens;
  if (showKicker) heroTokens = heroTokens.filter((token) => token !== 'place-city-upper' && token !== 'place-full-upper');
  const lines = linesFor(heroTokens, moment, message);
  if (lines.length) {
    nodes.push({
      kind: 'fit-stack',
      left: box.left,
      right: box.right,
      top: heroTop,
      gap: recipe.heroGap,
      color: style.textColor,
      font: fontOf(style, 'display'),
      lines,
      align: style.align,
      footerCue: '',
    });
  }

  const footerColor = style.footerColor ?? style.textColor;
  const arrangement = footerArrangement(recipe, style.align);
  const metaLines = linesFor(recipe.footer.metaTokens, moment, message, recipe.footer.metaJoin);
  const extra = extras(style, moment);
  const telemetry = telemetryBlock(telemetryFor(style, moment), Math.min(16, recipe.footer.metaSize), 1.45, recipe.footer.metaOpacity);
  const hero = nodes.find((node) => node.kind === 'fit-stack');
  if (hero && hero.kind === 'fit-stack') {
    hero.footerCue = `${extra.length}:${telemetry?.lines.map((line) => line.id).join(',') ?? ''}`;
  }
  const messageText = renderToken('message', moment, message);
  const splitLeft = recipe.footer.splitLeft
    ? renderToken(recipe.footer.splitLeft, moment, message) ?? undefined
    : undefined;
  const splitRight = recipe.footer.splitRight
    ? renderToken(recipe.footer.splitRight, moment, message) ?? undefined
    : undefined;

  nodes.push({
    kind: 'footer',
    left: box.left,
    right: box.right,
    bottom: native ? recipe.nativeBox.bottom : box.bottom,
    align: style.align,
    arrangement,
    color: footerColor,
    message: messageText
      ? {
          text: messageText,
          font: fontOf(style, recipe.footer.messageFont),
          fontSize: recipe.footer.messageSize,
          lineHeight: recipe.footer.messageLineHeight,
          maxWidth: recipe.footer.messageMaxWidth,
          marginBottom: recipe.footer.messageMargin,
        }
      : undefined,
    metaLines,
    metaFont: fontOf(style, recipe.footer.metaFont),
    metaSize: recipe.footer.metaSize,
    metaLineHeight: recipe.footer.metaLineHeight,
    metaOpacity: recipe.footer.metaOpacity,
    metaTracking: recipe.footer.metaTracking,
    splitLeft,
    splitRight,
    extraLines: extra,
    telemetry,
    mark: recipe.footer.markInFlow
      ? {
          text: MARK,
          font: fontOf(style, 'mono'),
          fontSize: recipe.footer.markInFlow.size,
          opacity: recipe.footer.markInFlow.opacity,
          tracking: recipe.footer.markInFlow.tracking,
          marginTop: recipe.footer.markInFlow.marginTop,
        }
      : undefined,
  });

  if (recipe.absoluteMark) {
    nodes.push(markNode(style, recipe.absoluteMark, native ? recipe.absoluteMark.bottom : Math.max(recipe.absoluteMark.bottom, format.inset.bottom * 0.4)));
  }
  return nodes;
}

function footerArrangement(recipe: PosterRecipe, align: Align): FooterNode['arrangement'] {
  if (recipe.footer.arrangement === 'message-then-split') {
    return align === 'left' ? 'message-then-split' : 'stack';
  }
  if (align === 'center' || align === 'right') return 'stack';
  return recipe.footer.arrangement;
}

function quietNodes(recipe: QuietRecipe, style: Style, moment: Moment, message: string): SceneNode[] {
  const format = FORMATS[style.format];
  const native = !recipe.safe && style.format === recipe.nativeFormat;
  const side = native ? recipe.side : Math.max(recipe.side, format.inset.left);
  const anchor: 'center' | 'end' =
    recipe.anchor === 'align' ? (style.align === 'center' ? 'center' : 'end') : recipe.anchor;
  const top = native ? recipe.top : Math.max(recipe.top, anchor === 'center' ? 0 : format.inset.top);
  const bottom = native
    ? recipe.bottom
    : Math.max(recipe.bottom, format.inset.bottom);
  const blocks: QuietBlock[] = [];
  for (const spec of recipe.blocks) {
    const block = quietBlock(spec, style, moment, message);
    if (block) blocks.push(block);
  }
  const readings = measured(style, moment);
  const telemetry = telemetryFor(style, moment);
  if (readings.length || telemetry.length) {
    const rowBlock = recipe.measurementRows ? blocks.find((block) => block.kind === 'rows') : undefined;
    if (rowBlock && rowBlock.kind === 'rows') {
      for (const line of readings) {
        rowBlock.rows.push({ label: measurementLabel(line.id), value: measurementValue(line.id, line.text) });
      }
      for (const line of telemetry) {
        rowBlock.rows.push({ label: line.label, value: line.values.join('  ') });
      }
    } else {
      const meta = recipe.measurementMeta;
      if (readings.length) {
        blocks.push({
          kind: 'meta',
          lines: readings.map((line) => line.text),
          font: fontOf(style, meta?.font ?? 'mono'),
          fontSize: meta?.size ?? 16,
          lineHeight: meta?.lineHeight ?? 1.7,
          marginTop: meta?.marginTop ?? 22,
          opacity: meta?.opacity ?? 0.72,
          tracking: meta?.tracking,
        });
      }
      if (telemetry.length) {
        blocks.push({
          kind: 'telemetry',
          lines: telemetry,
          font: plexFont(),
          fontSize: meta?.size ?? 15,
          lineHeight: 1.55,
          marginTop: readings.length ? 10 : (meta?.marginTop ?? 18),
          opacity: meta?.opacity ?? 0.86,
        });
      }
    }
  }
  const nodes: SceneNode[] = [
    {
      kind: 'quiet',
      left: side,
      right: side,
      top,
      bottom,
      align: style.align,
      anchor,
      color: style.textColor,
      blocks,
    },
  ];
  if (recipe.absoluteMark) {
    const markBottom = native ? recipe.absoluteMark.bottom : Math.max(recipe.absoluteMark.bottom, format.inset.bottom * 0.45);
    const mark = markNode(style, recipe.absoluteMark, markBottom);
    if (recipe.markInset) {
      mark.left = side;
      mark.right = side;
    }
    nodes.push(mark);
  }
  return nodes;
}

function quietBlock(spec: QuietBlockSpec, style: Style, moment: Moment, message: string): QuietBlock | null {
  if (spec.kind === 'text') {
    const text = renderToken(spec.token, moment, message);
    if (!text) return null;
    return {
      kind: 'text',
      text,
      font: fontOf(style, spec.font),
      fontSize: spec.size,
      lineHeight: spec.lineHeight,
      tracking: spec.tracking,
      marginTop: spec.marginTop,
      opacity: spec.opacity,
      maxWidth: spec.maxWidth,
    };
  }
  if (spec.kind === 'coords') {
    return {
      kind: 'coords',
      lines: coordLines(moment, spec),
      font: fontOf(style, spec.font),
      fontSize: spec.size,
      lineHeight: spec.lineHeight,
      tracking: spec.tracking,
      marginTop: spec.marginTop,
    };
  }
  if (spec.kind === 'rule') {
    return {
      kind: 'rule',
      width: spec.width,
      height: spec.height,
      marginTop: spec.marginTop,
      marginBottom: spec.marginBottom,
      color: style.footerColor ?? style.textColor,
    };
  }
  if (spec.kind === 'rich-time') {
    const t = momentText(moment);
    return {
      kind: 'rich-time',
      weekday: t.weekdayComma,
      date: t.dateLong,
      spoken: t.timeSpoken,
      font: fontOf(style, spec.font),
      italicFont: fontOf(style, 'display-italic'),
      fontSize: spec.size,
      lineHeight: spec.lineHeight,
      marginTop: spec.marginTop,
    };
  }
  if (spec.kind === 'rows') {
    const rows = spec.items
      .map((item) => {
        const value = renderToken(item.token, moment, message);
        return value ? { label: item.label, value } : null;
      })
      .filter((row): row is { label: string; value: string } => Boolean(row));
    if (!rows.length) return null;
    return {
      kind: 'rows',
      labelFont: fontOf(style, spec.labelFont),
      valueFont: fontOf(style, spec.valueFont),
      labelSize: spec.labelSize,
      valueSize: spec.valueSize,
      tracking: spec.tracking,
      lineHeight: spec.lineHeight,
      marginTop: spec.marginTop,
      gap: spec.gap,
      hairline: spec.hairline,
      tabular: spec.tabular,
      color: style.textColor,
      rows,
    };
  }
  const lines = linesFor(spec.tokens, moment, message);
  if (!lines.length) return null;
  return {
    kind: 'meta',
    lines,
    font: fontOf(style, spec.font),
    fontSize: spec.size,
    lineHeight: spec.lineHeight,
    marginTop: spec.marginTop,
    opacity: spec.opacity,
    tracking: spec.tracking,
  };
}

function measurementLabel(id: string): string {
  if (id === 'temperature') return 'Temperature';
  if (id === 'sun') return 'Sun';
  if (id === 'accuracy') return 'Accuracy';
  return id;
}

function measurementValue(id: string, text: string): string {
  if (id === 'sun' && text.startsWith('sun ')) return text.slice(4);
  return text;
}

function markNode(
  style: Style,
  spec: { size: number; opacity: number; tracking?: number; bottom: number },
  bottom: number,
): MarkNode {
  return {
    kind: 'mark',
    left: 0,
    right: 0,
    bottom,
    align: style.align,
    text: MARK,
    font: fontOf(style, 'mono'),
    fontSize: spec.size,
    color: style.footerColor ?? style.textColor,
    opacity: spec.opacity,
    tracking: spec.tracking,
  };
}
