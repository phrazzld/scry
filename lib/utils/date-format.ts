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

/**
 * Format a future due time for spaced repetition cards
 * Shows actionable scheduling information
 * @param dueTimestamp - Unix timestamp in milliseconds of when card is due
 * @returns Format like "Due now", "Due in 3h", "Due tomorrow", "Due Jan 15"
 */
export function formatDueTime(dueTimestamp: number): string {
  const now = Date.now();
  const diff = dueTimestamp - now;

  if (diff <= 0) return 'Due now';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `Due in ${minutes}m`;
  if (hours < 24) return `Due in ${hours}h`;
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due in ${days}d`;

  const date = new Date(dueTimestamp);
  return `Due ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
