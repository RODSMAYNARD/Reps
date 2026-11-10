import type { ImageSourcePropType } from 'react-native';

/** Ícones 3D originais (gerados por `scripts/icons/`), com o círculo branco já desenhado no PNG. */
const EQUIP_IMG: Record<string, ImageSourcePropType> = {
  adjbench: require('../../assets/icons/equipment/adjbench.png'),
  band: require('../../assets/icons/equipment/band.png'),
  barbell: require('../../assets/icons/equipment/barbell.png'),
  battlerope: require('../../assets/icons/equipment/battlerope.png'),
  bench: require('../../assets/icons/equipment/bench.png'),
  bike: require('../../assets/icons/equipment/bike.png'),
  bodyweight: require('../../assets/icons/equipment/bodyweight.png'),
  cable: require('../../assets/icons/equipment/cable.png'),
  dipbar: require('../../assets/icons/equipment/dipbar.png'),
  dumbbell: require('../../assets/icons/equipment/dumbbell.png'),
  elliptical: require('../../assets/icons/equipment/elliptical.png'),
  ezbar: require('../../assets/icons/equipment/ezbar.png'),
  jumprope: require('../../assets/icons/equipment/jumprope.png'),
  kettlebell: require('../../assets/icons/equipment/kettlebell.png'),
  landmine: require('../../assets/icons/equipment/landmine.png'),
  legpress: require('../../assets/icons/equipment/legpress.png'),
  machine: require('../../assets/icons/equipment/machine.png'),
  medball: require('../../assets/icons/equipment/medball.png'),
  plate: require('../../assets/icons/equipment/plate.png'),
  platemachine: require('../../assets/icons/equipment/platemachine.png'),
  pullup: require('../../assets/icons/equipment/pullup.png'),
  rack: require('../../assets/icons/equipment/rack.png'),
  rings: require('../../assets/icons/equipment/rings.png'),
  rower: require('../../assets/icons/equipment/rower.png'),
  smith: require('../../assets/icons/equipment/smith.png'),
  stairs: require('../../assets/icons/equipment/stairs.png'),
  suspension: require('../../assets/icons/equipment/suspension.png'),
  trapbar: require('../../assets/icons/equipment/trapbar.png'),
  treadmill: require('../../assets/icons/equipment/treadmill.png'),
};

/** Outros nomes que apontam para o mesmo desenho (ids dos filtros, do Trainer e nomes de `GymIcon`). */
const EQUIP_ALIAS: Record<string, string> = {
  none: 'bodyweight', ball: 'medball', walk: 'elliptical', flatbench: 'bench', tbar: 'landmine', airbike: 'bike', spin: 'bike',
  cable1: 'cable', cable2: 'cable', latpull: 'cable', stack: 'machine', platem: 'platemachine', susp: 'suspension', rope: 'battlerope',
};

const MUSCLE_IMG: Record<string, ImageSourcePropType> = {
  abductors: require('../../assets/icons/muscles/abductors.png'),
  abs: require('../../assets/icons/muscles/abs.png'),
  adductors: require('../../assets/icons/muscles/adductors.png'),
  biceps: require('../../assets/icons/muscles/biceps.png'),
  calves: require('../../assets/icons/muscles/calves.png'),
  cardio: require('../../assets/icons/muscles/cardio.png'),
  chest: require('../../assets/icons/muscles/chest.png'),
  forearms: require('../../assets/icons/muscles/forearms.png'),
  fullbody: require('../../assets/icons/muscles/fullbody.png'),
  glutes: require('../../assets/icons/muscles/glutes.png'),
  hamstrings: require('../../assets/icons/muscles/hamstrings.png'),
  lats: require('../../assets/icons/muscles/lats.png'),
  lowerback: require('../../assets/icons/muscles/lowerback.png'),
  neck: require('../../assets/icons/muscles/neck.png'),
  quads: require('../../assets/icons/muscles/quads.png'),
  shoulders: require('../../assets/icons/muscles/shoulders.png'),
  traps: require('../../assets/icons/muscles/traps.png'),
  triceps: require('../../assets/icons/muscles/triceps.png'),
  upperback: require('../../assets/icons/muscles/upperback.png'),
};

/** Nome do grupo muscular na tela (filtros e "Create Exercise") → desenho. */
const MUSCLE_BY_LABEL: Record<string, string> = {
  Abdominals: 'abs', Abductors: 'abductors', Adductors: 'adductors', Biceps: 'biceps', Calves: 'calves', Cardio: 'cardio', Chest: 'chest',
  Forearms: 'forearms', 'Full Body': 'fullbody', Glutes: 'glutes', Hamstrings: 'hamstrings', Lats: 'lats', 'Lower Back': 'lowerback',
  Neck: 'neck', Quadriceps: 'quads', Shoulders: 'shoulders', Traps: 'traps', Triceps: 'triceps', 'Upper Back': 'upperback',
};

/** Equipamento por id/nome; `undefined` = "Other" (três pontos). */
export const equipImage = (key?: string | null) => (key ? EQUIP_IMG[key] ?? EQUIP_IMG[EQUIP_ALIAS[key]] : undefined);
/** Grupo muscular pelo nome mostrado; `undefined` = "Other". */
export const muscleImage = (label?: string | null) => (label ? MUSCLE_IMG[MUSCLE_BY_LABEL[label]] : undefined);
