import { SvgXml } from 'react-native-svg';
import { GYM_ICONS, type GymIcon as GymIconName } from '../lib/gymIcons';

export function GymIcon({ name, size = 28, color }: { name: GymIconName; size?: number; color: string }) {
  return <SvgXml xml={GYM_ICONS[name]} width={size} height={size} color={color} />;
}
