import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

/** Sorteio determinístico (o React não aceita Math.random durante a renderização). */
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const COLORS = ['#0A84FF', '#34C759', '#FFD60A', '#FF453A', '#1C3FD1'];

/** Confete em JS puro (Animated, sem lib nativa). Trocar `run` dispara de novo. */
export function Confetti({ run, count = 60 }: { run: number; count?: number }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => { const r = rng(run * 9973 + 7); return Array.from({ length: count }, (_, i) => ({
    x: r() * width, drift: (r() - 0.5) * 120, delay: r() * 500, dur: 2200 + r() * 1600,
    spin: (r() > 0.5 ? 1 : -1) * (360 + r() * 540), w: 6 + r() * 6, h: 10 + r() * 6, c: COLORS[i % COLORS.length],
  })); }, [run, width, count]);
  const t = useMemo(() => pieces.map(() => new Animated.Value(0)), [pieces]);
  useEffect(() => {
    if (!run) return;
    t.forEach((v) => v.setValue(0));
    const anim = Animated.parallel(t.map((v, i) => Animated.timing(v, { toValue: 1, duration: pieces[i].dur, delay: pieces[i].delay, easing: Easing.in(Easing.quad), useNativeDriver: true })));
    anim.start();
    return () => anim.stop();
  }, [run, pieces, t]);
  if (!run) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, top: -20, width: p.w, height: p.h, backgroundColor: p.c,
          opacity: t[i].interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
          transform: [
            { translateY: t[i].interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
            { translateX: t[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
            { rotate: t[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
          ],
        }} />
      ))}
    </View>
  );
}
