import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { buildScene } from '../src/composition/scene';
import { fileNameFor } from '../src/export/download';
import { savePngToPhotos } from '../src/export/photoLibrary';
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
  const [notice, setNotice] = useState('Saving the image runs in the browser.');
  const scene = useMemo(() => buildScene(style, moment, note, moment?.at ?? now), [style, moment, note, now]);

  async function onSave() {
    if (!moment) return;
    const png = await captureNativePoster();
    if (!png) {
      setNotice('Saving the image runs in the browser.');
      return;
    }
    const result = await savePngToPhotos(fileNameFor(moment.at, moment.latitude, moment.longitude), png);
    if (result === 'saved') setNotice('Saved to Photos');
    else if (result === 'denied') setNotice('Photo access is off.');
    else setNotice('Saving the image runs in the browser.');
  }
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
      <Pressable onPress={() => void onSave()} style={{ marginTop: 12 }}>
        <Text style={{ fontFamily: uiFamily, fontWeight: '500', color: ink }}>Save</Text>
      </Pressable>
      <Text style={{ fontFamily: uiFamily, color: muted, marginTop: 8 }}>{notice}</Text>
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

/** The native preview is not the export PNG. Web renders that image; this is the Photos write once bytes exist. */
async function captureNativePoster(): Promise<Uint8Array | null> {
  return null;
}
