import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { NumberSheet, OptionSheet, range } from '../../components/pickers';
import { Btn, Header, ListRow, Screen, TextLink } from '../../components/ui';
import { fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function AboutYou() {
  const { profile, saveProfile } = useStore();
  const [sex, setSex] = useState(profile.sex);
  const [year, setYear] = useState(profile.birthYear);
  const [kg, setKg] = useState(profile.weightKg);
  const [sheet, setSheet] = useState<'sex' | 'year' | 'weight' | null>(null);
  const u = profile.units;
  const thisYear = new Date().getFullYear();
  return (
    <Screen>
      <Header title="About you" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, padding: 16 }}>We use this to calculate your strength level and compare you with other people. You can skip this and fill it in later.</Text>
        <ListRow label="Sex" detail={sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Select'} onPress={() => setSheet('sex')} />
        <ListRow label="Birth year" detail={year ? String(year) : 'Select'} onPress={() => setSheet('year')} />
        <ListRow label="Body weight" detail={kg ? `${Math.round(toDisplayWeight(kg, u) * 10) / 10} ${u.weight}` : 'Select'} onPress={() => setSheet('weight')} last />
      </View>
      <View style={{ padding: 16, gap: 8 }}>
        <Btn title="Continue" testID="about-continue" onPress={() => { saveProfile({ sex, birthYear: year, weightKg: kg }); router.push('/paywall'); }} />
        <TextLink title="Skip" onPress={() => router.push('/paywall')} style={{ padding: 8 }} />
      </View>
      <OptionSheet visible={sheet === 'sex'} title="Sex" onClose={() => setSheet(null)} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]} onPick={(v) => setSex(v as 'male' | 'female')} />
      {sheet === 'year' && <NumberSheet visible title="Birth year" values={range(thisYear - 90, thisYear - 12).reverse()} selected={year ?? 1995} onDone={setYear} onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <NumberSheet visible title={`Body weight (${u.weight})`} values={range(u.weight === 'kg' ? 30 : 66, u.weight === 'kg' ? 200 : 440, 0.5)} selected={Math.round(toDisplayWeight(kg ?? 75, u) * 2) / 2} format={(v) => `${v} ${u.weight}`} onDone={(v) => setKg(fromDisplayWeight(v, u))} onClose={() => setSheet(null)} />}
    </Screen>
  );
}
