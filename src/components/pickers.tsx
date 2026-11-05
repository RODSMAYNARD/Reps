import { useState } from 'react';
import { Btn, Sheet, WheelPicker } from './ui';

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
