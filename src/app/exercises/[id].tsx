import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { CAT_BY_ID } from '../../lib/catalog';
import { Btn, Card, Dialog, Header, IconButton, LineChart, ListRow, PillRow, Screen, Section, Sheet, TopTabs } from '../../components/ui';
import { fmtDate, fmtWeight, toDisplayWeight } from '../../lib/format';
import { exerciseSeries, records } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

const METRICS = [{ id: 'heaviest', label: 'Maior peso' }, { id: 'orm', label: '1RM estimado' }, { id: 'setVolume', label: 'Volume da série' }, { id: 'sessionVolume', label: 'Volume da sessão' }, { id: 'reps', label: 'Reps' }];
const LEVELS = ['Iniciante', 'Intermediário', 'Avançado', 'Elite'];
const HOWTO = ['Posicione-se com a postura neutra e o abdômen firme.', 'Execute o movimento de forma controlada, sem usar impulso.', 'Respire: expire no esforço, inspire na volta.', 'Escolha uma carga que permita completar todas as repetições com boa técnica.'];

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allExercises: exercises, workouts, profile, removeExercise } = useStore();
  const [tab, setTab] = useState('summary');
  const [metric, setMetric] = useState('heaviest');
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  const ex = exercises.find((e) => e.id === id);
  if (!ex) return <Screen><Header title="Exercício" /></Screen>;
  const cat = ex.catalogId ? CAT_BY_ID.get(ex.catalogId) : undefined;
  const u = profile.units;
  const rec = records(workouts, ex.id);
  const series = exerciseSeries(workouts, ex.id, metric as never).map((p) => ({ label: fmtDate(p.date, { day: '2-digit', month: '2-digit' }), value: metric === 'reps' ? p.value : Math.round(toDisplayWeight(p.value, u) * 10) / 10 }));
  const sessions = workouts.filter((w) => w.entries.some((e) => e.exerciseId === ex.id));
  const missing = [profile.sex, profile.birthYear, profile.weightKg].filter((x) => !x).length;
  const ratio = profile.weightKg ? rec.best1rm / profile.weightKg : 0;
  const lvl = ratio >= 2 ? 3 : ratio >= 1.5 ? 2 : ratio >= 0.75 ? 1 : 0;

  return (
    <Screen>
      <Header title={ex.name} right={<><IconButton name="share-outline" onPress={() => Share.share({ message: `${ex.name} no Reps` })} /><IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} /></>} />
      <TopTabs value={tab} onChange={setTab} items={[{ id: 'summary', label: 'Resumo' }, { id: 'history', label: 'Histórico' }, { id: 'how', label: 'Como fazer' }, { id: 'rank', label: 'Ranking' }]} />
      <ScrollView>
        {tab === 'summary' && (
          <View>
            <View style={{ padding: 16 }}>{series.length ? <LineChart data={series} unit={metric === 'reps' ? '' : ` ${u.weight}`} /> : <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>Sem dados ainda</Text>}</View>
            <PillRow items={METRICS} value={metric} onChange={setMetric} />
            <Section title="Recordes pessoais" />
            <ListRow label="Maior peso" detail={rec.heaviest ? fmtWeight(rec.heaviest, u) : '-'} last />
            <ListRow label="Melhor 1RM" detail={rec.best1rm ? fmtWeight(rec.best1rm, u) : '-'} last />
            <ListRow label="Melhor volume de série" detail={rec.bestSet ? `${fmtWeight(rec.bestSet.kg ?? 0, u)} × ${rec.bestSet.reps}` : '-'} last />
            <ListRow label="Melhor volume de sessão" detail={rec.bestSession ? fmtWeight(rec.bestSession, u) : '-'} last />
            <Section title="Nível de força" />
            {missing > 0 || !rec.best1rm ? (
              <View style={{ padding: 16 }}>
                <Card onPress={() => router.push('/profile/edit')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 0 }}>
                  <Text style={{ borderWidth: 3, borderColor: colors.border, borderRadius: 24, width: 48, height: 48, textAlign: 'center', textAlignVertical: 'center', lineHeight: 42, color: colors.muted }}>{3 - missing}/3</Text>
                  <Text style={{ flex: 1, color: colors.text }}>{missing > 0 ? 'Informe sexo, idade e peso para ver seu nível de força.' : 'Registre uma série com carga para ver seu nível de força.'}</Text>
                </Card>
              </View>
            ) : (
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Melhor 1RM{'\n'}<Text style={{ color: colors.text, fontSize: 16 }}>{fmtWeight(rec.best1rm, u)}</Text></Text><Text style={{ color: colors.muted, textAlign: 'right' }}>Nível{'\n'}<Text style={{ color: colors.text, fontSize: 16 }}>{LEVELS[lvl]}</Text></Text></View>
                <View style={{ flexDirection: 'row', gap: 3 }}>{LEVELS.map((l, k) => <View key={l} style={{ flex: 1, height: 6, backgroundColor: k <= lvl ? colors.primary : colors.surfaceAlt }} />)}</View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{LEVELS.map((l) => <Text key={l} style={{ color: colors.muted, fontSize: 11 }}>{l}</Text>)}</View>
              </View>
            )}
          </View>
        )}
        {tab === 'history' && (
          <View>
            {sessions.length === 0 && <Text style={{ color: colors.muted, textAlign: 'center', padding: 30 }}>Você ainda não fez este exercício.</Text>}
            {sessions.map((w) => (
              <View key={w.id} style={{ padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} style={{ color: colors.primary, fontWeight: '600' }}>{w.title} · {fmtDate(w.date)}</Text>
                {w.entries.find((e) => e.exerciseId === ex.id)!.sets.map((s, i) => <Text key={i} style={{ color: colors.text }}>{i + 1}. {fmtWeight(s.kg ?? 0, u)} × {s.reps}</Text>)}
              </View>
            ))}
          </View>
        )}
        {tab === 'how' && (
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: colors.muted }}>{ex.muscle} · {ex.equipment}</Text>
            {cat && <Text style={{ color: colors.text }}>Alvo: <Text style={{ fontWeight: '600' }}>{cat.t}</Text>{cat.s.length ? `\nSecundários: ${cat.s.join(', ')}` : ''}</Text>}
            {(cat ? cat.i : HOWTO).map((t, i) => <Text key={i} style={{ color: colors.text, fontSize: 16 }}>{i + 1}. {t}</Text>)}
          </View>
        )}
        {tab === 'rank' && (
          <View style={{ padding: 24, gap: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>O ranking compara você com quem você segue. Siga amigos para ver a classificação neste exercício.</Text>
            <Btn title="Descobrir atletas" variant="secondary" onPress={() => router.push('/feed/discover')} />
          </View>
        )}
      </ScrollView>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        {ex.id.startsWith('cat:') ? <ListRow icon="information-circle-outline" label="Exercício do catálogo (não pode ser excluído)" last /> : <ListRow icon="trash-outline" label="Excluir exercício" danger last onPress={() => { setMenu(false); setDel(true); }} />}
      </Sheet>
      <Dialog visible={del} title="Excluir exercício?" message="Ele também será removido dos treinos e rotinas onde aparece." onClose={() => setDel(false)}
        actions={[{ label: 'Cancelar' }, { label: 'Excluir', danger: true, onPress: async () => { setDel(false); await removeExercise(ex.id); router.back(); } }]} />
    </Screen>
  );
}
