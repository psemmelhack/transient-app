import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { buildScene } from '../src/composition/scene';
import { useMoment } from '../src/location/useMoment';
import { PRESETS } from '../src/style/presets';
import { withPreset } from '../src/style/edit';
import { CompositionStage } from './CompositionStage';
import { useStyle } from './StyleContext';
import { ink, line, muted, paper, uiFamily } from './theme';

export function MakeScreen({ onMap, fixture = false }: { onMap: () => void; fixture?: boolean }) {
  const { style, update } = useStyle();
  const { moment, now } = useMoment(fixture);
  const [note, setNote] = useState('');
  const scene = useMemo(() => buildScene(style, moment, note, moment?.at ?? now), [style, moment, note, now]);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: paper }} contentContainerStyle={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: uiFamily, fontWeight: '500', fontSize: 22, color: ink }}>Transient</Text>
        <Pressable onPress={onMap}>
          <Text style={{ fontFamily: uiFamily, fontWeight: '500', color: ink }}>Map</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 16 }}>
        <CompositionStage scene={scene} />
      </View>
      <TextInput
        value={note}
        onChangeText={(value) => setNote(value.slice(0, 200))}
        placeholder="A note, if you want one"
        multiline
        style={{ marginTop: 16, borderBottomWidth: 1, borderBottomColor: line, fontFamily: uiFamily, fontSize: 17, color: ink, paddingVertical: 8 }}
      />
      <Text style={{ fontFamily: uiFamily, color: muted, marginTop: 12 }}>Saving the image runs in the browser.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {PRESETS.map((preset) => (
          <Pressable key={preset.id} onPress={() => update(withPreset(style, preset))} style={{ padding: 8 }}>
            <Text style={{ color: style.presetId === preset.id ? ink : muted }}>{preset.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
