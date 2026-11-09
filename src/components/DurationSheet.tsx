import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { fmtStartTime, fmtDurationLive } from '../lib/format';
import { colors } from '../lib/theme';
import { StartTimeWheels, WheelPicker } from './WheelPicker';
import { Btn, Sheet } from './ui';

const DURATION_ITEMS = Array.from({ length: 24 * 60 }, (_, m) => (m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}min`));

function SheetRow({ label, value, onPress, testID }: { label: string; value: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 16, color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 16, color: colors.primary }}>{value}</Text>
    </Pressable>
  );
}

/** Folha "Duration" do treino: toque em Duration para ajustar horas/minutos (o início acompanha), em Start time para escolher o dia e a hora
 * (a duração não muda). Pausa/retoma o cronômetro. */
export function DurationSheet({ elapsed, start, paused, onClose, onElapsed, onStart, onTogglePause }: {
  elapsed: number; start: Date; paused: boolean; onClose: () => void; onElapsed: (sec: number) => void; onStart: (d: Date) => void; onTogglePause: () => void;
}) {
  const [open, setOpen] = useState<'duration' | 'start' | null>(null);
  const [idx, setIdx] = useState(() => Math.min(DURATION_ITEMS.length - 1, Math.floor(elapsed / 60)));
  const toggle = (w: 'duration' | 'start') => {
    if (w === 'duration' && open !== 'duration') setIdx(Math.min(DURATION_ITEMS.length - 1, Math.floor(elapsed / 60)));
    setOpen(open === w ? null : w);
  };
  return (
    <Sheet visible onClose={onClose} title="Duration">
      <SheetRow label="Duration" value={fmtDurationLive(elapsed)} onPress={() => toggle('duration')} testID="duration-row" />
      {open === 'duration' && <WheelPicker key="dur" items={DURATION_ITEMS} index={idx} onChange={(m) => { setIdx(m); onElapsed(m * 60); }} testID="duration-wheel" />}
      <SheetRow label="Start time" value={fmtStartTime(start)} onPress={() => toggle('start')} testID="start-row" />
      {open === 'start' && <StartTimeWheels value={start} onChange={onStart} />}
      <View style={{ paddingTop: 12 }}>
        <Btn title={paused ? 'Resume Workout Timer' : 'Pause Workout Timer'} icon={paused ? 'play' : 'pause'} onPress={onTogglePause} testID="pause-timer" />
      </View>
    </Sheet>
  );
}
