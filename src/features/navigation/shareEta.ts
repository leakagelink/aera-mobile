import { Share } from 'react-native';

import { t } from '@/i18n';
import { formatDistance, formatDuration, type UnitSystem } from '@/utils/format';

export async function shareEta(input: { destination: string; seconds: number; meters: number; units: UnitSystem; arrived?: boolean }) {
  const message = input.arrived
    ? t('share.arrived', { place: input.destination })
    : t('share.eta', { place: input.destination, time: formatDuration(input.seconds), distance: formatDistance(input.meters, input.units) });
  await Share.share({ message });
}
