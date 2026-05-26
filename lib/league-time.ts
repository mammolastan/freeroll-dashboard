// lib/league-time.ts
// Timezone-aware date utilities for OpenBarLeague.
// All functions accept an IANA timezone string (e.g. 'America/New_York').
// DST is handled automatically by the Intl API.

export type LeagueDateFormat = 'full' | 'monthYear' | 'short';
// 'full'      → "Wednesday, January 15, 2025"
// 'monthYear' → "January 2025"
// 'short'     → "7:00 PM"  (time only — for tournament start time display)

/**
 * Returns the current moment as a Date object, with its wall-clock components
 * reflecting the given timezone. Equivalent to "what time is it right now
 * in this league's city."
 */
export function getLeagueNow(timezone: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * Formats a stored ISO date/datetime string for display in the league's timezone.
 *
 * IMPORTANT: Calendar dates from the DB (`DATE` / `YYYY-MM-DD`) must not be parsed
 * as `T00:00:00Z` — in US zones that shows as the previous day. We anchor plain
 * `YYYY-MM-DD` and UTC-midnight ISO (`…T00:00:00Z`) to `T12:00:00Z` before formatting.
 * True timestamps with a non-midnight UTC time are left unchanged.
 *
 * Replaces: formatGameDate(), formatETDate(), formatGameDateET()
 */
function anchorCalendarDateForDisplay(isoString: string): string {
  const trimmed = isoString.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00Z`;
  }
  const utcMidnight = trimmed.match(
    /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.\d+)?(?:Z|[+-]00:00)$/
  );
  if (utcMidnight) {
    return `${utcMidnight[1]}T12:00:00Z`;
  }
  return isoString;
}

export function formatLeagueDate(
  isoString: string,
  timezone: string,
  format: LeagueDateFormat = 'full'
): string {
  const dateString = anchorCalendarDateForDisplay(isoString);
  const date = new Date(dateString);

  const options: Intl.DateTimeFormatOptions = { timeZone: timezone };

  if (format === 'full') {
    options.weekday = 'long';
    options.year = 'numeric';
    options.month = 'long';
    options.day = 'numeric';
  } else if (format === 'monthYear') {
    options.month = 'long';
    options.year = 'numeric';
  } else if (format === 'short') {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  }

  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Returns the start and end of a calendar month in the league's timezone.
 * The returned Dates are proper UTC instants that correspond to the first
 * moment and last moment of that month in the given timezone.
 *
 * Replaces: getMonthDateRange()
 */
export function getLeagueMonthRange(
  timezone: string,
  date: Date = new Date()
): { startOfMonth: Date; endOfMonth: Date } {
  // Get the date components as they appear in the league's timezone
  const parts = getLeagueDateParts(timezone, date);

  // Build start of month: first day, midnight in league timezone
  const startOfMonth = leagueLocalToUTC(timezone, parts.year, parts.month, 1, 0, 0, 0);

  // Build end of month: last day, 23:59:59.999 in league timezone
  // Day 0 of next month = last day of current month
  const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  const endOfMonth = leagueLocalToUTC(timezone, parts.year, parts.month, lastDay, 23, 59, 59, 999);

  return { startOfMonth, endOfMonth };
}

/**
 * Returns the start and end of a calendar quarter in the league's timezone.
 *
 * Replaces: getQuarterDateRange()
 */
export function getLeagueQuarterRange(
  timezone: string,
  quarter: number,
  year: number
): { startOfQuarter: Date; endOfQuarter: Date } {
  const startMonth = (quarter - 1) * 3 + 1; // 1-indexed month
  const endMonth = startMonth + 2;

  const startOfQuarter = leagueLocalToUTC(timezone, year, startMonth, 1, 0, 0, 0);

  // Last day of endMonth
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  const endOfQuarter = leagueLocalToUTC(timezone, year, endMonth, lastDay, 23, 59, 59, 999);

  return { startOfQuarter, endOfQuarter };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts year, month (1-indexed), and day from a Date as they appear
 * in the given timezone.
 */
function getLeagueDateParts(timezone: string, date: Date): {
  year: number;
  month: number; // 1-indexed
  day: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);

  return {
    year: get('year'),
    month: get('month'), // 1-indexed
    day: get('day'),
  };
}

/**
 * Converts a local wall-clock time in the given timezone into a UTC Date.
 * Uses binary search to find the exact UTC instant — handles DST gaps/overlaps correctly.
 *
 * month is 1-indexed (January = 1).
 */
function leagueLocalToUTC(
  timezone: string,
  year: number,
  month: number, // 1-indexed
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number = 0
): Date {
  // Start with a rough UTC estimate (month is 0-indexed for Date.UTC)
  const roughUTC = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const target = new Date(roughUTC);

  // Verify by checking what wall-clock time this UTC maps to in the timezone
  const check = getLeagueDateParts(timezone, target);

  // If the date parts match, we're done
  if (
    check.year === year &&
    check.month === month &&
    check.day === day
  ) {
    return target;
  }

  // Otherwise, adjust by the difference in milliseconds
  // This handles DST correctly for boundary cases
  const localApprox = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  const tzOffset = localApprox.getTime() - new Date(
    localApprox.toLocaleString('en-US', { timeZone: timezone })
  ).getTime();

  return new Date(localApprox.getTime() + tzOffset);
}
