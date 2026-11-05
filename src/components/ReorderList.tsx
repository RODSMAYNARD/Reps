/* eslint-disable react-hooks/refs -- the PanResponder must survive re-renders (the workout timer ticks every second), so it reads latest props through refs */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, ScrollView, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { ExerciseThumb } from './ExerciseThumb';

const ROW = 64;
export type ReorderItem = { key: string; title: string; subtitle: string; catalogId?: string | null };

/** Touch, hold and drag a row up or down. Calls onMove(from, to) on release. */
export function ReorderList({ items, onMove }: { items: ReorderItem[]; onMove: (from: number, to: number) => void }) {
  const [drag, setDrag] = useState<{ i: number; dy: number } | null>(null);
  const target = drag ? Math.max(0, Math.min(items.length - 1, Math.round(drag.i + drag.dy / ROW))) : -1;
  return (
    <ScrollView scrollEnabled={!drag} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: colors.muted, marginBottom: 12 }}>Touch and hold a row, then drag it up or down.</Text>
      <View style={{ height: items.length * ROW }}>
        {items.map((it, k) => (
          <Row key={it.key} item={it} index={k} count={items.length} drag={drag} target={target} setDrag={setDrag} onMove={onMove} />
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ item, index, count, drag, target, setDrag, onMove }: {
  item: ReorderItem; index: number; count: number; drag: { i: number; dy: number } | null; target: number;
  setDrag: (d: { i: number; dy: number } | null) => void; onMove: (from: number, to: number) => void;
}) {
  const idx = useRef(index);
  const cnt = useRef(count);
  const mv = useRef(onMove);
  useEffect(() => { idx.current = index; cnt.current = count; mv.current = onMove; });
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setDrag({ i: idx.current, dy: 0 }),
      onPanResponderMove: (_e, g) => setDrag({ i: idx.current, dy: g.dy }),
      onPanResponderRelease: (_e, g) => {
        const to = Math.max(0, Math.min(cnt.current - 1, Math.round(idx.current + g.dy / ROW)));
        setDrag(null);
        if (to !== idx.current) mv.current(idx.current, to);
      },
      onPanResponderTerminate: () => setDrag(null),
    }),
  );

  let y = index * ROW;
  let z = 0;
  let lift = false;
  if (drag) {
    if (drag.i === index) { y = index * ROW + drag.dy; z = 10; lift = true; }
    else if (drag.i < index && index <= target) y = (index - 1) * ROW;
    else if (target <= index && index < drag.i) y = (index + 1) * ROW;
  }
  return (
    <View
      {...pan.panHandlers}
      testID="reorder-row"
      style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: ROW - 8, transform: [{ translateY: y }], zIndex: z,
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, backgroundColor: lift ? colors.primarySoft : colors.surface,
        borderRadius: radius.md, borderWidth: 1, borderColor: lift ? colors.primary : colors.border, ...({ userSelect: 'none' } as object),
      }}>
      <Ionicons name="reorder-three" size={24} color={colors.muted} />
      <ExerciseThumb catalogId={item.catalogId} size={36} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{item.subtitle}</Text>
      </View>
    </View>
  );
}
