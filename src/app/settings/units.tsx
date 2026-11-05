import { Text, View } from 'react-native';
import { Header, Screen, Segmented } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function UnitsSettings() {
  const { profile, saveProfile } = useStore();
  const u = profile.units;
  return (
    <Screen>
      <Header title="Unidades" />
      <View style={{ padding: 16, gap: 22 }}>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Peso</Text><Segmented options={[{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lbs' }]} value={u.weight} onChange={(weight) => saveProfile({ units: { ...u, weight } })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Distância</Text><Segmented options={[{ id: 'km', label: 'quilômetros' }, { id: 'mi', label: 'milhas' }]} value={u.distance} onChange={(distance) => saveProfile({ units: { ...u, distance } })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Medidas corporais</Text><Segmented options={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'pol' }]} value={u.body} onChange={(body) => saveProfile({ units: { ...u, body } })} /></View>
      </View>
    </Screen>
  );
}
