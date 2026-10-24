import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { listTransients, type TransientRecord } from '../src/storage/library';
import { ink, muted, paper, serif } from './theme';

export function MapScreen({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const [records, setRecords] = useState<TransientRecord[]>([]);
  useEffect(() => {
    if (!active) return;
    listTransients().then(setRecords);
  }, [active]);
  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      <Pressable onPress={onBack} style={{ padding: 18 }}>
        <Text style={{ fontFamily: serif, fontSize: 18, color: ink }}>Back</Text>
      </Pressable>
      <Text style={{ fontFamily: serif, fontSize: 28, color: ink, paddingHorizontal: 18 }}>My transients</Text>
      <ScrollView>
        {records.length === 0 && <Text style={{ color: muted, padding: 18 }}>Nothing saved yet.</Text>}
        {records.map((record) => (
          <View key={record.id} style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
            <Text style={{ color: ink, fontSize: 18 }}>{record.message || 'No note'}</Text>
            <Text style={{ color: muted }}>{record.capturedAt}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
