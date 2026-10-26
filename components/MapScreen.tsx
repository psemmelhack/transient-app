import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { listTransients, type TransientRecord } from '../src/storage/library';
import { emptyLibrary, libraryShareLabel } from '../src/ui/actions';
import { ink, muted, paper, uiFamily } from './theme';

export function MapScreen({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const [records, setRecords] = useState<TransientRecord[]>([]);
  const [uris, setUris] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    listTransients().then(async (next) => {
      if (cancelled) return;
      setRecords(next);
      const images: Record<string, string> = {};
      for (const record of next) {
        try {
          images[record.id] = await pngUri(record.png);
        } catch {
          /* A record without a readable picture still stays in the list. */
        }
      }
      if (!cancelled) setUris(images);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const first = records.find((record) => Number.isFinite(record.latitude) && Number.isFinite(record.longitude));
  const region = first
    ? { latitude: first.latitude, longitude: first.longitude, latitudeDelta: 0.4, longitudeDelta: 0.4 }
    : { latitude: 37.8, longitude: -122.4, latitudeDelta: 8, longitudeDelta: 8 };

  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      <Pressable onPress={onBack} style={{ padding: 18 }}>
        <Text style={{ fontFamily: uiFamily, fontSize: 16, color: ink }}>Back</Text>
      </Pressable>
      <Text style={{ fontFamily: uiFamily, fontSize: 22, color: ink, paddingHorizontal: 18 }}>My transients</Text>
      <MapView style={{ height: 280, marginTop: 12 }} initialRegion={region}>
        {records.map((record) =>
          Number.isFinite(record.latitude) && Number.isFinite(record.longitude) ? (
            <Marker key={record.id} coordinate={{ latitude: record.latitude, longitude: record.longitude }} title={record.message || 'Transient'} />
          ) : null,
        )}
      </MapView>
      <ScrollView>
        {records.length === 0 && <Text style={{ fontFamily: uiFamily, color: muted, padding: 18 }}>{emptyLibrary}</Text>}
        {records.map((record) => (
          <View key={record.id} style={{ paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', gap: 12 }}>
            {uris[record.id] ? <Image source={{ uri: uris[record.id] }} style={{ width: 72, height: 72 }} /> : <View style={{ width: 72, height: 72 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: uiFamily, color: ink, fontSize: 16 }}>{record.message || 'No note'}</Text>
              <Text style={{ fontFamily: uiFamily, color: muted }}>{record.placeCity || record.placeFull || record.capturedAt}</Text>
              <Text style={{ fontFamily: uiFamily, color: muted }}>{libraryShareLabel(record.shares)}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

async function pngUri(png: Blob): Promise<string> {
  const bytes = new Uint8Array(await png.arrayBuffer());
  let binary = '';
  const size = 4096;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return `data:image/png;base64,${globalThis.btoa(binary)}`;
}
