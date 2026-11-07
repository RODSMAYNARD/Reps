import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { RestSheet } from '../../components/pickers';
import { Header, HeaderAction, ListRow, Screen } from '../../components/ui';
import { fmtRest } from '../../lib/format';
import { useStore } from '../../lib/store';

/** Timer Settings (aberta pela engrenagem do Rest Timer): sons e descanso padrão. Done volta ao treino. */
export default function TimerSettings() {
  const { wprefs: p, setWprefs } = useStore();
  const [restOpen, setRestOpen] = useState(false);
  return (
    <Screen>
      <Header title="Timer Settings" right={<HeaderAction label="Done" onPress={() => (router.canDismiss() ? router.dismissTo('/active') : router.back())} />} />
      <ScrollView testID="timer-settings">
        <ListRow label="Sounds" onPress={() => router.push('/settings/timer-sounds')} testID="timer-sounds" />
        <ListRow label="Default Rest Timer" detail={p.defaultRestSec ? fmtRest(p.defaultRestSec) : 'Off'} onPress={() => setRestOpen(true)} testID="timer-default-rest" last />
      </ScrollView>
      {restOpen && <RestSheet title="Rest Timer" subtitle="Default Rest Timer Setting" value={p.defaultRestSec} onDone={(v) => setWprefs({ defaultRestSec: v })} onClose={() => setRestOpen(false)} />}
    </Screen>
  );
}
