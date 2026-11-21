import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { fmtClock } from '../lib/format';
import { tr } from '../lib/i18n';
import type { BreathPattern } from '../lib/types';

/** Fases de cada técnica: nome, segundos e tamanho da bola no FIM da fase (0,62 = vazia, 1 = cheia). */
type Phase = { label: string; sec: number; scale: number };
export const BREATHS: Record<BreathPattern, { name: string; tag: string; why: string; phases: Phase[] }> = {
  box: {
    name: 'Box', tag: '4 · 4 · 4 · 4', why: 'Even counts in, hold, out, hold. Steadies focus before a heavy set.',
    phases: [{ label: 'Breathe in', sec: 4, scale: 1 }, { label: 'Hold', sec: 4, scale: 1 }, { label: 'Breathe out', sec: 4, scale: 0.62 }, { label: 'Hold', sec: 4, scale: 0.62 }],
  },
  sigh: {
    name: 'Recovery sigh', tag: '2 · 1 · 6', why: 'Double inhale through the nose, long exhale through the mouth. Fastest way to slow your breathing between sets.',
    phases: [{ label: 'Breathe in', sec: 2, scale: 0.85 }, { label: 'Sip more air', sec: 1, scale: 1 }, { label: 'Breathe out', sec: 6, scale: 0.62 }],
  },
  r478: {
    name: '4-7-8', tag: 'Calm down', why: 'Long hold and longer exhale. Good after a very hard set or at the end of the workout.',
    phases: [{ label: 'Breathe in', sec: 4, scale: 1 }, { label: 'Hold', sec: 7, scale: 1 }, { label: 'Breathe out', sec: 8, scale: 0.62 }],
  },
  coherent: {
    name: 'Coherent', tag: '5.5 · 5.5', why: 'About 5-6 breaths per minute, no holds. Easy rhythm for long rests.',
    phases: [{ label: 'Breathe in', sec: 5.5, scale: 1 }, { label: 'Breathe out', sec: 5.5, scale: 0.62 }],
  },
};
const ORDER: BreathPattern[] = ['box', 'sigh', 'r478', 'coherent'];
const BG = '#0b1220', CARD = '#1e293b', MUTED = '#94a3b8';

/** Tela cheia do descanso (toque no relógio da barra): bola que guia a respiração, tempo grande, última e próxima série.
 * Fecha sozinha quando o descanso acaba (o pai some com ela quando `rest` vira null). */
export function FocusRest({ visible, left, exercise, last, next, pattern, onPattern, onAdjust, onSkip, onClose }: {
  visible: boolean; left: number; exercise?: string; last?: string; next?: string;
  pattern: BreathPattern; onPattern: (p: BreathPattern) => void; onAdjust: (d: number) => void; onSkip: () => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [scale] = useState(() => new Animated.Value(0.62));
  const [phase, setPhase] = useState('Breathe in');
  const P = BREATHS[pattern] ?? BREATHS.box;
  const over = left <= 0;

  // bola: mesma animação do protótipo (cada fase vai ao tamanho final com ease-in-out; "Hold" fica parada), em laço.
  // O nome da fase troca junto, por temporizador que começa no mesmo instante da animação.
  useEffect(() => {
    if (!visible || over) return;
    scale.stopAnimation(); scale.setValue(0.62);
    const loop = Animated.loop(Animated.sequence(P.phases.map((p) =>
      Animated.timing(scale, { toValue: p.scale, duration: p.sec * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }))));
    loop.start();
    let i = 0, id: ReturnType<typeof setTimeout>;
    const step = () => { setPhase(P.phases[i].label); id = setTimeout(() => { i = (i + 1) % P.phases.length; step(); }, P.phases[i].sec * 1000); };
    id = setTimeout(step, 0);
    return () => { loop.stop(); clearTimeout(id); };
  }, [visible, pattern, over, P, scale]);
  useEffect(() => { if (over) Animated.timing(scale, { toValue: 0.8, duration: 300, useNativeDriver: true }).start(); }, [over, scale]);


  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: BG, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, paddingHorizontal: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text numberOfLines={1} style={{ color: MUTED, fontSize: 14, flex: 1 }}>{exercise ?? ''}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={{ backgroundColor: CARD, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 }} testID="focus-close">
            <Text style={{ color: '#fff', fontSize: 14 }}>Close</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={{ width: 260, height: 260, borderRadius: 130, backgroundColor: over ? '#16a34a' : '#2f6fe8', opacity: 0.85, transform: [{ scale }] }} />
          <View style={{ position: 'absolute', alignItems: 'center', gap: 4 }} pointerEvents="none">
            <Text style={{ color: '#fff', fontSize: 72, lineHeight: 80, fontVariant: ['tabular-nums'] }} testID="focus-clock">{over ? 'Go!' : fmtClock(left)}</Text>
            <Text style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 20, letterSpacing: 1 }}>{tr(over ? 'Rest is over' : phase).toUpperCase()}</Text>
          </View>
        </View>

        {(last || next) ? (
          <Text style={{ color: MUTED, fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
            {last ? <>{tr('Last')}: <Text style={{ color: '#fff' }}>{last}</Text></> : null}
            {last && next ? '  ·  ' : ''}
            {next ? <>{tr('Up next')}: <Text style={{ color: '#fff' }}>{next}</Text></> : null}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ORDER.map((k) => {
            const sel = k === pattern;
            return (
              <Pressable key={k} onPress={() => onPattern(k)} testID={`breath-${k}`}
                style={{ width: '48%', flexGrow: 1, backgroundColor: sel ? '#172554' : CARD, borderWidth: 1, borderColor: sel ? '#60a5fa' : 'transparent', borderRadius: 12, paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: sel ? '#fff' : '#cbd5e1', fontSize: 14, lineHeight: 18, fontWeight: '600' }}>{BREATHS[k].name}</Text>
                <Text style={{ color: sel ? '#93c5fd' : '#64748b', fontSize: 12, lineHeight: 16 }}>{k === 'box' ? `${BREATHS[k].tag} · ${tr('Default')}` : BREATHS[k].tag}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: MUTED, fontSize: 13, lineHeight: 18, textAlign: 'center', minHeight: 36 }}>{P.why}</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable onPress={() => onAdjust(-15)} style={{ flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>-15</Text></Pressable>
          <Pressable onPress={() => onAdjust(15)} style={{ flex: 1, backgroundColor: CARD, borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>+15</Text></Pressable>
          <Pressable onPress={onSkip} testID="focus-skip" style={{ flex: 1, backgroundColor: '#2f7cf6', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Skip</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Linha de progresso do descanso: anda sozinha (animação nativa, sem saltos a cada segundo) e recomeça quando o tempo muda (±15). */
export function RestProgress({ endsAt, total, color, track, height = 6 }: { endsAt: number; total: number; color: string; track: string; height?: number }) {
  const [p] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const ms = Math.max(0, endsAt - Date.now());
    p.setValue(Math.min(1, ms / (total * 1000)));
    const a = Animated.timing(p, { toValue: 0, duration: ms, easing: Easing.linear, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [endsAt, total, p]);
  return (
    <View style={{ height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={{ height, width: '100%', backgroundColor: color, transformOrigin: 'left', transform: [{ scaleX: p }] }} />
    </View>
  );
}
