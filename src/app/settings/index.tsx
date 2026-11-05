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
      <Header title="Settings" />
      <ScrollView>
        <ListRow icon="person-outline" label="Account" detail={session?.user.email ?? ''} onPress={go('/profile/edit')} />
        <ListRow icon="trophy-outline" label="Reps Pro" onPress={go('/settings/pro')} testID="open-pro" />
        <ListRow icon="speedometer-outline" label="Units" onPress={go('/settings/units')} testID="open-units" />
        <ListRow icon="link-outline" label="Integrations" onPress={go('/settings/integrations')} />
        <ListRow icon="moon-outline" label="Theme" onPress={go('/settings/theme')} />
        <ListRow icon="share-outline" label="Export & Import Data" onPress={go('/settings/export')} />
        <Section title="Guides" />
        <ListRow icon="information-circle-outline" label="Getting Started" onPress={go('/settings/guide')} />
        <ListRow icon="clipboard-outline" label="Routine Help" onPress={go('/routines/help')} />
        <Section title="Help" />
        <ListRow icon="help-circle-outline" label="FAQ" onPress={go('/settings/faq')} />
        <ListRow icon="mail-outline" label="Contact Us" onPress={go('/settings/contact')} />
        <ListRow icon="bulb-outline" label="Feature Request" onPress={go('/settings/feature-request')} />
        <ListRow icon="barbell-outline" label="About" onPress={go('/settings/about')} />
        <Section title="Reps Coach" />
        <ListRow icon="people-outline" label="Learn about Reps Coach" onPress={go('/settings/coach')} last />
        <ListRow label="Log out" danger onPress={() => setAsk(true)} testID="logout" last />
      </ScrollView>
      <Dialog visible={ask} title="Log out?" message="You can sign back in whenever you like." onClose={() => setAsk(false)} actions={[{ label: 'Cancel' }, { label: 'Log out', danger: true, onPress: () => { setAsk(false); signOut(); } }]} />
    </Screen>
  );
}
