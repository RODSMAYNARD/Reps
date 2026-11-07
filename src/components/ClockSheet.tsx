import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fmtClock } from '../lib/format';
import { useNow } from '../lib/store';
import { colors, radius } from '../lib/theme';
import { Btn, Sheet } from './ui';

/** Cronômetro do treino: acumulado + instante em que voltou a correr (null = parado). */
export type Stopwatch = { acc: number; startedAt: number | null };
export const swMs = (s: Stopwatch, now: number) => s.acc + (s.startedAt ? now - s.startedAt : 0);
/** MM:SS:CC (minutos, segundos e centésimos), como no Hevy. */
export const fmtStopwatch = (ms: number) => {
  const cs = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(cs).padStart(2, '0')}`;
};

const SIZE = 190, STROKE = 6, R = (SIZE - STROKE) / 2, C = 2 * Math.PI * R;

/** Relógio do treino (botão do alarme no cabeçalho): aba Timer (contagem regressiva com anel, -15s/+15s, Start/Cancel) e aba Stopwatch. */
export function ClockSheet({ visible, onClose, onSettings, rest, onStart, onAdjust, onCancel, sw, setSw, defaultSec }: {
  visible: boolean; onClose: () => void; onSettings: () => void;
  rest: { left: number; total: number } | null; onStart: (sec: number) => void; onAdjust: (delta: number) => void; onCancel: () => void;
  sw: Stopwatch; setSw: (s: Stopwatch) => void; defaultSec: number;
}) {
  const [tab, setTab] = useState<'timer' | 'stopwatch'>('timer');
  const [sec, setSec] = useState(defaultSec || 60);
  const now = useNow(50, visible && tab === 'stopwatch' && !!sw.startedAt);
  const running = !!rest;
  const shown = running ? rest.left : sec;
  const progress = running ? Math.min(1, Math.max(0, rest.left / Math.max(1, rest.total))) : 1;
  const adjust = (d: number) => (running ? onAdjust(d) : setSec((v) => Math.max(15, v + d)));
  const ms = swMs(sw, now);

  return (
    <Sheet visible={visible} onClose={onClose} title="Clock" right={<Ionicons name="options-outline" size={22} color={colors.text} onPress={() => { onClose(); onSettings(); }} testID="clock-settings" />}>
      <View style={{ paddingHorizontal: 16, gap: 18 }}>
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3 }}>
          {(['timer', 'stopwatch'] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} testID={`clock-tab-${k}`} style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md - 2, backgroundColor: tab === k ? colors.primary : 'transparent' }}>
              <Text style={{ color: tab === k ? colors.onPrimary : colors.text, fontWeight: '600' }}>{k === 'timer' ? 'Timer' : 'Stopwatch'}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'timer' ? (
          <>
            <View style={{ alignItems: 'center', justifyContent: 'center', height: SIZE + 30 }}>
              <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.surface} strokeWidth={STROKE} fill="none" />
                <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.primary} strokeWidth={STROKE} fill="none" strokeDasharray={`${C * progress} ${C}`} strokeLinecap="round" />
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center' }}><Text style={{ fontSize: 44, color: colors.text, fontVariant: ['tabular-nums'] }} testID="clock-timer">{fmtClock(shown)}</Text></View>
              <Text style={{ position: 'absolute', left: 8, bottom: 6, color: colors.primary, fontSize: 15 }} onPress={() => adjust(-15)} testID="clock-minus">-15s</Text>
              <Text style={{ position: 'absolute', right: 8, bottom: 6, color: colors.primary, fontSize: 15 }} onPress={() => adjust(15)} testID="clock-plus">+15s</Text>
            </View>
            {running ? <Btn title="Cancel" variant="secondary" onPress={onCancel} testID="clock-cancel" /> : <Btn title="Start" onPress={() => { onStart(sec); }} testID="clock-start" />}
          </>
        ) : (
          <>
            <View style={{ alignItems: 'center', justifyContent: 'center', height: SIZE + 30 }}>
              <Text style={{ fontSize: 52, color: colors.text, fontVariant: ['tabular-nums'] }} testID="clock-stopwatch">{fmtStopwatch(ms)}</Text>
            </View>
            {sw.startedAt ? (
              <Btn title="Stop" variant="secondary" onPress={() => setSw({ acc: swMs(sw, Date.now()), startedAt: null })} testID="clock-sw-stop" />
            ) : (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {sw.acc > 0 && <Btn title="Reset" variant="secondary" style={{ flex: 1 }} onPress={() => setSw({ acc: 0, startedAt: null })} testID="clock-sw-reset" />}
                <Btn title={sw.acc > 0 ? 'Resume' : 'Start'} style={{ flex: 1 }} onPress={() => setSw({ acc: sw.acc, startedAt: Date.now() })} testID="clock-sw-start" />
              </View>
            )}
          </>
        )}
      </View>
    </Sheet>
  );
}
