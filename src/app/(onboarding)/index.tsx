import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Header, Screen, Segmented } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { Units } from '../../lib/types';

export default function UnitsStep() {
  const { profile, saveProfile } = useStore();
  const [u, setU] = useState<Units>(profile.units);
  return (
    <Screen>
      <Header title="Choose your units" left="none" />
      <View style={{ flex: 1, padding: 16, gap: 22 }}>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Weight</Text>
          <Segmented options={[{ id: 'kg', label: 'kg' }, { id: 'lbs', label: 'lbs' }]} value={u.weight} onChange={(weight) => setU({ ...u, weight })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Distance</Text>
          <Segmented options={[{ id: 'km', label: 'kilometers' }, { id: 'mi', label: 'miles' }]} value={u.distance} onChange={(distance) => setU({ ...u, distance })} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: colors.muted }}>Body measurements</Text>
          <Segmented options={[{ id: 'cm', label: 'cm' }, { id: 'in', label: 'in' }]} value={u.body} onChange={(body) => setU({ ...u, body })} /></View>
      </View>
      <View style={{ padding: 16 }}>
        <Btn title="Continue" testID="units-continue" onPress={() => { saveProfile({ units: u }); router.push('/intro'); }} />
      </View>
    </Screen>
  );
}
