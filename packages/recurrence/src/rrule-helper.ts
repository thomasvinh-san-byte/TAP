import { rrulestr, type RRule } from 'rrule';

export function parseRRule(rruleStr: string, dtstart: Date): RRule {
  try {
    return rrulestr(rruleStr, { dtstart }) as RRule;
  } catch (error) {
    throw new Error('RRULE invalide', { cause: error });
  }
}
