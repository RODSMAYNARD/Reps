import { useMemo, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { colors } from '../lib/theme';

const W = 96;

/** Linha que desliza para a esquerda e mostra um botão vermelho "Delete" (como no Hevy). PanResponder puro, sem lib nativa. */
export function SwipeRow({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const x = useMemo(() => new Animated.Value(0), []);
  const [open, setOpen] = useState(false);
  const pan = useMemo(() => {
    const snap = (to: number) => { setOpen(to !== 0); Animated.spring(x, { toValue: to, useNativeDriver: true, bounciness: 0 }).start(); };
    const base = () => (open ? -W : 0);
    return PanResponder.create({
      // só assume o gesto quando é claramente horizontal: a rolagem vertical da lista continua funcionando
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-W - 24, Math.min(0, base() + g.dx))),
      onPanResponderRelease: (_, g) => snap(base() + g.dx < -W / 2 ? -W : 0),
      onPanResponderTerminate: () => snap(base()),
      onPanResponderTerminationRequest: () => false,
    });
  }, [x, open]);
  const close = () => { setOpen(false); Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(); };
  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: W, backgroundColor: colors.danger }}>
        <Pressable onPress={() => { close(); onDelete(); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="swipe-delete">
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>Delete</Text>
        </Pressable>
      </View>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
}
