import { buildScene } from '../src/composition/scene';
import { exampleMoment, EXAMPLE_INSTANT } from '../src/data/moment';
import { presetById, styleFromPreset } from '../src/style/presets';
import { CompositionStage } from './CompositionStage';

/** Full-resolution preset, for visual comparison with the reference posters. */
export function Proof({ id }: { id: string }) {
  const preset = presetById(id);
  const style = styleFromPreset(preset);
  const moment = exampleMoment(EXAMPLE_INSTANT);
  const scene = buildScene(style, moment, preset.sampleMessage, EXAMPLE_INSTANT);
  return (
    <div style={{ height: '100%', overflow: 'auto', background: scene.background }}>
      <CompositionStage scene={scene} full />
    </div>
  );
}
