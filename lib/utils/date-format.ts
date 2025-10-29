/**
 * Short date formatting utilities for mobile UI
 * Converts verbose "X days ago" to compact "Xd" format
 */

/**
 * Format a timestamp into a short relative time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Short format like "12d", "3h", "45m", "now"
 */
export function formatShortRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  // Future dates (should not happen for "ago" format, but handle gracefully)
  if (diffMs < 0) {
    const absDiffMin = Math.abs(diffMin);
    const absDiffHour = Math.abs(diffHour);
    const absDiffDay = Math.abs(diffDay);

    if (absDiffMin < 60) return `in ${absDiffMin}m`;
    if (absDiffHour < 24) return `in ${absDiffHour}h`;
    return `in ${absDiffDay}d`;
  }

  // Past dates
  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 7) return `${diffDay}d`;
  if (diffWeek < 4) return `${diffWeek}w`;
  if (diffMonth < 12) return `${diffMonth}mo`;
  return `${diffYear}y`;
}

/**
 * Format a timestamp for display in mobile cards
 * Adds "ago" suffix for clarity in certain contexts
 */
export function formatCardDate(timestamp: number, includeAgo = false): string {
  const short = formatShortRelativeTime(timestamp);
  if (includeAgo && short !== 'now') {
    return `${short} ago`;
  }
  return short;
}
