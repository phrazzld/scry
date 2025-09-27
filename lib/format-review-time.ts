/**
 * Format next review time with progressive granularity
 * Shows appropriate level of detail based on how soon the review is scheduled
 */
export function formatNextReviewTime(nextReview: number, now: Date = new Date()): string {
  const reviewDate = new Date(nextReview);
  const diffMs = reviewDate.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Less than 1 minute: "Now"
  if (diffMinutes < 1) {
    return 'Now';
  }

  // Less than 1 hour: "In X minutes"
  if (diffMinutes < 60) {
    return `In ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`;
  }

  // Less than 6 hours: "In X hours"
  if (diffHours < 6) {
    const hours = Math.floor(diffMinutes / 60);
    return `In ${hours} hour${hours === 1 ? '' : 's'}`;
  }

  // Today: "Today at X:XX PM"
  if (isSameDay(reviewDate, now)) {
    return `Today at ${formatTime(reviewDate)}`;
  }

  // Tomorrow: "Tomorrow at X:XX PM"
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(reviewDate, tomorrow)) {
    return `Tomorrow at ${formatTime(reviewDate)}`;
  }

  // Within 7 days: "Monday at X:XX PM"
  if (diffDays < 7) {
    const weekday = reviewDate.toLocaleDateString('en-US', { weekday: 'long' });
    return `${weekday} at ${formatTime(reviewDate)}`;
  }

  // Within 30 days: "Dec 27"
  if (diffDays < 30) {
    return reviewDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  // More than 30 days: "In X days"
  return `In ${diffDays} days`;
}

/**
 * Format time in user's locale (e.g., "3:45 PM")
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Check if two dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get a human-readable description of the review interval
 * Used for displaying how the spacing algorithm is working
 */
export function describeReviewInterval(scheduledDays: number): string {
  if (scheduledDays === 0) {
    return 'Later today';
  } else if (scheduledDays === 1) {
    return 'Tomorrow';
  } else if (scheduledDays < 7) {
    return `In ${scheduledDays} days`;
  } else if (scheduledDays < 30) {
    const weeks = Math.floor(scheduledDays / 7);
    return `In ${weeks} week${weeks === 1 ? '' : 's'}`;
  } else if (scheduledDays < 365) {
    const months = Math.floor(scheduledDays / 30);
    return `In ${months} month${months === 1 ? '' : 's'}`;
  } else {
    const years = Math.floor(scheduledDays / 365);
    return `In ${years} year${years === 1 ? '' : 's'}`;
  }
}
