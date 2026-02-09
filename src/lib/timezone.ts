/**
 * Timezone Utilities
 * Phase 1: UTC storage, CST/CDT display with DST safety
 */

// Using native Date and Intl for timezone handling (no external deps required)
// For production, consider using luxon or date-fns-tz for more robust handling

export const TIMEZONE_CST = 'America/Chicago'; // CST/CDT with automatic DST

/**
 * Convert UTC date to CST/CDT string for display
 */
export function formatToCST(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Validate date
  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    console.error('[TIMEZONE] Invalid date provided to formatToCST:', date);
    return 'Invalid date';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_CST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(dateObj);
}

/**
 * Convert CST/CDT input to UTC Date
 * @param cstDateTime - Date/time string in CST/CDT (e.g., "2026-02-10T03:00:00")
 * @returns UTC Date object
 */
export function parseCSTToUTC(cstDateTime: string): Date {
  // Parse the date/time string components
  // Format: "YYYY-MM-DDTHH:MM:SS"
  const [datePart, timePart] = cstDateTime.split('T');
  if (!datePart || !timePart) {
    throw new Error(`Invalid date/time format: ${cstDateTime}. Expected format: YYYY-MM-DDTHH:MM:SS`);
  }
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
  
  // Create a formatter for CST/CDT
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_CST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Find the UTC time that displays as the desired CST/CDT time
  // Use iterative approach: start with a guess and refine
  
  // Initial guess: assume CST (UTC-6), so UTC = CST + 6 hours
  let utcGuess = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, seconds));
  
  // Iteratively refine until we get the correct CST/CDT time
  for (let i = 0; i < 10; i++) {
    const parts = formatter.formatToParts(utcGuess);
    const cstYear = parseInt(parts.find(p => p.type === 'year')!.value);
    const cstMonth = parseInt(parts.find(p => p.type === 'month')!.value);
    const cstDay = parseInt(parts.find(p => p.type === 'day')!.value);
    const cstHour = parseInt(parts.find(p => p.type === 'hour')!.value);
    const cstMinute = parseInt(parts.find(p => p.type === 'minute')!.value);
    const cstSecond = parseInt(parts.find(p => p.type === 'second')!.value);
    
    // Check if we match
    if (cstYear === year && cstMonth === month && cstDay === day && 
        cstHour === hours && cstMinute === minutes && Math.abs(cstSecond - seconds) <= 1) {
      return utcGuess;
    }
    
    // Calculate the difference
    // Create date objects representing the target and current CST/CDT times
    // We'll use these to calculate the time difference
    const targetCST = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
    const currentCST = new Date(Date.UTC(cstYear, cstMonth - 1, cstDay, cstHour, cstMinute, cstSecond));
    
    // Calculate difference in milliseconds
    const diffMs = targetCST.getTime() - currentCST.getTime();
    
    // Adjust UTC time by the difference
    utcGuess = new Date(utcGuess.getTime() + diffMs);
    
    // Safety check to prevent infinite loops
    if (Math.abs(diffMs) < 1000) {
      break;
    }
  }
  
  return utcGuess;
}

/**
 * Get current time in UTC as ISO string
 */
export function getCurrentUTC(): string {
  return new Date().toISOString();
}

/**
 * Check if a scheduled time has passed (in UTC)
 */
export function isScheduledTimeDue(scheduledAtUTC: string | Date): boolean {
  const scheduled = typeof scheduledAtUTC === 'string' 
    ? new Date(scheduledAtUTC) 
    : scheduledAtUTC;
  const now = new Date();
  return scheduled <= now;
}

/**
 * Format date for display in CST/CDT
 */
export function formatDateCST(date: Date | string | undefined): string {
  if (!date) return 'Not scheduled';
  return formatToCST(date);
}

/**
 * Get CST/CDT timezone abbreviation (CST or CDT)
 */
export function getCSTAbbreviation(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_CST,
    timeZoneName: 'short',
  });
  
  const parts = formatter.formatToParts(date);
  const tzName = parts.find(part => part.type === 'timeZoneName')?.value || 'CST';
  return tzName;
}

/**
 * Create a scheduled date from CST/CDT input
 * @param dateString - Date string (YYYY-MM-DD)
 * @param timeString - Time string (HH:MM) in CST/CDT
 * @returns UTC ISO string
 */
export function createScheduledUTC(dateString: string, timeString: string): string {
  // Combine date and time
  const cstDateTime = `${dateString}T${timeString}:00`;
  
  // Parse and convert to UTC
  const utcDate = parseCSTToUTC(cstDateTime);
  return utcDate.toISOString();
}
