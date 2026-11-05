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
    const head = 'data,treino,exercicio,serie,tipo,peso_kg,reps';
    const rows = workouts.flatMap((w) => w.entries.flatMap((e) => e.sets.map((s, i) => [fmtDate(w.date), w.title, exercises.find((x) => x.id === e.exerciseId)?.name ?? '', i + 1, s.type, s.kg ?? 0, s.reps ?? 0].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))));
    await Share.share({ title: 'Meus treinos', message: [head, ...rows].join('\n') });
  };
  return (
    <Screen>
      <Header title="Exportar e importar dados" />
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={{ color: colors.muted }}>Exporte todo o seu histórico ({workouts.length} treinos, unidade {profile.units.weight === 'kg' ? 'kg' : 'kg (convertida na tela)'}) em formato CSV.</Text>
        <Btn title="Exportar treinos (CSV)" icon="share-outline" onPress={exportCsv} testID="export-csv" />
        <Btn title="Importar dados" variant="secondary" icon="download-outline" onPress={() => setImp(true)} />
      </View>
      <Dialog visible={imp} title="Em breve" message="A importação de arquivos chega em uma próxima versão." actions={[{ label: 'Ok', primary: true, onPress: () => setImp(false) }]} />
    </Screen>
  );
}
