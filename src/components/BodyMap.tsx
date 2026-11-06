import Svg, { Ellipse, G, Line, Path, Rect } from 'react-native-svg';

/** Boneco próprio (frente e costas) com os músculos trabalhados pintados. Desenho do Reps, sem imagens de terceiros. */
export type Region = 'chest' | 'delts' | 'biceps' | 'forearms' | 'abs' | 'obliques' | 'quads' | 'adductors' | 'calves' | 'traps' | 'upperback' | 'lats' | 'lowerback' | 'triceps' | 'glutes' | 'hamstrings';
const ALL: Region[] = ['chest', 'delts', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'adductors', 'calves', 'traps', 'upperback', 'lats', 'lowerback', 'triceps', 'glutes', 'hamstrings'];

const MAP: [RegExp, Region[]][] = [
  [/full body/i, ALL],
  [/chest|pector|serratus/i, ['chest']],
  [/rear delt|deltoid|shoulder|rotator/i, ['delts']],
  [/bicep|brachialis/i, ['biceps']],
  [/forearm|wrist|grip|hand/i, ['forearms']],
  [/oblique/i, ['obliques']],
  [/abs|abdominal|core|hip flexor/i, ['abs']],
  [/quad/i, ['quads']],
  [/adductor|inner thigh|groin/i, ['adductors']],
  [/abductor|glute/i, ['glutes']],
  [/calv|soleus|shin|ankle|feet/i, ['calves']],
  [/trap|levator|sternocleido|neck/i, ['traps']],
  [/upper back|rhomboid/i, ['upperback']],
  [/lats|latissimus/i, ['lats']],
  [/lower back|spine/i, ['lowerback']],
  [/^back$/i, ['lats', 'upperback']],
  [/tricep/i, ['triceps']],
  [/hamstring/i, ['hamstrings']],
];
export const regionsOf = (muscle?: string | null): Region[] => {
  if (!muscle) return [];
  for (const [re, r] of MAP) if (re.test(muscle)) return r;
  return [];
};

type Colors = { body: string; muscle: string; on: string };
const both = (cx: number, el: (x: number, flip: boolean) => React.ReactNode) => <>{el(cx, false)}{el(100 - cx, true)}</>;

function Base({ c }: { c: Colors }) {
  return (
    <G>
      <Ellipse cx={50} cy={15} rx={9.5} ry={11.5} fill={c.body} />
      <Rect x={45} y={24} width={10} height={10} fill={c.body} />
      <Path d="M35 36 Q50 31 65 36 L67 50 Q63 72 61 94 L63 106 L37 106 L39 94 Q37 72 33 50 Z" fill={c.body} />
      {both(31, (x, f) => <G key={`a${f}`}><Line x1={x} y1={41} x2={f ? x + 5 : x - 5} y2={72} stroke={c.body} strokeWidth={11} strokeLinecap="round" /><Line x1={f ? x + 5 : x - 5} y1={72} x2={f ? x + 9 : x - 9} y2={101} stroke={c.body} strokeWidth={9} strokeLinecap="round" /><Ellipse cx={f ? x + 10 : x - 10} cy={108} rx={4} ry={6} fill={c.body} /></G>)}
      {both(43, (x, f) => <G key={`l${f}`}><Line x1={x} y1={104} x2={x - (f ? -1 : 1)} y2={152} stroke={c.body} strokeWidth={16} strokeLinecap="round" /><Line x1={x - (f ? -1 : 1)} y1={152} x2={x - (f ? -2 : 2)} y2={192} stroke={c.body} strokeWidth={11} strokeLinecap="round" /><Ellipse cx={x - (f ? -3 : 3)} cy={198} rx={6} ry={3.5} fill={c.body} /></G>)}
    </G>
  );
}

export function BodyMap({ side, primary, secondary = [], width = 70, colors: c }: { side: 'front' | 'back'; primary: Region[]; secondary?: Region[]; width?: number; colors: Colors }) {
  const fill = (r: Region) => (primary.includes(r) ? c.on : secondary.includes(r) ? c.on : c.muscle);
  const op = (r: Region) => (!primary.includes(r) && secondary.includes(r) ? 0.5 : 1);
  const p = (r: Region, d: string, k?: string) => <Path key={k ?? r + d} d={d} fill={fill(r)} fillOpacity={op(r)} />;
  const e = (r: Region, cx: number, cy: number, rx: number, ry: number, rot = 0) => both(cx, (x, f) => <Ellipse key={`${r}${f}`} cx={x} cy={cy} rx={rx} ry={ry} fill={fill(r)} fillOpacity={op(r)} transform={rot ? `rotate(${f ? -rot : rot} ${x} ${cy})` : undefined} />);
  return (
    <Svg width={width} height={width * 2.05} viewBox="0 0 100 205">
      <Base c={c} />
      {side === 'front' ? (
        <G>
          {p('traps', 'M44 30 L37 37 L45 36 Z', 'tl')}{p('traps', 'M56 30 L63 37 L55 36 Z', 'tr')}
          {e('delts', 31, 44, 6.5, 8, -15)}
          {p('chest', 'M49.3 38 L39 40 Q34 47 37.5 56 Q44 60 49.3 56 Z', 'cl')}{p('chest', 'M50.7 38 L61 40 Q66 47 62.5 56 Q56 60 50.7 56 Z', 'cr')}
          {e('biceps', 27.5, 60, 4.6, 10, 10)}
          {e('forearms', 23.5, 86, 4, 12, 10)}
          {p('abs', 'M43.5 60 Q50 58 56.5 60 L56 90 Q50 95 44 90 Z')}
          {p('obliques', 'M38.5 61 L42.5 62 L43 88 L40 86 Q38 74 38.5 61 Z', 'ol')}{p('obliques', 'M61.5 61 L57.5 62 L57 88 L60 86 Q62 74 61.5 61 Z', 'or')}
          {e('quads', 42, 126, 7.2, 20, 3)}
          {e('adductors', 47.6, 113, 2.4, 9)}
          {e('calves', 41, 172, 4.6, 15, 2)}
        </G>
      ) : (
        <G>
          {p('traps', 'M50 27 L37 38 L50 60 L63 38 Z')}
          {e('delts', 31, 44, 6.5, 8, -15)}
          {p('upperback', 'M42 44 L48 46 L48 58 L44 56 Z', 'ul')}{p('upperback', 'M58 44 L52 46 L52 58 L56 56 Z', 'ur')}
          {p('lats', 'M37 46 Q34 62 42 84 L48 70 L43 58 Z', 'll')}{p('lats', 'M63 46 Q66 62 58 84 L52 70 L57 58 Z', 'lr')}
          {p('lowerback', 'M45 74 L55 74 L56 92 L44 92 Z')}
          {e('triceps', 27.5, 59, 4.6, 10, 10)}
          {e('forearms', 23.5, 86, 4, 12, 10)}
          {e('glutes', 43.5, 104, 7.5, 8.5)}
          {e('hamstrings', 42.3, 131, 6.8, 17, 3)}
          {e('calves', 41.2, 168, 5.6, 13, 2)}
        </G>
      )}
    </Svg>
  );
}
