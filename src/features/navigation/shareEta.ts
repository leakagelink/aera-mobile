import { Share } from 'react-native';

import { formatDistance, formatDuration, type UnitSystem } from '@/utils/format';

export async function shareEta(input: { destination: string; seconds: number; meters: number; units: UnitSystem; arrived?: boolean }) {
  const message = input.arrived
    ? `Main ${input.destination} pahunch gaya.`
    : `Main ${input.destination} par ${formatDuration(input.seconds)} mein pahunchunga. Baaki ${formatDistance(input.meters, input.units)}.`;
  await Share.share({ message });
}
