import { t, type MessageKey } from '@/i18n';

export function instructionFor(type: string, modifier: string | undefined, name: string | undefined): string {
  const road = name?.trim();
  const roadBit = road ? t('turn.road', { road }) : '';
  const turn = turnLabel(modifier);

  switch (type) {
    case 'depart':
      return road ? t('turn.departRoad', { road }) : t('turn.depart');
    case 'arrive':
      return road ? t('turn.arriveRoad', { road }) : t('turn.arrive');
    case 'turn':
    case 'end of road':
      return `${turn}${roadBit}`;
    case 'new name':
    case 'continue':
      return road ? t('turn.straightRoad', { road }) : t('navi.straight');
    case 'merge':
      return t('turn.merge', { road: roadBit });
    case 'on ramp':
      return t('turn.ramp', { road: roadBit });
    case 'off ramp':
      return t('turn.exit', { road: roadBit });
    case 'fork':
      return `${turn === t('turn.ahead') ? t('maneuver.fork') : turn}${roadBit}`;
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return road ? t('turn.roundaboutRoad', { road }) : t('turn.roundabout');
    case 'exit roundabout':
    case 'exit rotary':
      return t('turn.exitRoundabout', { road: roadBit });
    default:
      return road ? t('turn.straightRoad', { road }) : t('turn.ahead');
  }
}

function turnLabel(modifier: string | undefined): string {
  const mod = (modifier ?? '').toLowerCase().replace(/-/g, ' ');
  if (!mod) return t('turn.ahead');
  if (mod.includes('uturn')) return t('turn.uturn');
  if (mod.includes('slight') && mod.includes('left')) return t('turn.slightLeft');
  if (mod.includes('slight') && mod.includes('right')) return t('turn.slightRight');
  if (mod.includes('sharp') && mod.includes('left')) return t('turn.sharpLeft');
  if (mod.includes('sharp') && mod.includes('right')) return t('turn.sharpRight');
  if (mod.includes('left')) return t('turn.left');
  if (mod.includes('right')) return t('turn.right');
  return t('turn.ahead');
}

export function limitCopy(note: string | null | undefined): string | null {
  if (!note) return null;
  const keys: MessageKey[] = [
    'limit.unsupportedBoth',
    'limit.unsupportedToll',
    'limit.unsupportedHighway',
    'limit.appliedBoth',
    'limit.appliedToll',
    'limit.appliedHighway',
  ];
  if (keys.includes(note as MessageKey)) return t(note as MessageKey);
  return note;
}

export function routeLabel(label: string): string {
  if (label === 'route.this') return t('route.this');
  const match = /^route\.other:(\d+)$/.exec(label);
  if (match?.[1]) return t('route.other', { n: match[1] });
  return label;
}
