import type { MenuItem } from './types';

const sameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** True when this item's rate has not been set (or confirmed) today. */
export function isRateStale(item: Pick<MenuItem, 'rateUpdatedAt'>, now: Date = new Date()): boolean {
  return item.rateUpdatedAt === null || !sameLocalDay(item.rateUpdatedAt, now);
}

/** The items on sale whose rate is not yet set for today. */
export function itemsNeedingRate<T extends Pick<MenuItem, 'rateUpdatedAt' | 'active'>>(items: T[], now: Date = new Date()): T[] {
  return items.filter((item) => item.active && isRateStale(item, now));
}
