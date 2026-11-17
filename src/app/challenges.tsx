import { Ionicons } from '@expo/vector-icons';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { Header, Screen } from '../components/ui';
import { challengeDesc, challengeViews, fmtProgress, useChallenges, type ChallengeView } from '../lib/challenges';
import { tr } from '../lib/i18n';
import { useStore } from '../lib/store';
import { colors, radius } from '../lib/theme';

/** Desafios automáticos: todos sempre valendo na semana/mês atual, contados dos treinos salvos. */
export default function Challenges() {
  const st = useStore();
  const s = useChallenges(st.session?.user.id ?? null);
  const units = st.profile.units;
  const views = challengeViews(s, st.workouts, units);
  const trophies = views.reduce((a, v) => a + v.wins + (v.status === 'done' ? 1 : 0), 0);
  const groups: [string, ChallengeView[]][] = [
    ['In progress', views.filter((v) => v.status === 'active')],
    ['Completed', views.filter((v) => v.status === 'done')],
  ];

  return (
    <Screen>
      <Header title="Challenges" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }} testID="challenges">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14 }}>
          <Ionicons name="trophy" size={30} color={colors.warn} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{trophies} {tr(trophies === 1 ? 'trophy' : 'trophies')}</Text>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Every challenge is always on. Your saved workouts count automatically, and they start over each week or month.</Text>
          </View>
        </View>
        {groups.filter(([, list]) => list.length).map(([title, list]) => (
          <View key={title} style={{ gap: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8 }}>{title}</Text>
            {list.map(({ c, p, wins, status }) => (
              <View key={c.id} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, gap: 12 }} testID={`challenge-${c.id}`}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={status === 'done' ? 'checkmark' : c.icon} size={24} color="#fff" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{c.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 14 }}>{challengeDesc(c, units)}</Text>
                  </View>
                  {wins > 0 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="trophy" size={16} color={colors.warn} />
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{wins}</Text>
                    </View>
                  )}
                </View>
                <View style={{ gap: 6 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                    <View style={{ height: 8, borderRadius: 4, width: `${Math.max(3, p.pct * 100)}%`, backgroundColor: c.tint }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{fmtProgress(c, p, units)}</Text>
                    <Text style={{ color: status === 'done' ? colors.success : colors.muted, fontWeight: status === 'done' ? '700' : '400' }}>
                      {status === 'done' ? tr('Completed') : `${p.daysLeft} ${tr(p.daysLeft === 1 ? 'day left' : 'days left')}`}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
