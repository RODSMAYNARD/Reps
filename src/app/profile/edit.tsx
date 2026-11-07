import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { NumberSheet, OptionSheet, range } from '../../components/pickers';
import { Avatar, Dialog, Field, Header, HeaderAction, ListRow, Screen, Section } from '../../components/ui';
import { fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { useStore } from '../../lib/store';

export default function EditProfile() {
  const { profile, saveProfile, showToast } = useStore();
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [link, setLink] = useState(profile.link);
  const [sex, setSex] = useState(profile.sex);
  const [year, setYear] = useState(profile.birthYear);
  const [kg, setKg] = useState(profile.weightKg);
  const priv = profile.isPrivate;
  const [sheet, setSheet] = useState<'sex' | 'year' | 'weight' | null>(null);
  const [photo, setPhoto] = useState(false);
  const u = profile.units;
  const thisYear = new Date().getFullYear();
  const save = async () => { if (!(await saveProfile({ displayName: name.trim(), username: username.trim(), bio, link, sex, birthYear: year, weightKg: kg, isPrivate: priv }))) return; showToast('Profile updated'); router.back(); };
  return (
    <Screen>
      <Header left="cancel" title="Edit profile" right={<HeaderAction label="Save" primary disabled={!username.trim()} onPress={save} />} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', padding: 20, gap: 8 }}><Avatar name={name || username} size={92} /></View>
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Field label="Name" value={name} onChangeText={setName} testID="edit-name" />
          <Field label="Username" autoCapitalize="none" value={username} onChangeText={setUsername} />
          <Field label="Bio" multiline value={bio} onChangeText={setBio} />
          <Field label="Link" autoCapitalize="none" value={link} onChangeText={setLink} placeholder="https://" />
        </View>
        <Section title="Strength data" />
        <ListRow label="Sex" detail={sex === 'male' ? 'Male' : sex === 'female' ? 'Female' : 'Select'} onPress={() => setSheet('sex')} />
        <ListRow label="Birth year" detail={year ? String(year) : 'Select'} onPress={() => setSheet('year')} />
        <ListRow label="Body weight" detail={kg ? `${Math.round(toDisplayWeight(kg, u) * 10) / 10} ${u.weight}` : 'Select'} onPress={() => setSheet('weight')} last />
        <Section title="Privacy" />
      </ScrollView>
      <OptionSheet visible={sheet === 'sex'} title="Sex" onClose={() => setSheet(null)} options={[{ id: 'male', label: 'Male' }, { id: 'female', label: 'Female' }]} onPick={(v) => setSex(v as 'male' | 'female')} />
      {sheet === 'year' && <NumberSheet visible title="Birth year" values={range(thisYear - 90, thisYear - 12).reverse()} selected={year ?? 1995} onDone={setYear} onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <NumberSheet visible title={`Body weight (${u.weight})`} values={range(u.weight === 'kg' ? 30 : 66, u.weight === 'kg' ? 200 : 440, 0.5)} selected={Math.round(toDisplayWeight(kg ?? 75, u) * 2) / 2} format={(v) => `${v} ${u.weight}`} onDone={(v) => setKg(fromDisplayWeight(v, u))} onClose={() => setSheet(null)} />}
      <Dialog visible={photo} title="Coming soon" message="Profile photos will be available once image storage is enabled." actions={[{ label: 'Ok', primary: true, onPress: () => setPhoto(false) }]} />
    </Screen>
  );
}
