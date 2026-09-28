import { Children, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useResponsive } from '@/theme/useResponsive';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function MetricGrid({ children, style }: Props) {
  const { metricColumns } = useResponsive();
  const items = Children.toArray(children);

  return (
    <View style={[styles.grid, style]}>
      {items.map((child, index) => (
        <View key={index} style={{ width: `${100 / metricColumns}%`, paddingHorizontal: 4, paddingBottom: 8 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
