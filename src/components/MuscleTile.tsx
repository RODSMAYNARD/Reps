import { View } from 'react-native';
import { colors } from '../lib/theme';
import { BodyMap, regionsOf, type Region } from './BodyMap';
import { GymIcon } from './GymIcon';

const BACK: Region[] = ['traps', 'upperback', 'lats', 'lowerback', 'triceps', 'glutes', 'hamstrings'];

/** Miniatura do músculo: boneco (frente ou costas) com o músculo pintado; Cardio, Full Body e Other usam ícone. */
export function MuscleTile({ muscle, target, on }: { muscle: string; target?: string; on?: boolean }) {
  const box = { width: 56, height: 76, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const };
  const ink = on ? colors.primary : colors.text;
  if (/^cardio$/i.test(muscle)) return <View style={box}><GymIcon name="cardio" size={30} color={ink} /></View>;
  if (/^full ?body$/i.test(muscle)) return <View style={box}><GymIcon name="fullbody" size={30} color={ink} /></View>;
  const regions = regionsOf(target ?? muscle);
  if (!regions.length) return <View style={box}><GymIcon name="other" size={30} color={ink} /></View>;
  const side = regions.some((r) => BACK.includes(r)) ? 'back' : 'front';
  return <View style={box}><BodyMap side={side} primary={regions} width={36} colors={{ body: colors.bodyBase, muscle: colors.bodyMuscle, on: colors.primary }} /></View>;
}
