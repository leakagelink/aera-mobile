export function instructionFor(type: string, modifier: string | undefined, name: string | undefined): string {
  const road = name?.trim();
  const par = road ? `, ${road} par` : '';
  const turn = turnLabel(modifier);

  switch (type) {
    case 'depart':
      return road ? `${road} par nikalna` : 'Seedha nikalna';
    case 'arrive':
      return road ? `${road} par pahunch gaye` : 'Pahunch gaye';
    case 'turn':
    case 'end of road':
      return `${turn}${par}`;
    case 'new name':
    case 'continue':
      return road ? `Seedha, ${road} par` : 'Seedha chalte raho';
    case 'merge':
      return `Merge hona${par}`;
    case 'on ramp':
      return `Ramp lena${par}`;
    case 'off ramp':
      return `Exit lena${par}`;
    case 'fork':
      return `${turn === 'Seedha' ? 'Apni side rakhna' : turn}${par}`;
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return road ? `Gol chakkar lena, ${road}` : 'Gol chakkar lena';
    case 'exit roundabout':
    case 'exit rotary':
      return `Gol chakkar se nikalna${par}`;
    default:
      return road ? `Seedha, ${road} par` : 'Seedha';
  }
}

function turnLabel(modifier: string | undefined): string {
  const mod = (modifier ?? '').toLowerCase().replace(/-/g, ' ');
  if (!mod) return 'Seedha';
  if (mod.includes('uturn')) return 'Wapas mudna';
  if (mod.includes('slight') && mod.includes('left')) return 'Thoda left';
  if (mod.includes('slight') && mod.includes('right')) return 'Thoda right';
  if (mod.includes('sharp') && mod.includes('left')) return 'Tez left';
  if (mod.includes('sharp') && mod.includes('right')) return 'Tez right';
  if (mod.includes('left')) return 'Left';
  if (mod.includes('right')) return 'Right';
  return 'Seedha';
}
