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
 * @param cstDateTime - Date/time string in CST/CDT (e.g., "2024-01-15T14:30:00")
 * @returns UTC Date object
 */
export function parseCSTToUTC(cstDateTime: string): Date {
  // Parse as if it's in CST, then convert to UTC
  // Note: This is a simplified approach. For production, use a proper timezone library.
  
  // Create date string with timezone offset
  // CST is UTC-6, CDT is UTC-5 (DST)
  // We'll let the browser handle the conversion by creating a date in the local timezone
  // then converting to UTC
  
  // For now, we'll assume the input is in ISO format and append timezone info
  // In production, use luxon: DateTime.fromISO(cstDateTime, { zone: 'America/Chicago' }).toUTC()
  
  // Simple approach: treat input as CST/CDT and convert
  // This is approximate - for exact conversion, use a library
  const date = new Date(cstDateTime);
  
  // Get CST offset (accounts for DST automatically)
  const cstDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE_CST }));
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offset = cstDate.getTime() - utcDate.getTime();
  
  // Apply offset to get UTC
  return new Date(date.getTime() - offset);
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
