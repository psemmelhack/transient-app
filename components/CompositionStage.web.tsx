import { forwardRef, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CssFont } from '../src/composition/fonts';
import { fontCss } from '../src/composition/fonts';
import { fitLine, verticalMetricsTrusted, type ProbeMetrics } from '../src/composition/fit';
import { cssFontShorthand, ensureFonts } from '../src/composition/fontReady';
import { heroScaleToClear, scaleClearanceBox } from '../src/composition/heroClearance';
import { noteRhythm, wrapNote } from '../src/composition/note';
import { beginFit, endFit } from '../src/composition/fitSession';
import type {
  Align,
  FitStackNode,
  FooterNode,
  HeaderSplitNode,
  KickerNode,
  MarkNode,
  PlaceholderNode,
  QuietBlock,
  QuietNode,
  Scene,
  SceneNode,
} from '../src/composition/scene';

interface Props {
  scene: Scene;
  full?: boolean;
}

export const CompositionStage = forwardRef<HTMLDivElement, Props>(function CompositionStage({ scene, full }, ref) {
  const frameRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(full ? 1 : 0.25);

  useLayoutEffect(() => {
    if (full) {
      setScale(1);
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;
    const apply = () => {
      const width = frame.clientWidth;
      if (width > 0) setScale(width / scene.width);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [full, scene.width, scene.height]);

  useEffect(() => {
    if (typeof ref === 'function') ref(stageRef.current);
    else if (ref) ref.current = stageRef.current;
  });

  return (
    <div
      ref={frameRef}
      style={{
        width: full ? scene.width : '100%',
        height: full ? scene.height : undefined,
        aspectRatio: full ? undefined : `${scene.width} / ${scene.height}`,
        position: 'relative',
        overflow: 'hidden',
        background: scene.background,
      }}
    >
      <div
        ref={stageRef}
        data-stage
        style={{
          width: scene.width,
          height: scene.height,
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          background: scene.background,
          overflow: 'hidden',
          fontSynthesis: 'none',
          fontKerning: 'normal',
        }}
      >
        {scene.nodes.map((node, index) => (
          <NodeView key={nodeKey(node, index)} node={node} />
        ))}
      </div>
    </div>
  );
});

function nodeKey(node: SceneNode, index: number): string {
  if (node.kind === 'fit-stack') return `fit-${node.lines.join('|')}-${node.font.family}-${node.top}`;
  if (node.kind === 'footer') return `foot-${node.metaLines.join('|')}-${node.message?.text ?? ''}-${node.extraLines.join('|')}`;
  if (node.kind === 'quiet') return `quiet-${index}-${node.blocks.length}`;
  return `${node.kind}-${index}`;
}

function NodeView({ node }: { node: SceneNode }) {
  switch (node.kind) {
    case 'fit-stack':
      return <FitStack node={node} />;
    case 'footer':
      return <Footer node={node} />;
    case 'quiet':
      return <Quiet node={node} />;
    case 'mark':
      return <Mark node={node} />;
    case 'kicker':
      return <Kicker node={node} />;
    case 'header-split':
      return <HeaderSplit node={node} />;
    case 'placeholder':
      return <Placeholder node={node} />;
    default:
      return null;
  }
}

interface RowFit {
  text: string;
  fontSize: number;
  height: number;
  shiftTop: number;
  shiftLeft: number;
}

function fitSignature(node: FitStackNode): string {
  return `${node.lines.join('\n')}|${node.font.family}|${node.font.weight}|${node.font.style}|${node.font.variation ?? ''}|${node.gap}|${node.leading}|${node.left}|${node.right}|${node.top}|${node.color}|${node.align}|${node.footerCue}`;
}

const FitStack = memo(
  function FitStack({ node }: { node: FitStackNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const signature = fitSignature(node);
    const [rows, setRows] = useState<RowFit[]>([]);
    const [gap, setGap] = useState(node.gap);

    useLayoutEffect(() => {
      const root = ref.current;
      if (!root || node.lines.length === 0) return;
      let cancelled = false;
      beginFit();
      (async () => {
        try {
          await ensureFonts([cssFontShorthand(node.font, 200), cssFontShorthand(node.font, 96)]);
          if (cancelled || !ref.current) return;
          const live = ref.current;
          const width = live.clientWidth || 1;
          const next: RowFit[] = [];
          const slots = live.querySelectorAll<HTMLElement>('[data-fit]');
          for (let index = 0; index < node.lines.length; index++) {
            if (cancelled) return;
            const row = slots[index];
            if (!row) return;
            next.push(await fitRow(row, node.lines[index], width, node.font, node.leading));
          }
          if (cancelled || !ref.current) return;
          const host = ref.current;
          applyRows(host, next, node.gap);
          const footer = host.closest('[data-stage]')?.querySelector<HTMLElement>('[data-role="footer"]') ?? null;
          const scale = footer ? heroScaleToClear(host.offsetTop, host.offsetHeight, footer.offsetTop) : 1;
          const fitted = next.map((row) => scaleClearanceBox(row, scale));
          const fittedGap = scale < 0.999 ? node.gap * scale : node.gap;
          applyRows(host, fitted, fittedGap);
          if (cancelled) return;
          setRows(fitted);
          setGap(fittedGap);
        } finally {
          endFit();
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [signature, node.align, node.lines, node.font, node.leading, node.gap]);

    return (
      <div
        ref={ref}
        data-role="fit-stack"
        data-align={node.align}
        style={{
          position: 'absolute',
          left: node.left,
          right: node.right,
          top: node.top,
          display: 'flex',
          flexDirection: 'column',
          gap,
          color: node.color,
          ...fontCss(node.font),
        }}
      >
        {node.lines.map((line, index) => {
          const fit = rows[index];
          return (
            <div
              key={`${index}-${line}`}
              data-fit
              style={{
                lineHeight: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                fontSize: fit?.fontSize,
                height: fit?.height,
              }}
            >
              <span
                style={{
                  position: 'relative',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  lineHeight: 1,
                  top: fit?.shiftTop ?? 0,
                  left: fit?.shiftLeft ?? 0,
                }}
              >
                {line}
              </span>
            </div>
          );
        })}
      </div>
    );
  },
  (prev, next) => fitSignature(prev.node) === fitSignature(next.node),
);

let measureCanvas: HTMLCanvasElement | null = null;

function applyRows(root: HTMLElement, rows: RowFit[], gap: number) {
  root.style.gap = `${gap}px`;
  root.style.transform = 'none';
  const slots = root.querySelectorAll<HTMLElement>('[data-fit]');
  rows.forEach((row, index) => {
    const el = slots[index];
    if (!el) return;
    el.style.fontSize = `${row.fontSize}px`;
    el.style.height = `${row.height}px`;
    el.style.lineHeight = '1';
    el.style.overflow = 'hidden';
    const span = el.firstElementChild;
    if (span instanceof HTMLElement) {
      span.style.top = `${row.shiftTop}px`;
      span.style.left = `${row.shiftLeft}px`;
    }
  });
}

async function fitRow(row: HTMLElement, text: string, targetWidth: number, font: CssFont, leading: number): Promise<RowFit> {
  const probe = 200;
  const spec = cssFontShorthand(font, probe);
  await ensureFonts([spec]);
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  const fallback: RowFit = { text, fontSize: probe, height: Math.max(1, probe * leading), shiftTop: 0, shiftLeft: 0 };
  if (!ctx) return fallback;
  row.style.fontSize = `${probe}px`;
  row.style.lineHeight = '1';
  row.style.height = 'auto';
  const span = row.firstElementChild instanceof HTMLElement ? row.firstElementChild : null;
  if (span) {
    span.style.display = 'inline-block';
    span.style.top = '0px';
    span.style.left = '0px';
    span.textContent = text;
  }
  const domW = span?.offsetWidth || 1;
  ctx.font = spec;
  const measured = ctx.measureText(text);
  const advance = measured.width || domW;
  let left = finiteBox(measured.actualBoundingBoxLeft);
  let right = finiteBox(measured.actualBoundingBoxRight);
  if (left + right < 1) {
    left = 0;
    right = advance;
  }
  const metrics: ProbeMetrics = {
    probeSize: probe,
    advanceWidth: advance,
    domAdvanceWidth: domW,
    actualBoundingBoxLeft: left,
    actualBoundingBoxRight: right,
    actualBoundingBoxAscent: finiteBox(measured.actualBoundingBoxAscent),
    actualBoundingBoxDescent: finiteBox(measured.actualBoundingBoxDescent),
    fontBoundingBoxAscent: finiteBox(measured.fontBoundingBoxAscent),
    fontBoundingBoxDescent: finiteBox(measured.fontBoundingBoxDescent),
  };
  const fitted = fitLine(metrics, targetWidth, { leading, trusted: verticalMetricsTrusted(metrics) });
  return { text, fontSize: fitted.fontSize, height: fitted.height, shiftTop: fitted.shiftTop, shiftLeft: fitted.shiftLeft };
}

function finiteBox(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function Footer({ node }: { node: FooterNode }) {
  const alignItems = node.align === 'center' ? 'center' : node.align === 'right' ? 'flex-end' : 'flex-start';
  const metaStyle = {
    ...fontCss(node.metaFont),
    fontSize: node.metaSize,
    lineHeight: safeLeading(node.metaLineHeight, 1.45),
    opacity: node.metaOpacity,
    letterSpacing: node.metaTracking ? `${node.metaTracking}em` : undefined,
  } as const;
  return (
    <div
      data-role="footer"
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        bottom: node.bottom,
        color: node.color,
        textAlign: node.align,
      }}
    >
      {node.arrangement === 'split' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 28 }}>
          <div style={metaStyle}>
            {node.metaLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
          {node.message && <Message node={node} />}
        </div>
      ) : node.arrangement === 'message-then-split' ? (
        <div>
          {node.message && <Message node={node} />}
          <div style={{ ...metaStyle, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span>{node.splitLeft}</span>
            <span>{node.splitRight}</span>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems }}>
          {node.message && <Message node={node} />}
          <div style={metaStyle}>
            {node.metaLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
      )}
      {node.extraLines.length > 0 && (
        <div style={{ ...metaStyle, marginTop: 10 }}>
          {node.extraLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      )}
      {node.telemetry && (
        <div style={{ display: 'flex', justifyContent: alignItems === 'center' ? 'center' : alignItems === 'flex-end' ? 'flex-end' : 'flex-start', marginTop: 12, width: '100%' }}>
          <TelemetryTable block={node.telemetry} color={node.color} />
        </div>
      )}
      {node.mark && (
        <div
          style={{
            ...fontCss(node.mark.font),
            fontSize: node.mark.fontSize,
            opacity: node.mark.opacity,
            letterSpacing: node.mark.tracking ? `${node.mark.tracking}em` : undefined,
            marginTop: node.mark.marginTop,
          }}
        >
          {node.mark.text}
        </div>
      )}
    </div>
  );
}

function Message({ node }: { node: FooterNode }) {
  if (!node.message) return null;
  const align = node.align === 'center' ? 'center' : node.align === 'right' && node.arrangement !== 'split' ? 'right' : 'left';
  return (
    <div
      data-role="note"
      data-note-copy
      style={{
        ...fontCss(node.message.font),
        fontSize: node.message.fontSize,
        lineHeight: safeLeading(node.message.lineHeight, 1.4),
        width: node.message.maxWidth,
        maxWidth: '100%',
        marginBottom: node.arrangement === 'split' ? 0 : node.message.marginBottom,
        marginLeft: align === 'center' || align === 'right' ? 'auto' : undefined,
        marginRight: align === 'center' ? 'auto' : undefined,
        textAlign: align,
      }}
    >
      <NoteLines text={node.message.text} fontSize={node.message.fontSize} maxWidth={node.message.maxWidth ?? 10_000} family={node.message.font.family} />
    </div>
  );
}

function Quiet({ node }: { node: QuietNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const signature = JSON.stringify(node.blocks);
  const [fit, setFit] = useState<{ scale: number; origin: string }>({ scale: 1, origin: 'center left' });

  useLayoutEffect(() => {
    const root = ref.current;
    const inner = innerRef.current;
    if (!root || !inner) return;
    let cancelled = false;
    beginFit();
    (async () => {
      try {
        await ensureFonts(quietFontSpecs(node));
        if (cancelled || !ref.current || !innerRef.current) return;
        const available = ref.current.clientHeight;
        const natural = innerRef.current.offsetHeight;
        const origin =
          node.anchor === 'end'
            ? node.align === 'right'
              ? 'bottom right'
              : node.align === 'center'
                ? 'bottom center'
                : 'bottom left'
            : node.align === 'right'
              ? 'center right'
              : node.align === 'center'
                ? 'center center'
                : 'center left';
        const scale = available > 0 && natural > available ? available / natural : 1;
        setFit((prev) => (prev.scale === scale && prev.origin === origin ? prev : { scale, origin }));
      } finally {
        endFit();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signature, node.anchor, node.align]);

  return (
    <div
      ref={ref}
      data-role="quiet"
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        top: node.top,
        bottom: node.bottom,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: node.anchor === 'center' ? 'center' : 'flex-end',
        alignItems: node.align === 'center' ? 'center' : node.align === 'right' ? 'flex-end' : 'flex-start',
        textAlign: node.align,
        color: node.color,
      }}
    >
      <div
        ref={innerRef}
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'inherit',
          transform: fit.scale === 1 ? undefined : `scale(${fit.scale})`,
          transformOrigin: fit.origin,
        }}
      >
        {node.blocks.map((block, index) => (
          <QuietPiece key={index} block={block} align={node.align} />
        ))}
      </div>
    </div>
  );
}

function safeLeading(value: number, fallback = 1.2): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function quietFontSpecs(node: QuietNode): string[] {
  const specs: string[] = [];
  const add = (font: CssFont | undefined, size: number) => {
    if (!font) return;
    specs.push(cssFontShorthand(font, size));
  };
  for (const block of node.blocks) {
    if (block.kind === 'rule') continue;
    if (block.kind === 'rich-time') {
      add(block.font, block.fontSize);
      add(block.italicFont, block.fontSize);
      continue;
    }
    if (block.kind === 'rows') {
      add(block.labelFont, block.labelSize);
      add(block.valueFont, block.valueSize);
      continue;
    }
    if (block.kind === 'note') {
      add(block.font, block.fontSize);
      add(block.labelFont, block.labelSize);
      continue;
    }
    if ('font' in block && 'fontSize' in block) add(block.font, block.fontSize);
  }
  return specs;
}

function QuietPiece({ block, align }: { block: QuietBlock; align: Align }) {
  if (block.kind === 'rule') {
    return (
      <div
        style={{
          width: block.width,
          height: block.height,
          background: block.color,
          marginTop: block.marginTop,
          marginBottom: block.marginBottom,
          alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        }}
      />
    );
  }
  if (block.kind === 'coords') {
    return (
      <ShrinkText font={block.font} fontSize={block.fontSize} lineHeight={safeLeading(block.lineHeight, 1.15)} tracking={block.tracking} marginTop={block.marginTop}>
        {block.lines.map((line) => (
          <div key={`${line.value}${line.suffix ?? ''}`}>
            {line.value}
            {line.degree && (
              <span style={{ fontSize: '0.6em', verticalAlign: '0.55em', marginLeft: '0.02em' }}>°</span>
            )}
            {line.suffix ? ` ${line.suffix}` : ''}
          </div>
        ))}
      </ShrinkText>
    );
  }
  if (block.kind === 'rich-time') {
    return (
      <div
        style={{
          ...fontCss(block.font),
          fontSize: block.fontSize,
          lineHeight: safeLeading(block.lineHeight, 1.2),
          marginTop: block.marginTop,
        }}
      >
        <span style={{ ...fontCss(block.italicFont) }}>{block.weekday}</span> {block.date}
        <br />
        {block.spoken}
      </div>
    );
  }
  if (block.kind === 'meta') {
    return (
      <div
        style={{
          ...fontCss(block.font),
          fontSize: block.fontSize,
          lineHeight: safeLeading(block.lineHeight, 1.45),
          marginTop: block.marginTop,
          opacity: block.opacity,
          letterSpacing: block.tracking ? `${block.tracking}em` : undefined,
        }}
      >
        {block.lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    );
  }
  if (block.kind === 'telemetry') {
    const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
    return (
      <div style={{ display: 'flex', justifyContent: justify, width: '100%', marginTop: block.marginTop }}>
        <TelemetryTable block={block} />
      </div>
    );
  }
  if (block.kind === 'note') {
    return (
      <div data-role="note" style={{ width: '100%', marginTop: block.marginTop, textAlign: 'left' }}>
        <div style={{ borderTop: `1px solid ${block.color}`, paddingTop: 10 }}>
          <div
            style={{
              ...fontCss(block.labelFont),
              fontSize: block.labelSize,
              letterSpacing: `${block.tracking}em`,
              lineHeight: 1.4,
              textTransform: 'uppercase',
            }}
          >
            {block.label}
          </div>
          <div
            data-role="note-copy"
            style={{
              ...fontCss(block.font),
              fontSize: block.fontSize,
              lineHeight: safeLeading(block.lineHeight),
              marginTop: 8,
              width: block.maxWidth,
              maxWidth: '100%',
              fontFeatureSettings: block.font.features,
            }}
          >
            <NoteLines text={block.text} fontSize={block.fontSize} maxWidth={block.maxWidth} family={block.font.family} />
          </div>
        </div>
      </div>
    );
  }
  if (block.kind === 'text' && block.wrap) {
    return (
      <div
        data-role="note"
        data-note-copy
        style={{
          ...fontCss(block.font),
          fontSize: block.fontSize,
          lineHeight: safeLeading(block.lineHeight),
          marginTop: block.marginTop,
          opacity: block.opacity,
          width: block.maxWidth ?? '100%',
          maxWidth: '100%',
          alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          textAlign: align,
          fontFeatureSettings: block.font.features,
        }}
      >
        <NoteLines text={block.text} fontSize={block.fontSize} maxWidth={block.maxWidth ?? 10_000} family={block.font.family} />
      </div>
    );
  }
  if (block.kind === 'rows') {
    return (
      <div style={{ width: '100%', marginTop: block.marginTop }}>
        {block.rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 28,
              paddingTop: block.gap,
              paddingBottom: block.gap,
              borderBottom: block.hairline ? `1px solid ${block.color}` : undefined,
            }}
          >
            <span
              style={{
                ...fontCss(block.labelFont),
                fontSize: block.labelSize,
                lineHeight: safeLeading(block.lineHeight),
                letterSpacing: `${block.tracking}em`,
                textTransform: 'uppercase',
                flex: 'none',
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                ...fontCss(block.valueFont),
                fontSize: block.valueSize,
                lineHeight: safeLeading(block.lineHeight),
                textAlign: 'right',
                whiteSpace: 'pre',
                fontFeatureSettings: block.tabular ? '"tnum" 1' : block.valueFont.features,
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ShrinkText
      font={block.font}
      fontSize={block.fontSize}
      lineHeight={block.lineHeight}
      tracking={block.tracking}
      marginTop={block.marginTop}
      opacity={block.opacity}
      maxWidth={block.maxWidth}
    >
      {block.text}
    </ShrinkText>
  );
}

function TelemetryTable({ block, color }: { block: { lines: { id: string; label: string; values: string[] }[]; font: CssFont; fontSize: number; lineHeight: number; opacity: number }; color?: string }) {
  return (
    <div
      data-role="telemetry"
      style={{
        ...fontCss(block.font),
        fontSize: block.fontSize,
        lineHeight: safeLeading(block.lineHeight),
        opacity: block.opacity,
        color,
        fontFeatureSettings: '"tnum" 1',
        fontVariantNumeric: 'tabular-nums',
        display: 'grid',
        gridTemplateColumns: '5.8em repeat(3, 4.5em)',
        columnGap: '0.55em',
        width: 'max-content',
        maxWidth: '100%',
      }}
    >
      {block.lines.map((line) => (
        <TelemetryRow key={line.id} line={line} />
      ))}
    </div>
  );
}

function TelemetryRow({ line }: { line: { label: string; values: string[] } }) {
  return (
    <>
      <span style={{ letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>{line.label}</span>
      {line.values.length === 1 ? (
        <span style={{ gridColumn: '2 / span 3', textAlign: 'right', whiteSpace: 'pre' }}>{line.values[0]}</span>
      ) : (
        line.values.map((value, index) => (
          <span key={index} style={{ textAlign: 'right', whiteSpace: 'pre' }}>
            {value}
          </span>
        ))
      )}
    </>
  );
}

function ShrinkText({
  font,
  fontSize,
  lineHeight,
  tracking,
  marginTop,
  opacity,
  maxWidth,
  children,
}: {
  font: CssFont;
  fontSize: number;
  lineHeight: number;
  tracking?: number;
  marginTop: number;
  opacity?: number;
  maxWidth?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let size = fontSize;
    el.style.fontSize = `${size}px`;
    const limit = el.clientWidth;
    let guard = 0;
    while (el.scrollWidth > limit + 1 && size > 16 && guard < 14) {
      size *= limit / el.scrollWidth;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  }, [fontSize, children, font.family, font.weight]);
  return (
    <div
      ref={ref}
      style={{
        ...fontCss(font),
        fontSize,
        lineHeight,
        letterSpacing: tracking ? `${tracking}em` : undefined,
        marginTop,
        opacity,
        maxWidth,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
  );
}

function Mark({ node }: { node: MarkNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        bottom: node.bottom,
        textAlign: node.align,
        ...fontCss(node.font),
        fontSize: node.fontSize,
        color: node.color,
        opacity: node.opacity,
        letterSpacing: node.tracking ? `${node.tracking}em` : undefined,
        paddingRight: node.align === 'right' && node.tracking ? `${node.tracking}em` : undefined,
      }}
    >
      {node.text}
    </div>
  );
}

function NoteLines({ text, fontSize, maxWidth, family }: { text: string; fontSize: number; maxWidth: number; family: string }) {
  const lines = wrapNote(text, fontSize, maxWidth, noteRhythm(family));
  return lines.map((line, index) => (
    <div key={`${index}-${line}`} style={{ whiteSpace: 'pre' }}>
      {line}
    </div>
  ));
}

function Kicker({ node }: { node: KickerNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        top: node.top,
        textAlign: node.align,
        ...fontCss(node.font),
        fontSize: node.fontSize,
        color: node.color,
        letterSpacing: node.tracking ? `${node.tracking}em` : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      <ShrinkText font={node.font} fontSize={node.fontSize} lineHeight={1.2} tracking={node.tracking} marginTop={0}>
        {node.text}
      </ShrinkText>
    </div>
  );
}

function HeaderSplit({ node }: { node: HeaderSplitNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        top: node.top,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        ...fontCss(node.font),
        fontSize: node.fontSize,
        color: node.color,
        letterSpacing: node.tracking ? `${node.tracking}em` : undefined,
      }}
    >
      <span>{node.leftText}</span>
      <span>{node.rightText}</span>
    </div>
  );
}

function Placeholder({ node }: { node: PlaceholderNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: node.color,
        textAlign: 'center',
      }}
    >
      <div style={{ ...fontCss(node.font), fontSize: 22, letterSpacing: '0.08em' }}>{node.text}</div>
      {node.sub && <div style={{ ...fontCss(node.subFont), fontSize: 16, opacity: 0.7 }}>{node.sub}</div>}
    </div>
  );
}
