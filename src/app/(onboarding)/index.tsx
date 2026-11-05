import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Header, Screen, Segmented } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { Units } from '../../lib/types';

export default function UnitsStep() {
  const { profile, saveProfile } = useStore();
  const [u, setU] = useState<Units>(profile.units);
  return (
    <Screen>
      <Header title="Escolha as unidades" left="none" />
      <View style={{ flex: 1, padding: 16, gap: 22 }}>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Peso</Text>
          <Segmented options={[{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lbs' }]} value={u.weight} onChange={(weight) => setU({ ...u, weight })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Distância</Text>
          <Segmented options={[{ id: 'km', label: 'quilômetros' }, { id: 'mi', label: 'milhas' }]} value={u.distance} onChange={(distance) => setU({ ...u, distance })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Medidas corporais</Text>
          <Segmented options={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'pol' }]} value={u.body} onChange={(body) => setU({ ...u, body })} /></View>
      </View>
      <View style={{ padding: 16 }}>
        <Btn title="Continuar" testID="units-continue" onPress={() => { saveProfile({ units: u }); router.push('/intro'); }} />
      </View>
    </Screen>
  );
}
