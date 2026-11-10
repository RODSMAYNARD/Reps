import { Ionicons } from '@expo/vector-icons';
import { Image, View, type ImageSourcePropType } from 'react-native';

/** Ícone 3D de equipamento ou músculo num círculo branco (claro e escuro iguais). O círculo já vem no PNG,
 * então nada é recortado aqui; sem imagem = "Other" (três pontos). */
export function IconCircle({ source, size = 56 }: { source?: ImageSourcePropType; size?: number }) {
  if (!source) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(16,24,40,0.10)', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="ellipsis-horizontal" size={size * 0.38} color="#8A9099" />
      </View>
    );
  }
  return <Image source={source} style={{ width: size, height: size }} />;
}
