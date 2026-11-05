import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { Btn, Dialog, Header, Screen } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function ExportData() {
  const { workouts, exercises, profile } = useStore();
  const [imp, setImp] = useState(false);
  const exportCsv = async () => {
    const head = 'date,workout,exercise,set,type,weight_kg,reps';
    const rows = workouts.flatMap((w) => w.entries.flatMap((e) => e.sets.map((s, i) => [fmtDate(w.date), w.title, exercises.find((x) => x.id === e.exerciseId)?.name ?? '', i + 1, s.type, s.kg ?? 0, s.reps ?? 0].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))));
    await Share.share({ title: 'My workouts', message: [head, ...rows].join('\n') });
  };
  return (
    <Screen>
      <Header title="Export & Import Data" />
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={{ color: colors.muted }}>Export your entire history ({workouts.length} workouts, unit {profile.units.weight === 'kg' ? 'kg' : 'kg (converted on screen)'}) as a CSV file.</Text>
        <Btn title="Export workouts (CSV)" icon="share-outline" onPress={exportCsv} testID="export-csv" />
        <Btn title="Import data" variant="secondary" icon="download-outline" onPress={() => setImp(true)} />
      </View>
      <Dialog visible={imp} title="Coming soon" message="File import is coming in a future version." actions={[{ label: 'Ok', primary: true, onPress: () => setImp(false) }]} />
    </Screen>
  );
}
