import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Text } from '../components/Text';
import { Btn, Dialog, Header, Screen } from '../components/ui';
import { challengeDesc, challengeViews, fmtProgress, joinChallenge, leaveChallenge, restartChallenge, useChallenges, type ChallengeView } from '../lib/challenges';
import { tr } from '../lib/i18n';
import { useStore } from '../lib/store';
import { colors, radius } from '../lib/theme';

/** Desafios: entrar, acompanhar (a conta é feita a partir dos treinos salvos), sair e refazer. */
export default function Challenges() {
  const st = useStore();
  const s = useChallenges(st.session?.user.id ?? null);
  const [leave, setLeave] = useState<string | null>(null);
  const units = st.profile.units;
  const views = challengeViews(s, st.workouts, units);
  const groups: [string, ChallengeView[]][] = [
    ['In progress', views.filter((v) => v.status === 'active' || v.status === 'expired')],
    ['Available', views.filter((v) => v.status === 'available')],
    ['Completed', views.filter((v) => v.status === 'done')],
  ];

  return (
    <Screen>
      <Header title="Challenges" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 12 }} testID="challenges">
        <Text style={{ color: colors.muted, fontSize: 15 }}>Join a challenge and your saved workouts count toward it automatically.</Text>
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

                {!!p && (
                  <View style={{ gap: 6 }}>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
                      <View style={{ height: 8, borderRadius: 4, width: `${Math.max(3, p.pct * 100)}%`, backgroundColor: status === 'expired' ? colors.faint : c.tint }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{fmtProgress(c, p, units)}</Text>
                      <Text style={{ color: status === 'done' ? colors.success : colors.muted, fontWeight: status === 'done' ? '700' : '400' }}>
                        {status === 'done' ? tr('Completed') : status === 'expired' ? tr('Time is up') : `${p.daysLeft} ${tr(p.daysLeft === 1 ? 'day left' : 'days left')}`}
                      </Text>
                    </View>
                  </View>
                )}

                {status === 'available' && <Btn title="Join challenge" onPress={() => joinChallenge(c.id)} testID={`challenge-join-${c.id}`} />}
                {status === 'active' && <Btn title="Leave challenge" variant="outline" onPress={() => setLeave(c.id)} testID={`challenge-leave-${c.id}`} />}
                {status === 'expired' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Btn title="Try again" onPress={() => restartChallenge(c.id, false)} style={{ flex: 1 }} />
                    <Btn title="Leave" variant="outline" onPress={() => leaveChallenge(c.id)} style={{ flex: 1 }} />
                  </View>
                )}
                {status === 'done' && <Btn title="Do it again" variant="outline" onPress={() => restartChallenge(c.id, true)} />}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <Dialog visible={!!leave} title="Leave this challenge?" message="Your progress in it starts over if you join again." onClose={() => setLeave(null)}
        actions={[{ label: 'Cancel' }, { label: 'Leave', danger: true, onPress: () => { if (leave) leaveChallenge(leave); setLeave(null); } }]} />
    </Screen>
  );
}
