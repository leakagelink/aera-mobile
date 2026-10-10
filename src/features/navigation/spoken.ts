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
  if (input.arrived || input.maneuverType === 'arrive') {
    const place = input.destinationName.trim();
    return { id: 'arrived', phrase: place ? `dekh, pahunch gaye. ${place}` : 'dekh, pahunch gaye' };
  }
  if (input.offRoute) {
    return { id: 'off-route', phrase: 'rasta chhoot gaya. naya rasta nikal raha hoon' };
  }
  const road = input.roadName?.trim();
  const step = `${input.maneuverType ?? ''}|${input.maneuverModifier ?? ''}|${road ?? ''}`;
  if (!isTurn(input.maneuverType, input.maneuverModifier)) {
    const phrase = road && road.length <= 40 ? `dekh, seedha chalte raho, ${road} par` : 'dekh, seedha chalte raho';
    return { id: `straight|${step}`, phrase };
  }
  const band = distanceBand(input.distanceMeters);
  const when = distanceWords(input.distanceMeters);
  const action = maneuverWords(input.maneuverType, input.maneuverModifier);
  const roadBit = road && road.length <= 40 ? `, ${road} par` : '';
  const phrase = when === 'abhi' ? `dekh, abhi ${action}${roadBit}` : `dekh, ${when} ${action}${roadBit}`;
  return { id: `${step}|${band}`, phrase };
}

function distanceBand(meters: number): number {
  if (meters <= 50) return 50;
  if (meters <= 220) return 200;
  if (meters <= 1100) return 1000;
  return 0;
}

function distanceWords(meters: number): string {
  if (meters < 40) return 'abhi';
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return `${text} kilometer baad`;
  }
  const rounded = meters >= 150 ? Math.round(meters / 50) * 50 : Math.max(10, Math.round(meters / 10) * 10);
  return `${rounded} meter baad`;
}

function isTurn(type?: string, modifier?: string): boolean {
  if (type === 'arrive' || type === 'depart' || type === 'continue' || type === 'new name') return false;
  if (modifier && /left|right|uturn/i.test(modifier)) return true;
  return ['turn', 'end of road', 'fork', 'on ramp', 'off ramp', 'roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary', 'merge'].includes(type ?? '');
}

function maneuverWords(type?: string, modifier?: string): string {
  const mod = (modifier ?? '').toLowerCase();
  if (mod.includes('uturn')) return 'wapas mudna';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'gol chakkar lena';
  if (type === 'exit roundabout' || type === 'exit rotary') return 'gol chakkar se nikalna';
  if (type === 'on ramp') return 'ramp lena';
  if (type === 'off ramp') return 'exit lena';
  if (type === 'merge') return 'merge hona';
  if (mod.includes('slight') && mod.includes('left')) return 'thoda left lena';
  if (mod.includes('slight') && mod.includes('right')) return 'thoda right lena';
  if (mod.includes('sharp') && mod.includes('left')) return 'tez left lena';
  if (mod.includes('sharp') && mod.includes('right')) return 'tez right lena';
  if (mod.includes('left')) return 'left lena';
  if (mod.includes('right')) return 'right lena';
  if (type === 'fork') return 'apni side rakhna';
  return 'seedha chalna';
}
