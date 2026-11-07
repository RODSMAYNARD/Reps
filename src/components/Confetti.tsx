import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/** Sorteio determinístico (o React não aceita Math.random durante a renderização). */
const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** Versão sóbria: grafite, aço e um único azul. */
const PLATES = [['#2A3347', '#59647B'], ['#8A94A8', '#586177'], ['#2D8CFF', '#1B5FBF']] as const;
const BANDS = ['#8A94A8', '#3D96FF'] as const;
type Kind = 'plate' | 'dumbbell' | 'band';
const KINDS: Kind[] = ['plate', 'dumbbell', 'band'];

/** Anilha, halter e banda elástica desenhados em SVG (desenho do Reps). Caixa de 64 x 64 centrada na origem. */
function Piece({ kind, variant, size }: { kind: Kind; variant: number; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="-32 -32 64 64">
      {kind === 'plate' && (() => {
        const c = PLATES[variant % PLATES.length];
        return (
          <G>
            <Circle r={29.4} fill={c[0]} />
            <Circle r={23} fill="none" stroke={c[1]} strokeWidth={3.2} />
            <Path fill={c[1]} fillRule="evenodd" d="M-11 0 A11 11 0 1 0 11 0 A11 11 0 1 0 -11 0 Z M-4.8 0 A4.8 4.8 0 1 1 4.8 0 A4.8 4.8 0 1 1 -4.8 0 Z" />
            <Path d="M-29.05 -4.6 A29.4 29.4 0 0 1 4.6 -29.05" fill="none" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={2.6} strokeLinecap="round" />
          </G>
        );
      })()}
      {kind === 'dumbbell' && (
        <G>
          <Rect x={-16.6} y={-4.2} width={33.2} height={8.4} rx={2} fill="#9BA5B8" />
          {[-1, 1].map((s) => (
            <G key={s}>
              <Rect x={s * 19.2 - 5.8} y={-17.3} width={11.6} height={34.6} rx={3.2} fill="#2B3447" />
              <Rect x={s * 19.2 - 1.9} y={-14.7} width={3.2} height={29.4} rx={1.2} fill="#FFFFFF" fillOpacity={0.22} />
              <Rect x={s * 27.5 - 2.6} y={-10.9} width={5.2} height={21.8} rx={1.9} fill="#6B778C" />
            </G>
          ))}
        </G>
      )}
      {kind === 'band' && (
        <G>
          <Rect x={-25.6} y={-12.2} width={51.2} height={24.4} rx={12.2} fill="none" stroke={BANDS[variant % BANDS.length]} strokeWidth={8.3} />
          <Rect x={-25.6} y={-13.6} width={51.2} height={24.4} rx={12.2} fill="none" stroke="#FFFFFF" strokeOpacity={0.38} strokeWidth={2.2} />
        </G>
      )}
    </Svg>
  );
}

const STEPS = 10;
const BURSTS = 2;
const PER_BURST = 22;

/** Comemoração: dois disparos de anilhas, halteres e bandas que saem do pé da tela, sobem e caem em leque.
 * Animated em JS puro, com o driver nativo (sem lib nativa). Trocar `run` dispara de novo. */
export function Confetti({ run }: { run: number }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(() => {
    const r = rng(run * 9973 + 7);
    const g = height * 1.5;
    return Array.from({ length: BURSTS * PER_BURST }, (_, n) => {
      const kind = KINDS[n % KINDS.length];
      const size = width * (0.075 + r() * 0.04) * (kind === 'dumbbell' ? 0.7 : 1) * 1.15;
      const vy = -height * (1.05 + r() * 0.5);
      const vx = width * (r() * 1.1 - 0.55);
      const dur = (-vy + Math.sqrt(vy * vy + 2 * g * size * 1.2)) / g; // segundos até voltar abaixo da tela
      return {
        kind, size, variant: Math.floor(r() * 3), x: width * (0.42 + r() * 0.16) - size / 2, vx, dur,
        delay: Math.floor(n / PER_BURST) * 900 + r() * 120, spin: (r() > 0.5 ? 1 : -1) * (180 + r() * 540),
        ys: Array.from({ length: STEPS + 1 }, (_, k) => { const t = (k / STEPS) * dur; return vy * t + 0.5 * g * t * t; }),
      };
    });
  }, [run, width, height]);
  const t = useMemo(() => pieces.map(() => new Animated.Value(0)), [pieces]);
  useEffect(() => {
    if (!run) return;
    t.forEach((v) => v.setValue(0));
    const anim = Animated.parallel(t.map((v, i) => Animated.timing(v, { toValue: 1, duration: pieces[i].dur * 1000, delay: pieces[i].delay, easing: Easing.linear, useNativeDriver: true })));
    anim.start();
    return () => anim.stop();
  }, [run, pieces, t]);
  if (!run) return null;
  const steps = Array.from({ length: STEPS + 1 }, (_, k) => k / STEPS);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left: p.x, top: height, width: p.size, height: p.size,
          opacity: t[i].interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] }),
          transform: [
            { translateY: t[i].interpolate({ inputRange: steps, outputRange: p.ys }) },
            { translateX: t[i].interpolate({ inputRange: [0, 1], outputRange: [0, p.vx * p.dur] }) },
            { rotate: t[i].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
          ],
        }}>
          <Piece kind={p.kind} variant={p.variant} size={p.size} />
        </Animated.View>
      ))}
    </View>
  );
}
