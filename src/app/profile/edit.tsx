import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { NumberSheet, OptionSheet, range } from '../../components/pickers';
import { Avatar, Dialog, Field, Header, HeaderAction, ListRow, Screen, Section, Toggle } from '../../components/ui';
import { fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function EditProfile() {
  const { profile, saveProfile, showToast } = useStore();
  const [name, setName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [link, setLink] = useState(profile.link);
  const [sex, setSex] = useState(profile.sex);
  const [year, setYear] = useState(profile.birthYear);
  const [kg, setKg] = useState(profile.weightKg);
  const [priv, setPriv] = useState(profile.isPrivate);
  const [sheet, setSheet] = useState<'sex' | 'year' | 'weight' | null>(null);
  const [photo, setPhoto] = useState(false);
  const u = profile.units;
  const thisYear = new Date().getFullYear();
  const save = async () => { await saveProfile({ displayName: name.trim(), username: username.trim(), bio, link, sex, birthYear: year, weightKg: kg, isPrivate: priv }); showToast('Perfil atualizado'); router.back(); };
  return (
    <Screen>
      <Header left="cancel" title="Editar perfil" right={<HeaderAction label="Salvar" primary disabled={!username.trim()} onPress={save} />} />
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', padding: 20, gap: 8 }}><Avatar name={name || username} size={92} /><Text onPress={() => setPhoto(true)} style={{ color: colors.primary }}>Alterar foto</Text></View>
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <Field label="Nome" value={name} onChangeText={setName} testID="edit-name" />
          <Field label="Nome de usuário" autoCapitalize="none" value={username} onChangeText={setUsername} />
          <Field label="Bio" multiline value={bio} onChangeText={setBio} />
          <Field label="Link" autoCapitalize="none" value={link} onChangeText={setLink} placeholder="https://" />
        </View>
        <Section title="Dados de força" />
        <ListRow label="Sexo" detail={sex === 'male' ? 'Masculino' : sex === 'female' ? 'Feminino' : 'Selecionar'} onPress={() => setSheet('sex')} />
        <ListRow label="Ano de nascimento" detail={year ? String(year) : 'Selecionar'} onPress={() => setSheet('year')} />
        <ListRow label="Peso corporal" detail={kg ? `${Math.round(toDisplayWeight(kg, u) * 10) / 10} ${u.weight}` : 'Selecionar'} onPress={() => setSheet('weight')} last />
        <Section title="Privacidade" />
        <Toggle label="Perfil privado" subtitle="Só quem você aprovar vê seus treinos" value={priv} onChange={setPriv} />
      </ScrollView>
      <OptionSheet visible={sheet === 'sex'} title="Sexo" onClose={() => setSheet(null)} options={[{ id: 'male', label: 'Masculino' }, { id: 'female', label: 'Feminino' }]} onPick={(v) => setSex(v as 'male' | 'female')} />
      {sheet === 'year' && <NumberSheet visible title="Ano de nascimento" values={range(thisYear - 90, thisYear - 12).reverse()} selected={year ?? 1995} onDone={setYear} onClose={() => setSheet(null)} />}
      {sheet === 'weight' && <NumberSheet visible title={`Peso corporal (${u.weight})`} values={range(u.weight === 'kg' ? 30 : 66, u.weight === 'kg' ? 200 : 440, 0.5)} selected={Math.round(toDisplayWeight(kg ?? 75, u) * 2) / 2} format={(v) => `${v} ${u.weight}`} onDone={(v) => setKg(fromDisplayWeight(v, u))} onClose={() => setSheet(null)} />}
      <Dialog visible={photo} title="Em breve" message="A foto de perfil será liberada quando o armazenamento de imagens for ativado." actions={[{ label: 'Ok', primary: true, onPress: () => setPhoto(false) }]} />
    </Screen>
  );
}
