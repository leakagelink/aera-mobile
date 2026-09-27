import { Text, type TextProps, type TextStyle } from 'react-native';

import { font, type FontWeight } from '@/theme';
import { useTheme } from '@/theme/useTheme';

type Props = TextProps & {
  weight?: FontWeight;
  size?: number;
  color?: string;
  tabular?: boolean;
};

export function AppText({ weight = 'regular', size = 16, color, tabular = false, style, ...props }: Props) {
  const theme = useTheme();
  const textStyle: TextStyle = {
    fontFamily: font[weight],
    fontSize: size,
    color: color ?? theme.colors.foreground,
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };
  return <Text {...props} style={[textStyle, style]} />;
}
