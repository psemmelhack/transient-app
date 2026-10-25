import { measurementLines, isTelemetryEnabled } from '../data/plugins';
import { deviceTimeZone, type Moment } from '../data/moment';
import { omitSupersededAccuracy, telemetryLines, type TelemetryLine } from '../data/telemetry';
import type { Style } from '../style/types';
import { FORMATS } from './formats';
import { getFont, resolveFont, type CssFont, type FontRole } from './fonts';
import { layoutPosterNote, noteFace, noteFontSize, noteMaxWidth, noteRhythm, NOTE_LEADING, wrappedLineCount } from './note';
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
  /** Line box as a fraction of font size when canvas bounding boxes cannot be trusted. */
  leading: number;
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
      /** A note wraps to its measure. Other lines may still shrink onto one line. */
      wrap?: boolean;
    }
  | {
      kind: 'note';
      label: string;
      text: string;
      font: CssFont;
      fontSize: number;
      lineHeight: number;
      labelFont: CssFont;
      labelSize: number;
      tracking: number;
      marginTop: number;
      maxWidth: number;
      color: string;
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
      leading: recipe.heroLeading ?? 0.92,
      footerCue: '',
    });
  }

  const footerColor = style.footerColor ?? style.textColor;
  const arrangement = footerArrangement(recipe, style.align);
  const metaLines = linesFor(recipe.footer.metaTokens, moment, message, recipe.footer.metaJoin);
  const extra = extras(style, moment);
  const telemetry = telemetryBlock(telemetryFor(style, moment), Math.min(16, recipe.footer.metaSize), 1.45, recipe.footer.metaOpacity);
  const messageText = renderToken('message', moment, message)?.trim() || null;
  const hero = nodes.find((node) => node.kind === 'fit-stack');
  if (hero && hero.kind === 'fit-stack') {
    hero.footerCue = `${extra.length}:${telemetry?.lines.map((line) => line.id).join(',') ?? ''}:${messageText?.length ?? 0}`;
  }
  const splitLeft = recipe.footer.splitLeft
    ? renderToken(recipe.footer.splitLeft, moment, message) ?? undefined
    : undefined;
  const splitRight = recipe.footer.splitRight
    ? renderToken(recipe.footer.splitRight, moment, message) ?? undefined
    : undefined;
  const contentWidth = format.width - box.left - box.right;
  const noteFont = noteFace(style.displayFontId, style.monoFontId, recipe.footer.messageFont);
  const posterNote = messageText
    ? layoutPosterNote({
        text: messageText,
        ceiling: recipe.footer.messageSize,
        contentWidth,
        rhythm: noteRhythm(noteFont.family),
        arrangement,
        splitWidth: recipe.footer.messageMaxWidth,
        marginBottom: recipe.footer.messageMargin,
      })
    : null;

  nodes.push({
    kind: 'footer',
    left: box.left,
    right: box.right,
    bottom: native ? recipe.nativeBox.bottom : box.bottom,
    align: style.align,
    arrangement: posterNote?.arrangement ?? arrangement,
    color: footerColor,
    message: messageText && posterNote
      ? {
          text: messageText,
          font: noteFont,
          fontSize: posterNote.fontSize,
          lineHeight: posterNote.lineHeight,
          maxWidth: posterNote.maxWidth,
          marginBottom: posterNote.marginBottom,
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
    const mark = markNode(style, recipe.absoluteMark, native ? recipe.absoluteMark.bottom : Math.max(recipe.absoluteMark.bottom, format.inset.bottom * 0.4));
    mark.left = box.left;
    mark.right = box.right;
    nodes.push(mark);
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
  let top = native ? recipe.top : Math.max(recipe.top, anchor === 'center' ? 0 : format.inset.top);
  let bottom = native ? recipe.bottom : Math.max(recipe.bottom, format.inset.bottom);
  const contentWidth = format.width - side * 2;
  const blocks: QuietBlock[] = [];
  for (const spec of recipe.blocks) {
    const block = quietBlock(spec, style, moment, message, contentWidth);
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
  const rawHeight = quietStackHeight(blocks);
  let available = format.height - top - bottom;
  if (rawHeight > available) {
    const topFloor = 28;
    const bottomFloor = recipe.absoluteMark ? recipe.absoluteMark.bottom + recipe.absoluteMark.size + 10 : 40;
    let deficit = rawHeight - available;
    const topGain = Math.min(Math.max(0, top - topFloor), deficit);
    top -= topGain;
    deficit -= topGain;
    const bottomGain = Math.min(Math.max(0, bottom - bottomFloor), deficit);
    bottom -= bottomGain;
    available = format.height - top - bottom;
  }
  const fitted = fitQuietBlocks(blocks, available);
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
      blocks: fitted,
    },
  ];
  if (recipe.absoluteMark) {
    const markBottom = native ? recipe.absoluteMark.bottom : Math.max(recipe.absoluteMark.bottom, format.inset.bottom * 0.45);
    const mark = markNode(style, recipe.absoluteMark, markBottom);
    mark.left = side;
    mark.right = side;
    nodes.push(mark);
  }
  return nodes;
}

function quietBlock(spec: QuietBlockSpec, style: Style, moment: Moment, message: string, contentWidth: number): QuietBlock | null {
  if (spec.kind === 'text') {
    const raw = renderToken(spec.token, moment, message);
    if (!raw) return null;
    if (spec.token === 'message') {
      const text = raw.trim();
      const font = noteFace(style.displayFontId, style.monoFontId, spec.font);
      const fontSize = noteFontSize(text.length, spec.size);
      return {
        kind: 'text',
        text,
        font,
        fontSize,
        lineHeight: NOTE_LEADING,
        marginTop: spec.marginTop,
        opacity: spec.opacity,
        maxWidth: noteMaxWidth(fontSize, noteRhythm(font.family), contentWidth),
        wrap: true,
      };
    }
    return {
      kind: 'text',
      text: raw,
      font: fontOf(style, spec.font),
      fontSize: spec.size,
      lineHeight: spec.lineHeight,
      tracking: spec.tracking,
      marginTop: spec.marginTop,
      opacity: spec.opacity,
      maxWidth: spec.maxWidth,
    };
  }
  if (spec.kind === 'note') {
    const raw = renderToken('message', moment, message);
    if (!raw?.trim()) return null;
    const text = raw.trim();
    const font = noteFace(style.displayFontId, style.monoFontId, spec.font);
    const fontSize = noteFontSize(text.length, spec.ceiling);
    return {
      kind: 'note',
      label: 'Note',
      text,
      font,
      fontSize,
      lineHeight: NOTE_LEADING,
      labelFont: fontOf(style, 'mono'),
      labelSize: spec.labelSize,
      tracking: spec.tracking,
      marginTop: spec.marginTop,
      maxWidth: noteMaxWidth(fontSize, noteRhythm(font.family), contentWidth),
      color: style.textColor,
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

export function quietStackHeight(blocks: QuietBlock[]): number {
  return blocks.reduce((sum, block) => sum + quietBlockHeight(block), 0);
}

function quietBlockHeight(block: QuietBlock): number {
  switch (block.kind) {
    case 'text': {
      const lines = block.wrap
        ? wrappedLineCount(block.text, block.fontSize, block.maxWidth ?? 10_000, noteRhythm(block.font.family))
        : 1;
      return block.marginTop + block.fontSize * block.lineHeight * Math.max(1, lines);
    }
    case 'note': {
      const lines = wrappedLineCount(block.text, block.fontSize, block.maxWidth, noteRhythm(block.font.family));
      return block.marginTop + 10 + block.labelSize * 1.4 + 8 + block.fontSize * block.lineHeight * Math.max(1, lines);
    }
    case 'coords':
      return block.marginTop + block.lines.length * block.fontSize * block.lineHeight;
    case 'rule':
      return block.marginTop + block.height + block.marginBottom;
    case 'rich-time':
      return block.marginTop + block.fontSize * block.lineHeight * 2;
    case 'meta':
      return block.marginTop + block.lines.length * block.fontSize * block.lineHeight;
    case 'rows':
      return block.marginTop + block.rows.length * (block.gap * 2 + block.valueSize * block.lineHeight);
    case 'telemetry':
      return block.marginTop + block.lines.length * block.fontSize * block.lineHeight;
    default:
      return 0;
  }
}

/** Height of the footer stack, with a split note sharing a row with the small print. */
export function footerBlockHeight(node: FooterNode): number {
  const message = node.message;
  let messageHeight = 0;
  if (message) {
    const lines = wrappedLineCount(
      message.text,
      message.fontSize,
      message.maxWidth ?? 10_000,
      noteRhythm(message.font.family),
    );
    const gap = node.arrangement === 'split' ? 0 : message.marginBottom;
    messageHeight = lines * message.fontSize * message.lineHeight + gap;
  }
  const metaHeight = node.metaLines.length * node.metaSize * node.metaLineHeight;
  const splitHeight =
    node.arrangement === 'message-then-split' && (node.splitLeft || node.splitRight)
      ? node.metaSize * node.metaLineHeight
      : 0;
  const body = node.arrangement === 'split' ? Math.max(messageHeight, metaHeight) : messageHeight + metaHeight + splitHeight;
  const extra = node.extraLines.length ? 10 + node.extraLines.length * node.metaSize * node.metaLineHeight : 0;
  const telemetry = node.telemetry
    ? 12 + node.telemetry.lines.length * node.telemetry.fontSize * node.telemetry.lineHeight
    : 0;
  const mark = node.mark ? node.mark.marginTop + node.mark.fontSize * 1.4 : 0;
  return body + extra + telemetry + mark;
}

function fitQuietBlocks(blocks: QuietBlock[], available: number): QuietBlock[] {
  if (quietStackHeight(blocks) <= available) return blocks;
  const next = structuredClone(blocks) as QuietBlock[];
  for (const block of next) {
    if (block.kind === 'text' && block.wrap) block.marginTop = Math.min(block.marginTop, 28);
    if (block.kind === 'note') block.marginTop = Math.min(block.marginTop, 14);
    if (block.kind === 'meta') block.marginTop = Math.min(block.marginTop, 18);
    if (block.kind === 'coords') block.marginTop = Math.min(block.marginTop, 24);
    if (block.kind === 'rich-time') block.marginTop = Math.min(block.marginTop, 24);
  }
  const rows = next.find((block) => block.kind === 'rows');
  if (rows && rows.kind === 'rows') {
    while (quietStackHeight(next) > available && rows.gap > 6) rows.gap -= 1;
  }
  if (quietStackHeight(next) <= available) return next;
  const coords = next.find((block) => block.kind === 'coords');
  if (coords && coords.kind === 'coords') {
    const floor = Math.max(72, Math.round(coords.fontSize * 0.42));
    while (quietStackHeight(next) > available && coords.fontSize > floor) coords.fontSize -= 2;
  }
  return next;
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
