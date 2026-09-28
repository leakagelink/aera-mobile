import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const compact = width < 380;
  const wide = width >= 720;
  const gutter = compact ? 16 : 20;
  const short = height < 520;
  const mapHeight = Math.round(Math.min(400, Math.max(short ? 168 : 210, height * (short ? 0.4 : 0.32))));

  return {
    width,
    height,
    compact,
    wide,
    gutter,
    maxContent: 760,
    metricColumns: wide ? 4 : 2,
    mapHeight,
    tabClearance: 108,
  };
}
