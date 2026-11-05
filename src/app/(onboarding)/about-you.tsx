import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
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
      <Header title="Sobre você" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.muted, padding: 16 }}>Usamos esses dados para calcular seu nível de força e comparar com outras pessoas. Você pode pular e preencher depois.</Text>
        <ListRow label="Sexo" detail={sex === 'male' ? 'Masculino' : sex === 'female' ? 'Feminino' : 'Selecionar'} onPress={() => setSheet('sex')} />
        <ListRow label="Ano de nascimento" detail={year ? String(year) : 'Selecionar'} onPress={() => setSheet('year')} />
        <ListRow label="Peso corporal" detail={kg ? `${Math.round(toDisplayWeight(kg, u) * 10) / 10} ${u.weight}` : 'Selecionar'} onPress={() => setSheet('weight')} last />
      </View>
      <View style={{ padding: 16, gap: 8 }}>
        <Btn title="Continuar" testID="about-continue" onPress={() => { saveProfile({ sex, birthYear: year, weightKg: kg }); router.push('/paywall'); }} />
        <TextLink title="Pular" onPress={() => router.push('/paywall')} style={{ padding: 8 }} />
      </View>
      <OptionSheet visible={sheet === 'sex'} title="Sexo" onClose={() => setSheet(null)} options={[{ id: 'male', label: 'Masculino' }, { id: 'female', label: 'Feminino' }]} onPick={(v) => setSex(v as 'male' | 'female')} />
      {sheet === 'year' && <NumberSheet visible title="Ano de nascimento" values={range(thisYear - 90, thisYear - 12).reverse()} selected={year ?? 1995} onDone={setYear} onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <NumberSheet visible title={`Peso corporal (${u.weight})`} values={range(u.weight === 'kg' ? 30 : 66, u.weight === 'kg' ? 200 : 440, 0.5)} selected={Math.round(toDisplayWeight(kg ?? 75, u) * 2) / 2} format={(v) => `${v} ${u.weight}`} onDone={(v) => setKg(fromDisplayWeight(v, u))} onClose={() => setSheet(null)} />}
    </Screen>
  );
}
