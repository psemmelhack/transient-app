import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { capturePosterPng } from '../src/export/capturePoster';
import { buildScene } from '../src/composition/scene';
import { sunPosition } from '../src/data/solar';
import { dataLinePlugins, isMeasurementEnabled, isTelemetryEnabled } from '../src/data/plugins';
import { captureFileName } from '../src/export/download';
import { insertPngText, metadataFor } from '../src/export/pngMeta';
import { applyTelemetry, useTelemetry } from '../src/location/useTelemetry';
import { requestNativeTelemetryPermissions } from '../src/location/nativePermissions';
import { useMoment } from '../src/location/useMoment';
import { makeRecord, sharesForCapture } from '../src/storage/record';
import { saveTransient } from '../src/storage/library';
import { withMeasurement, withPreset } from '../src/style/edit';
import { PRESETS } from '../src/style/presets';
import { captureLabel, capturedToast } from '../src/ui/actions';
import { CompositionStage } from './CompositionStage';
import { useStyle } from './StyleContext';
import { ink, line, muted, paper, uiFamily } from './theme';

const NOTE_LIMIT = 200;

type CacheFile = {
  create(options?: { overwrite?: boolean }): void;
  write(content: Uint8Array): Promise<void>;
  uri: string;
};

export function MakeScreen({ onMap, fixture = false }: { onMap: () => void; fixture?: boolean }) {
  const { style, update } = useStyle();
  const { moment, now } = useMoment(fixture);
  const telemetryOn = isTelemetryEnabled(style.measurements);
  const telemetry = useTelemetry(telemetryOn);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const shown = useMemo(() => {
    if (!moment) return null;
    return applyTelemetry(moment, telemetryOn ? telemetry.sensors : null, telemetryOn ? telemetry.location : null);
  }, [moment, telemetry.sensors, telemetry.location, telemetryOn]);
  const scene = useMemo(() => buildScene(style, shown, note, shown?.at ?? now), [style, shown, note, now]);

  async function onToggle(id: string, next: boolean) {
    if (id === 'telemetry' && next) await requestNativeTelemetryPermissions();
    update(withMeasurement(style, id, next));
  }

  async function onSave() {
    if (!shown || working) return;
    setWorking(true);
    let produced = false;
    try {
      const shot = telemetry.capture();
      const frozen = applyTelemetry(shown, telemetryOn ? shot.sensors : null, telemetryOn ? shot.location : null);
      const sceneNow = buildScene(style, frozen, note, frozen.at);
      const raw = await capturePosterPng(sceneNow.width, sceneNow.height);
      produced = raw.byteLength > 0;
      const sun = sunPosition(frozen.at, frozen.latitude, frozen.longitude);
      const stamped = insertPngText(
        raw,
        metadataFor({
          latitude: frozen.latitude,
          longitude: frozen.longitude,
          altitude: frozen.altitude,
          accuracy: frozen.accuracy,
          utc: frozen.at.toISOString(),
          timezone: frozen.timezone,
          message: note,
          place: frozen.place?.full ?? null,
          temperatureC: frozen.temperatureC,
          sunAzimuth: sun.azimuth,
          sunAltitude: sun.altitude,
        }),
      );
      const filename = captureFileName(frozen.at, frozen.timezone);
      const file = cacheFile(filename);
      file.create({ overwrite: true });
      await file.write(stamped);
      const canShare = await Sharing.isAvailableAsync().catch(() => false);
      if (!canShare) throw new Error('share unavailable');
      await Sharing.shareAsync(file.uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: captureLabel });
      await saveTransient(
        makeRecord({
          moment: frozen,
          style,
          message: note,
          scene: sceneNow,
          png: new Blob([bytesForBlob(stamped)], { type: 'image/png' }),
          shares: sharesForCapture(''),
        }),
      );
      setNotice(capturedToast);
    } catch {
      setNotice(produced ? 'Couldn’t share the image' : 'Couldn’t make the image');
    } finally {
      setWorking(false);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: -8000, top: 0 }}>
        <CompositionStage scene={scene} full />
      </View>
      <ScrollView style={{ flex: 1, backgroundColor: paper }} contentContainerStyle={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: uiFamily, fontSize: 22, color: ink }}>Transient</Text>
          <Pressable onPress={onMap}>
            <Text style={{ fontFamily: uiFamily, color: ink }}>Map</Text>
          </Pressable>
        </View>
        <View style={{ marginTop: 16 }}>
          <CompositionStage scene={scene} />
        </View>
        <TextInput
          value={note}
          onChangeText={(value) => setNote(value.slice(0, NOTE_LIMIT))}
          placeholder="A note, if you want one"
          placeholderTextColor={muted}
          multiline
          style={{ marginTop: 16, borderBottomWidth: 1, borderBottomColor: line, fontFamily: uiFamily, fontSize: 17, color: ink, paddingVertical: 8 }}
        />
        <Pressable
          accessibilityLabel={captureLabel}
          disabled={working || !shown}
          onPress={() => void onSave()}
          style={{ marginTop: 12, minHeight: 44, justifyContent: 'center', opacity: working || !shown ? 0.4 : 1 }}
        >
          <Text style={{ fontFamily: uiFamily, fontSize: 14, color: ink }}>{captureLabel}</Text>
        </Pressable>
        {notice ? <Text style={{ fontFamily: uiFamily, color: muted, marginTop: 8 }}>{notice}</Text> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {PRESETS.map((preset) => (
            <Pressable key={preset.id} onPress={() => update(withPreset(style, preset))} style={{ padding: 8 }}>
              <Text style={{ fontFamily: uiFamily, color: style.presetId === preset.id ? ink : muted }}>{preset.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {dataLinePlugins.filter((plugin) => plugin.toggle).map((plugin) => {
            const on = isMeasurementEnabled(style.measurements, plugin);
            return (
              <Pressable key={plugin.id} onPress={() => void onToggle(plugin.id, !on)} style={{ padding: 8 }}>
                <Text style={{ fontFamily: uiFamily, color: on ? ink : muted }}>{plugin.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function cacheFile(filename: string): CacheFile {
  const FileCtor = FileSystem.File as unknown as new (directory: unknown, name: string) => CacheFile;
  return new FileCtor(FileSystem.Paths.cache, filename);
}

function bytesForBlob(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}
