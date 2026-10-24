import { Text, View } from 'react-native';
import type { Scene } from '../src/composition/scene';

/** Native preview. The web target renders the real type; this keeps the screen legible. */
export function CompositionStage({ scene }: { scene: Scene; full?: boolean }) {
  const lines = scene.nodes.flatMap((node) => {
    if (node.kind === 'fit-stack') return node.lines;
    if (node.kind === 'placeholder') return [node.text, node.sub ?? ''];
    if (node.kind === 'footer') return [...(node.message ? [node.message.text] : []), ...node.metaLines];
    return [];
  });
  return (
    <View style={{ width: '100%', aspectRatio: scene.width / scene.height, backgroundColor: scene.background, padding: 16, justifyContent: 'center' }}>
      {lines.slice(0, 8).map((line) => (
        <Text key={line} style={{ color: '#111', fontSize: 18 }}>
          {line}
        </Text>
      ))}
    </View>
  );
}
