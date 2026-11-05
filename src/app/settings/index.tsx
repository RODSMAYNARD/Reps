import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Dialog, Header, ListRow, Screen, Section } from '../../components/ui';
import { useStore } from '../../lib/store';

export default function Settings() {
  const { signOut, session } = useStore();
  const [ask, setAsk] = useState(false);
  const go = (p: string) => () => router.push(p as never);
  return (
    <Screen>
      <Header title="Configurações" />
      <ScrollView>
        <ListRow icon="person-outline" label="Conta" detail={session?.user.email ?? ''} onPress={go('/profile/edit')} />
        <ListRow icon="trophy-outline" label="Reps Pro" onPress={go('/settings/pro')} testID="open-pro" />
        <ListRow icon="speedometer-outline" label="Unidades" onPress={go('/settings/units')} testID="open-units" />
        <ListRow icon="link-outline" label="Integrações" onPress={go('/settings/integrations')} />
        <ListRow icon="moon-outline" label="Tema" onPress={go('/settings/theme')} />
        <ListRow icon="share-outline" label="Exportar e importar dados" onPress={go('/settings/export')} />
        <Section title="Guias" />
        <ListRow icon="information-circle-outline" label="Guia de início" onPress={go('/settings/guide')} />
        <ListRow icon="clipboard-outline" label="Ajuda de rotinas" onPress={go('/routines/help')} />
        <Section title="Ajuda" />
        <ListRow icon="help-circle-outline" label="Perguntas frequentes" onPress={go('/settings/faq')} />
        <ListRow icon="mail-outline" label="Fale com a gente" onPress={go('/settings/contact')} />
        <ListRow icon="bulb-outline" label="Sugerir uma funcionalidade" onPress={go('/settings/feature-request')} />
        <ListRow icon="barbell-outline" label="Sobre" onPress={go('/settings/about')} />
        <Section title="Reps Coach" />
        <ListRow icon="people-outline" label="Conheça o Reps Coach" onPress={go('/settings/coach')} last />
        <ListRow label="Sair da conta" danger onPress={() => setAsk(true)} testID="logout" last />
      </ScrollView>
      <Dialog visible={ask} title="Sair da conta?" message="Você poderá entrar de novo quando quiser." onClose={() => setAsk(false)} actions={[{ label: 'Cancelar' }, { label: 'Sair', danger: true, onPress: () => { setAsk(false); signOut(); } }]} />
    </Screen>
  );
}
