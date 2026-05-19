export const ISO_DATE_LENGTH = 10;

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function isHoliday974(date: Date, holidays: Set<string>): boolean {
  return holidays.has(toIsoDate(date));
}
