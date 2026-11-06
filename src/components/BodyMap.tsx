import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

/** Boneco de músculos (frente e costas) com os trabalhados pintados.
 * Desenho do `react-native-body-highlighter` (MIT, © ELABBASSI Hicham), não do Hevy. */
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

// A biblioteca não separa dorsais das costas altas: os dois acendem "upper-back".
const SLUGS: Record<Region, Slug[]> = {
  chest: ['chest'], delts: ['deltoids'], biceps: ['biceps'], forearms: ['forearm'], abs: ['abs'], obliques: ['obliques'],
  quads: ['quadriceps'], adductors: ['adductors'], calves: ['calves', 'tibialis'], traps: ['trapezius'], upperback: ['upper-back'],
  lats: ['upper-back'], lowerback: ['lower-back'], triceps: ['triceps'], glutes: ['gluteal'], hamstrings: ['hamstring'],
};

type Colors = { body: string; muscle: string; on: string };

export function BodyMap({ side, primary, secondary = [], width = 70, colors: c }: { side: 'front' | 'back'; primary: Region[]; secondary?: Region[]; width?: number; colors: Colors }) {
  const on = new Set(primary.flatMap((r) => SLUGS[r]));
  const half = new Set(secondary.flatMap((r) => SLUGS[r]).filter((s) => !on.has(s)));
  const data: ExtendedBodyPart[] = [...[...on].map((slug) => ({ slug, intensity: 1 })), ...[...half].map((slug) => ({ slug, intensity: 2 }))];
  return (
    <Body
      data={data}
      side={side}
      scale={width / 200}
      colors={[c.on, `${c.on}80`]}
      defaultFill={c.muscle}
      defaultStroke={c.body}
      defaultStrokeWidth={4}
      border={c.body}
    />
  );
}
