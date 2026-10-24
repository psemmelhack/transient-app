import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { listTransients, type TransientRecord } from '../src/storage/library';
import { emptyLibrary } from '../src/ui/actions';
import { ink, muted, paper, uiFamily } from './theme';

export function MapScreen({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  const [records, setRecords] = useState<TransientRecord[]>([]);
  useEffect(() => {
    if (!active) return;
    listTransients().then(setRecords);
  }, [active]);
  return (
    <View style={{ flex: 1, backgroundColor: paper }}>
      <Pressable onPress={onBack} style={{ padding: 18 }}>
        <Text style={{ fontFamily: uiFamily, fontWeight: '500', fontSize: 16, color: ink }}>Back</Text>
      </Pressable>
      <Text style={{ fontFamily: uiFamily, fontWeight: '500', fontSize: 22, color: ink, paddingHorizontal: 18 }}>My transients</Text>
      <ScrollView>
        {records.length === 0 && <Text style={{ fontFamily: uiFamily, color: muted, padding: 18 }}>{emptyLibrary}</Text>}
        {records.map((record) => (
          <View key={record.id} style={{ paddingHorizontal: 18, paddingVertical: 12 }}>
            <Text style={{ fontFamily: uiFamily, fontWeight: '500', color: ink, fontSize: 16 }}>{record.message || 'No note'}</Text>
            <Text style={{ fontFamily: uiFamily, color: muted }}>{record.capturedAt}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
