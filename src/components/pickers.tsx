import { useState } from 'react';
import { Text, View } from 'react-native';
import { fmtRest } from '../lib/format';
import { colors } from '../lib/theme';
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

const REST_MIN = Array.from({ length: 100 }, (_, m) => `${m} min`);
const REST_SEC = Array.from({ length: 60 }, (_, s) => `${String(s).padStart(2, '0')} s`);

/** Descanso livre: roda de minutos (0–99) e de segundos (0–59). 0:00 = desligado. Montar só quando aberto (estado parte do valor atual). */
export function RestSheet({ title = 'Rest Timer', value, confirm = 'Done', onDone, onClose }: {
  title?: string; value: number; confirm?: string; onDone: (sec: number) => void; onClose: () => void;
}) {
  const [m, setM] = useState(Math.min(99, Math.floor(value / 60)));
  const [s, setS] = useState(value % 60);
  const total = m * 60 + s;
  return (
    <Sheet visible onClose={onClose} title={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24 }} testID="rest-wheels">
        <Wheel items={REST_MIN} index={m} flex={1} onChange={setM} />
        <Wheel items={REST_SEC} index={s} flex={1} onChange={setS} />
      </View>
      <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 8 }}>{total ? fmtRest(total) : 'Off'}</Text>
      <Btn title={confirm} onPress={() => { onDone(total); onClose(); }} style={{ marginTop: 12 }} testID="rest-done" />
    </Sheet>
  );
}
