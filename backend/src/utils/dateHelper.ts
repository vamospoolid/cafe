/**
 * Backend Date Helper: Timezone-aware date conversion for PostgreSQL / SQLite queries.
 * Converts local date strings (YYYY-MM-DD) or ranges to exact UTC timestamps.
 */

/**
 * Returns UTC start and end Date objects corresponding to a given local date string.
 * @param dateStr e.g. "2026-09-15"
 * @param tzOffsetMinutes timezone offset from client (e.g. -420 for UTC+7 WIB, -480 for UTC+8 WITA). Default -420 (WIB).
 */
export function getLocalDateRange(dateStr: string, tzOffsetMinutes?: number | string) {
  let offset = -420; // Default to UTC+7 (Indonesia WIB)
  if (tzOffsetMinutes !== undefined && tzOffsetMinutes !== null && tzOffsetMinutes !== '') {
    const parsed = parseInt(String(tzOffsetMinutes), 10);
    if (!isNaN(parsed)) {
      offset = parsed;
    }
  }

  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  // Local 00:00:00.000 in UTC timestamp
  const startUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) + (offset * 60 * 1000));
  // Local 23:59:59.999 in UTC timestamp
  const endUtc = new Date(Date.UTC(year, month, day, 23, 59, 59, 999) + (offset * 60 * 1000));

  return { startUtc, endUtc };
}

/**
 * Returns UTC start and end Date objects for a date range (startDate to endDate).
 */
export function getCustomDateRange(startDateStr: string, endDateStr: string, tzOffsetMinutes?: number | string) {
  const { startUtc } = getLocalDateRange(startDateStr, tzOffsetMinutes);
  const { endUtc } = getLocalDateRange(endDateStr, tzOffsetMinutes);
  return { startUtc, endUtc };
}

/**
 * Returns the current date formatted as YYYYMMDD in the local timezone for order number generation.
 */
export function getLocalOrderDatePrefix(tzOffsetMinutes: number = -420): string {
  const now = new Date();
  // Adjust UTC time by timezone offset (offset is negative for positive UTC zones, e.g., -420 min for UTC+7)
  const localTime = new Date(now.getTime() - (tzOffsetMinutes * 60 * 1000));
  const year = localTime.getUTCFullYear();
  const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(localTime.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
