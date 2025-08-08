import { describe, it, expect } from 'vitest'
import { formatNextReviewTime, describeReviewInterval } from './format-review-time'

describe('formatNextReviewTime', () => {
  it('should format time as "Now" for reviews due within 1 minute', () => {
    const now = new Date('2025-01-08T10:00:00')
    const nextReview = new Date('2025-01-08T10:00:30').getTime()
    expect(formatNextReviewTime(nextReview, now)).toBe('Now')
  })

  it('should format time as "Now" for past reviews', () => {
    const now = new Date('2025-01-08T10:00:00')
    const nextReview = new Date('2025-01-08T09:59:00').getTime()
    expect(formatNextReviewTime(nextReview, now)).toBe('Now')
  })

  it('should format as "In X minutes" for reviews within an hour', () => {
    const now = new Date('2025-01-08T10:00:00')
    const in5Minutes = new Date('2025-01-08T10:05:00').getTime()
    const in30Minutes = new Date('2025-01-08T10:30:00').getTime()
    const in59Minutes = new Date('2025-01-08T10:59:00').getTime()
    
    expect(formatNextReviewTime(in5Minutes, now)).toBe('In 5 minutes')
    expect(formatNextReviewTime(in30Minutes, now)).toBe('In 30 minutes')
    expect(formatNextReviewTime(in59Minutes, now)).toBe('In 59 minutes')
  })

  it('should format as "In X minute" singular for 1 minute', () => {
    const now = new Date('2025-01-08T10:00:00')
    const in1Minute = new Date('2025-01-08T10:01:00').getTime()
    expect(formatNextReviewTime(in1Minute, now)).toBe('In 1 minute')
  })

  it('should format as "In X hours" for reviews within 6 hours', () => {
    const now = new Date('2025-01-08T10:00:00')
    const in2Hours = new Date('2025-01-08T12:00:00').getTime()
    const in5Hours = new Date('2025-01-08T15:00:00').getTime()
    
    expect(formatNextReviewTime(in2Hours, now)).toBe('In 2 hours')
    expect(formatNextReviewTime(in5Hours, now)).toBe('In 5 hours')
  })

  it('should format as "In X hour" singular for 1 hour', () => {
    const now = new Date('2025-01-08T10:00:00')
    const in1Hour = new Date('2025-01-08T11:00:00').getTime()
    expect(formatNextReviewTime(in1Hour, now)).toBe('In 1 hour')
  })

  it('should format as "Today at X:XX PM" for same day beyond 6 hours', () => {
    const now = new Date('2025-01-08T10:00:00')
    const laterToday = new Date('2025-01-08T20:30:00').getTime()
    expect(formatNextReviewTime(laterToday, now)).toBe('Today at 8:30 PM')
  })

  it('should format as "Tomorrow at X:XX AM" for next day', () => {
    const now = new Date('2025-01-08T22:00:00')
    const tomorrow = new Date('2025-01-09T09:15:00').getTime()
    expect(formatNextReviewTime(tomorrow, now)).toBe('Tomorrow at 9:15 AM')
  })

  it('should format as weekday name for reviews within 7 days', () => {
    const now = new Date('2025-01-08T10:00:00') // Wednesday
    const friday = new Date('2025-01-10T14:30:00').getTime()
    const sunday = new Date('2025-01-12T09:00:00').getTime()
    
    expect(formatNextReviewTime(friday, now)).toBe('Friday at 2:30 PM')
    expect(formatNextReviewTime(sunday, now)).toBe('Sunday at 9:00 AM')
  })

  it('should format as "MMM DD" for reviews within 30 days', () => {
    const now = new Date('2025-01-08T10:00:00')
    const in10Days = new Date('2025-01-18T10:00:00').getTime()
    const in25Days = new Date('2025-02-02T10:00:00').getTime()
    
    expect(formatNextReviewTime(in10Days, now)).toBe('Jan 18')
    expect(formatNextReviewTime(in25Days, now)).toBe('Feb 2')
  })

  it('should format as "In X days" for reviews beyond 30 days', () => {
    const now = new Date('2025-01-08T10:00:00')
    const in45Days = new Date('2025-02-22T10:00:00').getTime()
    // Using a date that's exactly 100 days ahead
    const nowMs = now.getTime()
    const in100Days = nowMs + (100 * 24 * 60 * 60 * 1000)
    
    expect(formatNextReviewTime(in45Days, now)).toBe('In 45 days')
    expect(formatNextReviewTime(in100Days, now)).toBe('In 100 days')
  })

  it('should use current date when now parameter is not provided', () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000).getTime() // 2 hours from now
    const result = formatNextReviewTime(futureDate)
    expect(result).toMatch(/^In \d hour/)
  })
})

describe('describeReviewInterval', () => {
  it('should return "Later today" for 0 days', () => {
    expect(describeReviewInterval(0)).toBe('Later today')
  })

  it('should return "Tomorrow" for 1 day', () => {
    expect(describeReviewInterval(1)).toBe('Tomorrow')
  })

  it('should return "In X days" for 2-6 days', () => {
    expect(describeReviewInterval(2)).toBe('In 2 days')
    expect(describeReviewInterval(5)).toBe('In 5 days')
    expect(describeReviewInterval(6)).toBe('In 6 days')
  })

  it('should return "In X week" for 7-29 days', () => {
    expect(describeReviewInterval(7)).toBe('In 1 week')
    expect(describeReviewInterval(14)).toBe('In 2 weeks')
    expect(describeReviewInterval(21)).toBe('In 3 weeks')
    expect(describeReviewInterval(28)).toBe('In 4 weeks')
  })

  it('should return "In X month" for 30-364 days', () => {
    expect(describeReviewInterval(30)).toBe('In 1 month')
    expect(describeReviewInterval(60)).toBe('In 2 months')
    expect(describeReviewInterval(90)).toBe('In 3 months')
    expect(describeReviewInterval(180)).toBe('In 6 months')
    expect(describeReviewInterval(364)).toBe('In 12 months')
  })

  it('should return "In X year" for 365+ days', () => {
    expect(describeReviewInterval(365)).toBe('In 1 year')
    expect(describeReviewInterval(730)).toBe('In 2 years')
    expect(describeReviewInterval(1095)).toBe('In 3 years')
  })

  it('should use singular forms correctly', () => {
    expect(describeReviewInterval(7)).toBe('In 1 week')
    expect(describeReviewInterval(30)).toBe('In 1 month')
    expect(describeReviewInterval(365)).toBe('In 1 year')
  })

  it('should use plural forms correctly', () => {
    expect(describeReviewInterval(14)).toBe('In 2 weeks')
    expect(describeReviewInterval(60)).toBe('In 2 months')
    expect(describeReviewInterval(730)).toBe('In 2 years')
  })
})