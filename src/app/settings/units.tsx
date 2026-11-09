import { View } from 'react-native';
import { Text } from '../../components/Text';
import { Header, Screen, Segmented } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function UnitsSettings() {
  const { profile, saveProfile } = useStore();
  const u = profile.units;
  return (
    <Screen>
      <Header title="Units" />
      <View style={{ padding: 16, gap: 22 }}>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Weight</Text><Segmented options={[{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lbs' }]} value={u.weight} onChange={(weight) => saveProfile({ units: { ...u, weight } })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Distance</Text><Segmented options={[{ id: 'km', label: 'kilometers' }, { id: 'mi', label: 'miles' }]} value={u.distance} onChange={(distance) => saveProfile({ units: { ...u, distance } })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Body measurements</Text><Segmented options={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'in' }]} value={u.body} onChange={(body) => saveProfile({ units: { ...u, body } })} /></View>
      </View>
    </Screen>
  );
}
