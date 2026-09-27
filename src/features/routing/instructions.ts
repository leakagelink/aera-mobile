export function instructionFor(type: string, modifier: string | undefined, name: string | undefined): string {
  const road = name?.trim();
  const onto = road ? ` onto ${road}` : '';
  const direction = modifier ? modifier.replace(/-/g, ' ') : '';

  switch (type) {
    case 'depart':
      return road ? `Head onto ${road}` : 'Head out';
    case 'arrive':
      return road ? `Arrive at ${road}` : 'You have arrived';
    case 'turn':
    case 'end of road':
      return direction ? `${capitalize(direction)}${onto}` : `Continue${onto}`;
    case 'new name':
    case 'continue':
      return road ? `Continue onto ${road}` : 'Continue straight';
    case 'merge':
      return `Merge${onto}`;
    case 'on ramp':
      return `Take the ramp${onto}`;
    case 'off ramp':
      return `Take the exit${onto}`;
    case 'fork':
      return direction ? `Keep ${direction}${onto}` : `Keep ahead${onto}`;
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return road ? `Enter the roundabout and take ${road}` : 'Enter the roundabout';
    case 'exit roundabout':
    case 'exit rotary':
      return `Exit the roundabout${onto}`;
    default:
      return road ? `Continue onto ${road}` : 'Continue';
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
