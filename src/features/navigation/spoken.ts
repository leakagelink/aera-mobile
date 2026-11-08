import { t } from '@/i18n';

export type SpokenInput = {
  arrived: boolean;
  offRoute: boolean;
  distanceMeters: number;
  maneuverType?: string;
  maneuverModifier?: string;
  roadName?: string;
  destinationName: string;
};

export function spokenCue(input: SpokenInput): { id: string; phrase: string } | null {
  if (input.arrived || (input.maneuverType === 'arrive' && input.distanceMeters < 40)) {
    const place = input.destinationName.trim();
    return { id: 'arrived', phrase: place ? t('cue.arrived', { place }) : t('cue.arrivedPlain') };
  }
  if (input.offRoute) {
    return { id: 'off-route', phrase: t('cue.off') };
  }
  const road = input.roadName?.trim();
  const step = `${input.maneuverType ?? ''}|${input.maneuverModifier ?? ''}|${road ?? ''}`;
  if (!isTurn(input.maneuverType, input.maneuverModifier)) {
    const phrase = road && road.length <= 40 ? t('cue.straightRoad', { road }) : t('cue.straight');
    return { id: `straight|${step}`, phrase };
  }
  const band = distanceBand(input.distanceMeters);
  const when = distanceWords(input.distanceMeters);
  const action = maneuverWords(input.maneuverType, input.maneuverModifier);
  const roadBit = road && road.length <= 40 ? t('cue.onRoad', { road }) : '';
  const phrase = when === 'now' ? t('cue.now', { action, road: roadBit }) : t('cue.later', { when, action, road: roadBit });
  return { id: `${step}|${band}`, phrase };
}

function distanceBand(meters: number): number {
  if (meters <= 50) return 50;
  if (meters <= 220) return 200;
  if (meters <= 1100) return 1000;
  return 0;
}

function distanceWords(meters: number): string {
  if (meters < 40) return 'now';
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return t('cue.km', { km: text });
  }
  const rounded = meters >= 150 ? Math.round(meters / 50) * 50 : Math.max(10, Math.round(meters / 10) * 10);
  return t('cue.m', { meters: rounded });
}

function isTurn(type?: string, modifier?: string): boolean {
  if (type === 'arrive' || type === 'depart' || type === 'continue' || type === 'new name') return false;
  if (modifier === 'straight' || modifier === 'ahead') return false;
  if (modifier && /left|right|uturn/i.test(modifier)) return true;
  return ['turn', 'end of road', 'fork', 'on ramp', 'off ramp', 'roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary', 'merge'].includes(type ?? '');
}

function maneuverWords(type?: string, modifier?: string): string {
  const mod = (modifier ?? '').toLowerCase();
  if (mod.includes('uturn')) return t('maneuver.uturn');
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return t('maneuver.roundabout');
  if (type === 'exit roundabout' || type === 'exit rotary') return t('maneuver.exitRoundabout');
  if (type === 'on ramp') return t('maneuver.ramp');
  if (type === 'off ramp') return t('maneuver.exit');
  if (type === 'merge') return t('maneuver.merge');
  if (mod.includes('slight') && mod.includes('left')) return t('maneuver.slightLeft');
  if (mod.includes('slight') && mod.includes('right')) return t('maneuver.slightRight');
  if (mod.includes('sharp') && mod.includes('left')) return t('maneuver.sharpLeft');
  if (mod.includes('sharp') && mod.includes('right')) return t('maneuver.sharpRight');
  if (mod.includes('left')) return t('maneuver.left');
  if (mod.includes('right')) return t('maneuver.right');
  if (type === 'fork') return t('maneuver.fork');
  return t('maneuver.ahead');
}
