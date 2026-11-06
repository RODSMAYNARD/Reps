import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Header, HeaderAction, ListRow, Screen, Toggle } from '../../components/ui';
import { RestSheet } from '../../components/pickers';
import { fmtRest } from '../../lib/format';
import { useStore } from '../../lib/store';

export default function WorkoutSettings() {
  const { wprefs: p, setWprefs } = useStore();
  const [restOpen, setRestOpen] = useState(false);
  return (
    <Screen>
      <Header title="Workout Settings" right={<HeaderAction label="Done" primary onPress={() => router.back()} />} />
      <ScrollView testID="workout-settings">
        <Toggle label="Sounds" subtitle="Play a sound when the rest timer ends." value={p.sounds} onChange={(v) => setWprefs({ sounds: v })} />
        <ListRow label="Default Rest Timer" detail={p.defaultRestSec ? fmtRest(p.defaultRestSec) : 'Off'} onPress={() => setRestOpen(true)} testID="default-rest" />
        <ListRow label="Previous Workout Values" detail={p.prevMode === 'any' ? 'Default' : 'Same routine'} onPress={() => router.push('/settings/workout-previous')} />
        <ListRow label="Warm-up Calculator" detail={p.warmupCalc ? 'On' : 'Off'} onPress={() => router.push('/settings/workout-warmup')} testID="open-warmup" />
        <Toggle label="Keep Awake During Workout" subtitle="Enable this if you don't want your phone to sleep while you're in a workout." value={p.keepAwake} onChange={(v) => setWprefs({ keepAwake: v })} />
        <Toggle label="Plate Calculator" subtitle="Shows the plates needed on a bar to reach a specific weight. A Calculator button appears on barbell exercises." value={p.plateCalc} onChange={(v) => setWprefs({ plateCalc: v })} />
        <Toggle label="RPE Tracking" subtitle="RPE (Rated Perceived Exertion) is a measure of the intensity of an exercise." value={p.rpe} onChange={(v) => setWprefs({ rpe: v })} />
        <Toggle label="Smart Superset Scrolling" subtitle="When you complete a set, it'll automatically scroll to the next exercise in the superset." value={p.smartSuperset} onChange={(v) => setWprefs({ smartSuperset: v })} />
        <Toggle label="Inline Timer" subtitle="Duration exercises have a built-in stopwatch for tracking time for each set." value={p.inlineTimer} onChange={(v) => setWprefs({ inlineTimer: v })} />
        <Toggle label="Live Personal Record Notification" subtitle="Notifies you when you achieve a Personal Record upon checking the set." value={p.livePR} onChange={(v) => setWprefs({ livePR: v })} />
      </ScrollView>
      {restOpen && <RestSheet value={p.defaultRestSec} onDone={(v) => setWprefs({ defaultRestSec: v })} onClose={() => setRestOpen(false)} />}
    </Screen>
  );
}
