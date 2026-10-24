import { forwardRef, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { CssFont } from '../src/composition/fonts';
import { fontCss } from '../src/composition/fonts';
import { fitLine, type ProbeMetrics } from '../src/composition/fit';
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
  fontSize: number;
  height: number;
  html: string;
}

function fitSignature(node: FitStackNode): string {
  return `${node.lines.join('\n')}|${node.font.family}|${node.font.weight}|${node.font.style}|${node.font.variation ?? ''}|${node.gap}|${node.left}|${node.right}|${node.top}|${node.color}|${node.align}|${node.footerCue}`;
}

const FitStack = memo(
  function FitStack({ node }: { node: FitStackNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const signature = fitSignature(node);
    const [rows, setRows] = useState<RowFit[]>([]);
    const [stackScale, setStackScale] = useState<{ scale: number; origin: string }>({ scale: 1, origin: 'top left' });

    useLayoutEffect(() => {
      const root = ref.current;
      if (!root || node.lines.length === 0) return;
      let cancelled = false;
      beginFit();
      (async () => {
        try {
          await document.fonts.ready;
          if (cancelled || !ref.current) return;
          const live = ref.current;
          const width = live.clientWidth || 1;
          const next: RowFit[] = [];
          const slots = live.querySelectorAll<HTMLElement>('[data-fit]');
          for (let index = 0; index < node.lines.length; index++) {
            if (cancelled) return;
            const row = slots[index];
            if (!row) return;
            next.push(await fitRow(row, node.lines[index], width, node.font));
          }
          if (cancelled) return;
          const scaled = scaleAgainstFooter(live, node.align);
          live.style.transform = scaled.scale === 1 ? '' : `scale(${scaled.scale})`;
          live.style.transformOrigin = scaled.origin;
          setRows(next);
          setStackScale(scaled);
        } finally {
          endFit();
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [signature, node.align, node.lines, node.font]);

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
          gap: node.gap,
          color: node.color,
          transform: stackScale.scale === 1 ? undefined : `scale(${stackScale.scale})`,
          transformOrigin: stackScale.origin,
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
              dangerouslySetInnerHTML={{ __html: fit?.html ?? '' }}
            />
          );
        })}
      </div>
    );
  },
  (prev, next) => fitSignature(prev.node) === fitSignature(next.node),
);

let measureCanvas: HTMLCanvasElement | null = null;

function canvasFont(font: CssFont, size: number): string {
  const family = font.family.includes(' ') ? `"${font.family}"` : font.family;
  return `${font.style} ${font.weight} ${size}px ${family}`;
}

async function fitRow(row: HTMLElement, text: string, targetWidth: number, font: CssFont): Promise<RowFit> {
  const probe = 200;
  const spec = canvasFont(font, probe);
  try {
    await document.fonts.load(spec, text);
  } catch {
    /* measurement still runs with whatever face is ready */
  }
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) return { fontSize: probe, height: probe, html: escapeHtml(text) };
  row.style.fontSize = `${probe}px`;
  row.style.lineHeight = '1';
  row.innerHTML = `<span style="display:inline-block;white-space:nowrap;line-height:1">${escapeHtml(text)}</span>`;
  const span = row.firstElementChild as HTMLElement | null;
  const domW = span?.offsetWidth || 1;
  ctx.font = spec;
  const measured = ctx.measureText(text);
  const metrics: ProbeMetrics = {
    probeSize: probe,
    advanceWidth: measured.width || domW,
    domAdvanceWidth: domW,
    actualBoundingBoxLeft: measured.actualBoundingBoxLeft || 0,
    actualBoundingBoxRight: measured.actualBoundingBoxRight || measured.width || domW,
    actualBoundingBoxAscent: measured.actualBoundingBoxAscent || probe * 0.72,
    actualBoundingBoxDescent: measured.actualBoundingBoxDescent || probe * 0.12,
    fontBoundingBoxAscent: measured.fontBoundingBoxAscent || probe * 0.8,
    fontBoundingBoxDescent: measured.fontBoundingBoxDescent || probe * 0.2,
  };
  if (metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight < 1) {
    metrics.actualBoundingBoxLeft = 0;
    metrics.actualBoundingBoxRight = metrics.advanceWidth || domW;
  }
  const fitted = fitLine(metrics, targetWidth);
  const html = `<span style="position:relative;display:block;white-space:nowrap;line-height:1;top:${fitted.shiftTop}px;left:${fitted.shiftLeft}px">${escapeHtml(text)}</span>`;
  row.style.fontSize = `${fitted.fontSize}px`;
  row.style.height = `${fitted.height}px`;
  row.style.overflow = 'hidden';
  row.innerHTML = html;
  return { fontSize: fitted.fontSize, height: fitted.height, html };
}

function scaleAgainstFooter(root: HTMLElement, align: Align): { scale: number; origin: string } {
  const origin = align === 'center' ? 'top center' : align === 'right' ? 'top right' : 'top left';
  const stage = root.closest('[data-stage]') as HTMLElement | null;
  const footer = stage?.querySelector('[data-role="footer"]') as HTMLElement | null;
  if (!footer) return { scale: 1, origin };
  const natural = root.offsetHeight;
  const available = footer.offsetTop - 36 - root.offsetTop;
  if (available > 48 && natural > available) return { scale: available / natural, origin };
  return { scale: 1, origin };
}

function Footer({ node }: { node: FooterNode }) {
  const alignItems = node.align === 'center' ? 'center' : node.align === 'right' ? 'flex-end' : 'flex-start';
  const metaStyle = {
    ...fontCss(node.metaFont),
    fontSize: node.metaSize,
    lineHeight: node.metaLineHeight,
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
  return (
    <div
      style={{
        ...fontCss(node.message.font),
        fontSize: node.message.fontSize,
        lineHeight: node.message.lineHeight,
        maxWidth: node.message.maxWidth,
        marginBottom: node.arrangement === 'split' ? 0 : node.message.marginBottom,
        textAlign: node.align === 'right' && node.arrangement !== 'split' ? 'right' : node.align === 'center' ? 'center' : 'left',
      }}
    >
      {node.message.text}
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
    const available = root.clientHeight;
    const natural = inner.offsetHeight;
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
      <ShrinkText font={block.font} fontSize={block.fontSize} lineHeight={block.lineHeight} tracking={block.tracking} marginTop={block.marginTop}>
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
          lineHeight: block.lineHeight,
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
          lineHeight: block.lineHeight,
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
                lineHeight: block.lineHeight,
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
                lineHeight: block.lineHeight,
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
        lineHeight: block.lineHeight,
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
      }}
    >
      {node.text}
    </div>
  );
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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}
