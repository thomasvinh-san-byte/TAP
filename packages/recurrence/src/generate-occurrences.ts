import { parseRRule } from './rrule-helper';
import { isHoliday974, toIsoDate } from './holidays-974';

export interface GenerateOptions {
  rruleStr: string;
  dtstart: Date;
  until: Date;
  holidays974: Set<string>;
  excludedDates?: Set<string>;
}

export function generateOccurrences(opts: GenerateOptions): Date[] {
  const rule = parseRRule(opts.rruleStr, opts.dtstart);
  const all = rule.between(opts.dtstart, opts.until, true);
  return all.filter((d) => {
    if (isHoliday974(d, opts.holidays974)) return false;
    if (opts.excludedDates && opts.excludedDates.has(toIsoDate(d))) return false;
    return true;
  });
}
