import { View } from 'react-native';
import Svg, { Line, Polygon } from 'react-native-svg';
import { PlainText, Text } from './Text';
import { tr } from '../lib/i18n';
import { CAT_BY_ID } from '../lib/catalog';
import { exerciseOf } from '../lib/stats';
import { colors } from '../lib/theme';
import type { Workout } from '../lib/types';

/** Os 6 grupos do radar, na ordem do desenho (como no Hevy): Costas e Peito em cima, Core à direita, Ombros e Braços embaixo, Pernas à esquerda. */
export const RADAR_GROUPS = ['Back', 'Chest', 'Core', 'Shoulders', 'Arms', 'Legs'] as const;
export type RadarGroup = (typeof RADAR_GROUPS)[number];
// ângulo de cada eixo (graus, y para baixo): 240 = em cima à esquerda, 300 = em cima à direita, 0 = direita, 60/120 = embaixo, 180 = esquerda
const ANGLES = [240, 300, 0, 60, 120, 180];

/** Grupo do radar de um músculo (primário do catálogo ou secundário, ex.: "Lower back", "Obliques", "Rear deltoids"). */
export function radarGroupOf(muscle: string): RadarGroup | null {
  const m = muscle.toLowerCase();
  if (/chest|pector/.test(m)) return 'Chest';
  if (/back|lat|trap|rhomb|teres/.test(m)) return 'Back';
  if (/shoulder|delt|rotator/.test(m)) return 'Shoulders';
  if (/bicep|tricep|forearm|brachi|wrist|grip/.test(m)) return 'Arms';
  if (/abs|oblique|core|abdom|serratus|hip flexor/.test(m)) return 'Core';
  if (/quad|hamstring|glute|calf|calves|adductor|abductor|shin|tibia|leg|thigh/.test(m)) return 'Legs';
  return null;
}

/** Séries concluídas por grupo (aquecimento incluído). Cada série conta 1 para o grupo do músculo principal e 1 para cada
 * outro grupo dos músculos secundários (o mesmo grupo não conta duas vezes no mesmo exercício). */
export function radarSets(workouts: Workout[]) {
  const out: Record<RadarGroup, number> = { Back: 0, Chest: 0, Core: 0, Shoulders: 0, Arms: 0, Legs: 0 };
  for (const w of workouts) for (const e of w.entries) {
    const ex = exerciseOf(e.exerciseId);
    if (!ex) continue;
    const cat = ex.catalogId ? CAT_BY_ID.get(ex.catalogId) : undefined;
    const groups = new Set<RadarGroup>();
    for (const m of [ex.muscle, ...(cat?.s ?? ex.secondary ?? [])]) { const g = radarGroupOf(m); if (g) groups.add(g); }
    for (const g of groups) out[g] += e.sets.length;
  }
  return out;
}

/** Radar (teia) com o período atual (azul, preenchido) e o anterior (cinza). Escala = maior valor dos dois. */
export function MuscleRadar({ cur, prev, size = 260 }: { cur: Record<RadarGroup, number>; prev: Record<RadarGroup, number>; size?: number }) {
  const pad = 46; // espaço para os nomes dos grupos
  const W = size + pad * 2, H = size + 24;
  const cx = W / 2, cy = H / 2, R = size / 2 - 6;
  const max = Math.max(1, ...RADAR_GROUPS.map((g) => Math.max(cur[g], prev[g])));
  const pt = (i: number, f: number) => { const a = (ANGLES[i] * Math.PI) / 180; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f] as const; };
  const poly = (vals: Record<RadarGroup, number>) => RADAR_GROUPS.map((g, i) => pt(i, vals[g] / max).join(',')).join(' ');
  return (
    <View style={{ alignItems: 'center' }} testID="muscle-radar">
      <View style={{ width: W, height: H }}>
        <Svg width={W} height={H}>
          {[0.2, 0.4, 0.6, 0.8, 1].map((f) => <Polygon key={f} points={RADAR_GROUPS.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke={colors.border} strokeWidth={1} />)}
          {RADAR_GROUPS.map((_, i) => { const [x, y] = pt(i, 1); return <Line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={colors.border} strokeWidth={1} />; })}
          <Polygon points={poly(prev)} fill={colors.muted} fillOpacity={0.35} stroke={colors.muted} strokeWidth={1.5} />
          <Polygon points={poly(cur)} fill={colors.primary} fillOpacity={0.28} stroke={colors.primary} strokeWidth={2} />
        </Svg>
        {RADAR_GROUPS.map((g, i) => {
          const [x, y] = pt(i, 1.16);
          // PlainText + chave própria: "Back" sozinho no dicionário é o botão "Voltar"
          return <PlainText key={g} style={{ position: 'absolute', left: x - 50, top: y - 9, width: 100, textAlign: 'center', fontSize: 13, color: colors.muted }}>{tr(g === 'Back' ? 'Back (muscle group)' : g)}</PlainText>;
        })}
      </View>
      <View style={{ flexDirection: 'row', alignSelf: 'flex-end', gap: 14, marginTop: 2 }}>
        {[['Current', colors.primary], ['Previous', colors.muted]].map(([l, c]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: c }} />
            <Text style={{ fontSize: 12, color: colors.muted }}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
