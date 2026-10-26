import { useEffect, useRef, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import type { CssFont } from '../src/composition/fonts';
import { heroScaleToClear } from '../src/composition/heroClearance';
import { nativeFontFamily } from '../src/composition/nativeFonts';
import { noteRhythm, wrapNote } from '../src/composition/note';
import { bindPoster } from '../src/export/capturePoster';
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
  TelemetryBlock,
} from '../src/composition/scene';

interface Props {
  scene: Scene;
  /** Draw at export pixels, with no preview scale. Capture uses this copy. */
  full?: boolean;
}

export function CompositionStage({ scene, full }: Props) {
  const [frameWidth, setFrameWidth] = useState(0);
  const [heroScale, setHeroScale] = useState(1);
  const metrics = useRef({ heroTop: 0, heroHeight: 0, footerTop: 0, locked: false });
  const preview = !full && frameWidth > 0 ? frameWidth / scene.width : 1;
  const signature = scene.nodes.map((node, index) => nodeKey(node, index)).join('~');

  useEffect(() => {
    metrics.current = { heroTop: 0, heroHeight: 0, footerTop: 0, locked: false };
    setHeroScale(1);
  }, [signature]);

  function commitScale() {
    const current = metrics.current;
    if (current.locked || current.heroHeight <= 0 || current.footerTop <= 0) return;
    current.locked = true;
    setHeroScale(heroScaleToClear(current.heroTop, current.heroHeight, current.footerTop));
  }

  function noteHero(top: number, height: number) {
    metrics.current.heroTop = top;
    metrics.current.heroHeight = height;
    commitScale();
  }

  function noteFooter(top: number) {
    metrics.current.footerTop = top;
    commitScale();
  }

  const stage = (
    <View
      ref={full ? bindPoster : undefined}
      collapsable={false}
      style={{ width: scene.width, height: scene.height, backgroundColor: scene.background, overflow: 'hidden' }}
    >
      {scene.nodes.map((node, index) => (
        <NodeView
          key={nodeKey(node, index)}
          node={node}
          sceneWidth={scene.width}
          sceneHeight={scene.height}
          heroScale={heroScale}
          onHero={noteHero}
          onFooter={noteFooter}
        />
      ))}
    </View>
  );

  if (full) return stage;

  return (
    <View
      style={{ width: '100%', aspectRatio: scene.width / scene.height, overflow: 'hidden', backgroundColor: scene.background }}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0) setFrameWidth(width);
      }}
    >
      <View style={{ width: scene.width, height: scene.height, transform: [{ scale: preview }], transformOrigin: 'top left' }}>{stage}</View>
    </View>
  );
}

function nodeKey(node: SceneNode, index: number): string {
  if (node.kind === 'fit-stack') return `fit-${node.lines.join('|')}-${node.font.family}`;
  if (node.kind === 'footer') return `foot-${node.metaLines.join('|')}-${node.message?.text ?? ''}`;
  return `${node.kind}-${index}`;
}

function NodeView({
  node,
  sceneWidth,
  sceneHeight,
  heroScale,
  onHero,
  onFooter,
}: {
  node: SceneNode;
  sceneWidth: number;
  sceneHeight: number;
  heroScale: number;
  onHero: (top: number, height: number) => void;
  onFooter: (top: number) => void;
}) {
  switch (node.kind) {
    case 'fit-stack':
      return <FitStack node={node} sceneWidth={sceneWidth} scale={heroScale} onHero={onHero} />;
    case 'footer':
      return <Footer node={node} sceneWidth={sceneWidth} onFooter={onFooter} />;
    case 'quiet':
      return <Quiet node={node} sceneWidth={sceneWidth} sceneHeight={sceneHeight} />;
    case 'mark':
      return <Mark node={node} />;
    case 'kicker':
      return <Kicker node={node} sceneWidth={sceneWidth} />;
    case 'header-split':
      return <HeaderSplit node={node} />;
    case 'placeholder':
      return <Placeholder node={node} />;
    default:
      return null;
  }
}

function typeStyle(font: CssFont, fontSize: number, tracking?: number): TextStyle {
  return {
    fontFamily: nativeFontFamily(font),
    fontSize,
    letterSpacing: tracking ? tracking * fontSize : undefined,
    color: undefined,
  };
}

function alignItems(align: Align): 'flex-start' | 'center' | 'flex-end' {
  if (align === 'center') return 'center';
  if (align === 'right') return 'flex-end';
  return 'flex-start';
}

function FitStack({
  node,
  sceneWidth,
  scale,
  onHero,
}: {
  node: FitStackNode;
  sceneWidth: number;
  scale: number;
  onHero: (top: number, height: number) => void;
}) {
  const width = Math.max(1, sceneWidth - node.left - node.right);
  const [natural, setNatural] = useState<Record<number, number>>({});
  const settled = node.lines.every((_, index) => natural[index] != null);
  return (
    <View
      style={{ position: 'absolute', left: node.left, right: node.right, top: node.top, gap: node.gap * scale }}
      onLayout={(event) => {
        if (!settled) return;
        onHero(event.nativeEvent.layout.y, event.nativeEvent.layout.height);
      }}
    >
      {node.lines.map((line, index) => (
        <FittedLine
          key={`${index}-${line}`}
          text={line}
          width={width}
          font={node.font}
          color={node.color}
          align={node.align}
          leading={node.leading}
          scale={scale}
          natural={natural[index] ?? null}
          onNatural={(measured) => setNatural((prev) => (prev[index] === measured ? prev : { ...prev, [index]: measured }))}
        />
      ))}
    </View>
  );
}

function FittedLine({
  text,
  width,
  font,
  color,
  align,
  leading,
  scale,
  natural,
  onNatural,
}: {
  text: string;
  width: number;
  font: CssFont;
  color: string;
  align: Align;
  leading: number;
  scale: number;
  natural: number | null;
  onNatural: (width: number) => void;
}) {
  const probe = 24;
  const fitted = natural && natural > 0 ? Math.max(12, (probe * width) / natural) : probe;
  const fontSize = fitted * (scale > 0 ? scale : 1);
  return (
    <View style={{ width, height: fontSize * leading, overflow: 'hidden', justifyContent: 'flex-end' }}>
      {natural == null && (
        <View pointerEvents="none" style={{ position: 'absolute', width: 8000, left: 0, top: 0 }}>
          <Text
            style={{ ...typeStyle(font, probe), color, alignSelf: 'flex-start' }}
            onTextLayout={(event) => {
              const measured = event.nativeEvent.lines[0]?.width ?? 0;
              if (measured > 0) onNatural(measured);
            }}
          >
            {text}
          </Text>
        </View>
      )}
      <Text numberOfLines={1} style={{ ...typeStyle(font, fontSize), color, textAlign: align, width, lineHeight: fontSize * leading }}>
        {text}
      </Text>
    </View>
  );
}

function Footer({ node, sceneWidth, onFooter }: { node: FooterNode; sceneWidth: number; onFooter: (top: number) => void }) {
  const meta: TextStyle = {
    ...typeStyle(node.metaFont, node.metaSize, node.metaTracking),
    color: node.color,
    opacity: node.metaOpacity,
    lineHeight: node.metaSize * safeLeading(node.metaLineHeight, 1.45),
    textAlign: node.align,
  };
  return (
    <View
      style={{ position: 'absolute', left: node.left, right: node.right, bottom: node.bottom }}
      onLayout={(event) => onFooter(event.nativeEvent.layout.y)}
    >
      {node.arrangement === 'split' ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 28 }}>
          <View style={{ flexShrink: 1 }}>{node.metaLines.map((line) => <Text key={line} style={meta}>{line}</Text>)}</View>
          {node.message && <Message node={node} sceneWidth={sceneWidth} />}
        </View>
      ) : node.arrangement === 'message-then-split' ? (
        <View>
          {node.message && <Message node={node} sceneWidth={sceneWidth} />}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
            <Text style={meta}>{node.splitLeft}</Text>
            <Text style={[meta, { textAlign: 'right' }]}>{node.splitRight}</Text>
          </View>
        </View>
      ) : (
        <View style={{ alignItems: alignItems(node.align) }}>
          {node.message && <Message node={node} sceneWidth={sceneWidth} />}
          {node.metaLines.map((line) => (
            <Text key={line} style={meta}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {node.extraLines.length > 0 && (
        <View style={{ marginTop: 10 }}>
          {node.extraLines.map((line) => (
            <Text key={line} style={meta}>
              {line}
            </Text>
          ))}
        </View>
      )}
      {node.telemetry && (
        <View style={{ marginTop: 12, alignItems: alignItems(node.align) }}>
          <TelemetryTable block={node.telemetry} color={node.color} />
        </View>
      )}
      {node.mark && (
        <Text
          style={{
            ...typeStyle(node.mark.font, node.mark.fontSize, node.mark.tracking),
            color: node.color,
            opacity: node.mark.opacity,
            marginTop: node.mark.marginTop,
            textAlign: node.align,
          }}
        >
          {node.mark.text}
        </Text>
      )}
    </View>
  );
}

function Message({ node, sceneWidth }: { node: FooterNode; sceneWidth: number }) {
  if (!node.message) return null;
  const align: Align = node.align === 'center' ? 'center' : node.align === 'right' && node.arrangement !== 'split' ? 'right' : 'left';
  const maxWidth = node.message.maxWidth ?? sceneWidth;
  const lines = wrapNote(node.message.text, node.message.fontSize, maxWidth, noteRhythm(node.message.font.family));
  return (
    <View
      style={{
        width: maxWidth,
        maxWidth: '100%',
        marginBottom: node.arrangement === 'split' ? 0 : node.message.marginBottom,
        alignSelf: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {lines.map((line, index) => (
        <Text
          key={`${index}-${line}`}
          style={{
            ...typeStyle(node.message!.font, node.message!.fontSize),
            color: node.color,
            lineHeight: node.message!.fontSize * safeLeading(node.message!.lineHeight, 1.4),
            textAlign: align,
          }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

function Quiet({ node, sceneWidth, sceneHeight }: { node: QuietNode; sceneWidth: number; sceneHeight: number }) {
  const boxHeight = Math.max(1, sceneHeight - node.top - node.bottom);
  const [contentHeight, setContentHeight] = useState(0);
  const scale = contentHeight > boxHeight ? boxHeight / contentHeight : 1;
  return (
    <View
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        top: node.top,
        bottom: node.bottom,
        justifyContent: node.anchor === 'center' ? 'center' : 'flex-end',
        alignItems: alignItems(node.align),
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: '100%',
          alignItems: alignItems(node.align),
          transform: scale < 0.999 ? [{ scale }] : undefined,
          transformOrigin: node.anchor === 'end' ? 'bottom left' : 'top left',
        }}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height > 0 && contentHeight === 0) setContentHeight(height);
        }}
      >
        {node.blocks.map((block, index) => (
          <QuietPiece key={index} block={block} align={node.align} sceneWidth={sceneWidth} color={node.color} />
        ))}
      </View>
    </View>
  );
}

function QuietPiece({ block, align, sceneWidth, color }: { block: QuietBlock; align: Align; sceneWidth: number; color: string }) {
  if (block.kind === 'rule') {
    return (
      <View
        style={{
          width: block.width,
          height: block.height,
          backgroundColor: block.color,
          marginTop: block.marginTop,
          marginBottom: block.marginBottom,
          alignSelf: alignItems(align),
        }}
      />
    );
  }
  if (block.kind === 'coords') {
    return (
      <View style={{ marginTop: block.marginTop, alignSelf: alignItems(align) }}>
        {block.lines.map((line) => (
          <Text key={`${line.value}${line.suffix ?? ''}`} style={{ ...typeStyle(block.font, block.fontSize, block.tracking), color, lineHeight: block.fontSize * safeLeading(block.lineHeight, 1.15), textAlign: align }}>
            {line.value}
            {line.degree ? <Text style={{ fontSize: block.fontSize * 0.6 }}>°</Text> : null}
            {line.suffix ? ` ${line.suffix}` : ''}
          </Text>
        ))}
      </View>
    );
  }
  if (block.kind === 'rich-time') {
    return (
      <Text style={{ ...typeStyle(block.font, block.fontSize), color, marginTop: block.marginTop, lineHeight: block.fontSize * safeLeading(block.lineHeight, 1.2), textAlign: align }}>
        <Text style={typeStyle(block.italicFont, block.fontSize)}>{block.weekday}</Text> {block.date}
        {'\n'}
        {block.spoken}
      </Text>
    );
  }
  if (block.kind === 'meta') {
    return (
      <View style={{ marginTop: block.marginTop }}>
        {block.lines.map((line) => (
          <Text key={line} style={{ ...typeStyle(block.font, block.fontSize, block.tracking), color, opacity: block.opacity, lineHeight: block.fontSize * safeLeading(block.lineHeight, 1.45), textAlign: align }}>
            {line}
          </Text>
        ))}
      </View>
    );
  }
  if (block.kind === 'telemetry') {
    return (
      <View style={{ marginTop: block.marginTop, alignItems: alignItems(align), width: '100%' }}>
        <TelemetryTable block={block} color={color} />
      </View>
    );
  }
  if (block.kind === 'note') {
    const lines = wrapNote(block.text, block.fontSize, block.maxWidth, noteRhythm(block.font.family));
    return (
      <View style={{ width: '100%', marginTop: block.marginTop, borderTopWidth: 1, borderTopColor: block.color, paddingTop: 10 }}>
        <Text style={{ ...typeStyle(block.labelFont, block.labelSize, block.tracking), color: block.color, textTransform: 'uppercase' }}>{block.label}</Text>
        <View style={{ marginTop: 8, width: block.maxWidth }}>
          {lines.map((line, index) => (
            <Text key={`${index}-${line}`} style={{ ...typeStyle(block.font, block.fontSize), color: block.color, lineHeight: block.fontSize * safeLeading(block.lineHeight) }}>
              {line}
            </Text>
          ))}
        </View>
      </View>
    );
  }
  if (block.kind === 'text' && block.wrap) {
    const maxWidth = block.maxWidth ?? sceneWidth;
    const lines = wrapNote(block.text, block.fontSize, maxWidth, noteRhythm(block.font.family));
    return (
      <View style={{ marginTop: block.marginTop, width: maxWidth, alignSelf: alignItems(align), opacity: block.opacity }}>
        {lines.map((line, index) => (
          <Text key={`${index}-${line}`} style={{ ...typeStyle(block.font, block.fontSize), color, textAlign: align, lineHeight: block.fontSize * safeLeading(block.lineHeight) }}>
            {line}
          </Text>
        ))}
      </View>
    );
  }
  if (block.kind === 'rows') {
    return (
      <View style={{ width: '100%', marginTop: block.marginTop }}>
        {block.rows.map((row) => (
          <View
            key={row.label}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 28,
              paddingTop: block.gap,
              paddingBottom: block.gap,
              borderBottomWidth: block.hairline ? 1 : 0,
              borderBottomColor: block.color,
            }}
          >
            <Text style={{ ...typeStyle(block.labelFont, block.labelSize, block.tracking), color, textTransform: 'uppercase' }}>{row.label}</Text>
            <Text style={{ ...typeStyle(block.valueFont, block.valueSize), color, textAlign: 'right', flexShrink: 1 }}>{row.value}</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.4}
      style={{
        ...typeStyle(block.font, block.fontSize, block.tracking),
        color,
        marginTop: block.marginTop,
        opacity: block.opacity,
        lineHeight: block.fontSize * safeLeading(block.lineHeight),
        textAlign: align,
        maxWidth: block.maxWidth,
      }}
    >
      {block.text}
    </Text>
  );
}

function TelemetryTable({ block, color }: { block: TelemetryBlock | Extract<QuietBlock, { kind: 'telemetry' }>; color?: string }) {
  const fontSize = block.fontSize;
  return (
    <View style={{ opacity: block.opacity }}>
      {block.lines.map((line) => (
        <View key={line.id} style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ ...typeStyle(block.font, fontSize, 0.12), color, width: fontSize * 5.8, lineHeight: fontSize * safeLeading(block.lineHeight) }}>{line.label}</Text>
          {line.values.length === 1 ? (
            <Text style={{ ...typeStyle(block.font, fontSize), color, width: fontSize * 13.5, textAlign: 'right', lineHeight: fontSize * safeLeading(block.lineHeight) }}>{line.values[0]}</Text>
          ) : (
            line.values.map((value, index) => (
              <Text key={index} style={{ ...typeStyle(block.font, fontSize), color, width: fontSize * 4.5, textAlign: 'right', lineHeight: fontSize * safeLeading(block.lineHeight) }}>
                {value}
              </Text>
            ))
          )}
        </View>
      ))}
    </View>
  );
}

function Mark({ node }: { node: MarkNode }) {
  return (
    <Text
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        bottom: node.bottom,
        ...typeStyle(node.font, node.fontSize, node.tracking),
        color: node.color,
        opacity: node.opacity,
        textAlign: node.align,
      }}
    >
      {node.text}
    </Text>
  );
}

function Kicker({ node, sceneWidth }: { node: KickerNode; sceneWidth: number }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.4}
      style={{
        position: 'absolute',
        left: node.left,
        right: node.right,
        top: node.top,
        ...typeStyle(node.font, node.fontSize, node.tracking),
        color: node.color,
        textAlign: node.align,
        width: Math.max(1, sceneWidth - node.left - node.right),
      }}
    >
      {node.text}
    </Text>
  );
}

function HeaderSplit({ node }: { node: HeaderSplitNode }) {
  const style = { ...typeStyle(node.font, node.fontSize, node.tracking), color: node.color };
  return (
    <View style={{ position: 'absolute', left: node.left, right: node.right, top: node.top, flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text style={style}>{node.leftText}</Text>
      <Text style={style}>{node.rightText}</Text>
    </View>
  );
}

function Placeholder({ node }: { node: PlaceholderNode }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <Text style={{ ...typeStyle(node.font, 28), color: node.color, textAlign: 'center' }}>{node.text}</Text>
      {node.sub ? <Text style={{ ...typeStyle(node.subFont, 16), color: node.color, marginTop: 12, textAlign: 'center' }}>{node.sub}</Text> : null}
    </View>
  );
}

function safeLeading(value: number, fallback = 1.2): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}
