import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

export default function ExportData() {
  const { workouts, exercises, routines, measurements, profile, showToast, findExercise } = useStore();
  const [busy, setBusy] = useState(false);
  /** Grava o arquivo no aparelho e abre a folha de compartilhar (salvar em Arquivos, e-mail, etc.). Pesos sempre em kg. */
  const share = async (name: string, text: string, mime: string) => {
    setBusy(true);
    try {
      const uri = `${FileSystem.cacheDirectory}${name}`;
      await FileSystem.writeAsStringAsync(uri, text);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
      else showToast('Sharing is not available on this device.');
    } catch { showToast('Could not create the file.'); }
    setBusy(false);
  };
  const exportCsv = () => {
    // findExercise aceita id real e `cat:<id>` (treinos da fila offline ainda guardam o id do catálogo)
    const rows: (string | number)[][] = [['date', 'workout', 'exercise', 'set', 'type', 'weight_kg', 'reps', 'duration_sec', 'distance_m']];
    workouts.forEach((w) => w.entries.forEach((e) => e.sets.forEach((s, i) => rows.push([fmtDate(w.date), w.title, findExercise(e.exerciseId)?.name ?? '', i + 1, s.type, s.kg ?? 0, s.reps ?? 0, s.seconds ?? '', s.distM ?? '']))));
    return share('reps-workouts.csv', csv(rows), 'text/csv');
  };
  const exportAll = () => share('reps-data.json', JSON.stringify({ exportedAt: new Date().toISOString(), profile, workouts, routines, measurements, exercises: exercises.map((e) => ({ id: e.id, name: e.name, muscle: e.muscle, equipment: e.equipment, kind: e.kind })) }, null, 2), 'application/json');
  return (
    <Screen>
      <Header title="Export Data" />
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={{ color: colors.muted }}>Your data is yours. Weights are exported in kg.</Text>
        <Btn title={`Workouts (CSV, ${workouts.length})`} icon="share-outline" onPress={exportCsv} loading={busy} testID="export-csv" />
        <Btn title="Everything (JSON)" variant="secondary" icon="download-outline" onPress={exportAll} loading={busy} testID="export-json" />
      </View>
    </Screen>
  );
}
