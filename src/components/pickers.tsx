import { useState } from 'react';
import { View } from 'react-native';
import { fmtRest } from '../lib/format';
import { Btn, Sheet, WheelPicker } from './ui';
import { WheelPicker as Wheel } from './WheelPicker';

export function NumberSheet({ visible, title, values, selected, format, onDone, onClose }: {
  visible: boolean; title: string; values: number[]; selected: number; format?: (v: number) => string; onDone: (v: number) => void; onClose: () => void;
}) {
  const [v, setV] = useState(selected);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <WheelPicker values={values} selected={v} onSelect={setV} format={format} />
      <Btn title="Done" onPress={() => { onDone(v); onClose(); }} style={{ marginTop: 12 }} />
    </Sheet>
  );
}

export function OptionSheet<T extends string>({ visible, title, options, onPick, onClose }: {
  visible: boolean; title: string; options: { id: T; label: string }[]; onPick: (v: T) => void; onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {options.map((o) => <Btn key={o.id} title={o.label} variant="secondary" style={{ marginBottom: 8 }} onPress={() => { onPick(o.id); onClose(); }} />)}
    </Sheet>
  );
}

export const range = (from: number, to: number, step = 1) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => Math.round((from + i * step) * 10) / 10);

// Uma roda só: de 5 em 5 s até 5 min, de 15 em 15 s até 15 min, depois minuto a minuto até 99 min.
const REST_VALUES = [...range(0, 300, 5), ...range(315, 900, 15), ...range(960, 99 * 60, 60)];
const REST_LABELS = REST_VALUES.map((v) => (v ? fmtRest(v) : 'Off'));
const nearestRest = (sec: number) => REST_VALUES.reduce((b, v, i) => (Math.abs(v - sec) < Math.abs(REST_VALUES[b] - sec) ? i : b), 0);

/** Descanso livre numa roda só (0 = desligado). Montar só quando aberto (estado parte do valor atual). */
export function RestSheet({ title = 'Rest Timer', value, confirm = 'Done', onDone, onClose }: {
  title?: string; value: number; confirm?: string; onDone: (sec: number) => void; onClose: () => void;
}) {
  const [i, setI] = useState(() => nearestRest(value));
  return (
    <Sheet visible onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: 24 }} testID="rest-wheel">
        <Wheel items={REST_LABELS} index={i} onChange={setI} />
      </View>
      <Btn title={confirm} onPress={() => { onDone(REST_VALUES[i]); onClose(); }} style={{ marginTop: 12 }} testID="rest-done" />
    </Sheet>
  );
}
