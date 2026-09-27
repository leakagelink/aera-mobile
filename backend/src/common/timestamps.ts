import { ValidatorConstraint, type ValidatorConstraintInterface } from 'class-validator';

const EARLIEST = Date.parse('2000-01-01T00:00:00.000Z');
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time < EARLIEST || time > Date.now() + FUTURE_SKEW_MS) return null;
  return time;
}

@ValidatorConstraint({ name: 'aeraTimestamp', async: false })
export class AeraTimestampConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return parseTimestamp(value) !== null;
  }

  defaultMessage(): string {
    return 'timestamp must be an ISO-8601 time that is not in the future';
  }
}
