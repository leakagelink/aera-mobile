import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

const logo = require('../../../assets/images/icon.png');

export function LogoMark({ large = false }: { large?: boolean }) {
  const size = large ? 112 : 48;
  return (
    <Image
      source={logo}
      accessibilityLabel="Arah"
      contentFit="cover"
      style={[styles.mark, { width: size, height: size, borderRadius: Math.round(size * 0.22) }]}
    />
  );
}

const styles = StyleSheet.create({
  mark: { overflow: 'hidden' },
});
