import { muscleImage } from '../lib/iconImages';
import { IconCircle } from './IconCircle';

/** Miniatura do grupo muscular (nome como aparece na tela): boneco 3D com o músculo em azul; "Other" = três pontos. */
export function MuscleTile({ label, size = 56 }: { label: string; size?: number }) {
  return <IconCircle source={muscleImage(label)} size={size} />;
}
