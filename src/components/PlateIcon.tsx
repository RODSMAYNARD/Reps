import Svg, { Line, Rect } from 'react-native-svg';

/** Ícone da calculadora de anilhas: "±" ao lado de uma anilha na barra. Desenho do Reps. */
export function PlateIcon({ size = 24, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round">
      <Line x1={1.8} y1={6} x2={6.8} y2={6} />
      <Line x1={4.3} y1={3.5} x2={4.3} y2={8.5} />
      <Line x1={1.8} y1={16} x2={6.8} y2={16} />
      <Rect x={10} y={3} width={5.5} height={18} rx={2} />
      <Rect x={15.5} y={7} width={3.5} height={10} rx={1.5} />
    </Svg>
  );
}
