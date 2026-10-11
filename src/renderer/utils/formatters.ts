/**
 * Format bytes into standard human-readable units (e.g., 510.4 GB).
 * Follows binary prefix standards (1024 base) commonly expected in OS storage tools.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  if (isNaN(bytes) || bytes < 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const unitIndex = Math.min(i, sizes.length - 1);

  const value = bytes / Math.pow(k, unitIndex);
  return `${value.toFixed(dm)} ${sizes[unitIndex]}`;
}

/**
 * Format percentage with given decimal places
 */
export function formatPercentage(value: number, decimals = 1): string {
  if (isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format ISO date string into calm local time format
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return 'Unknown';
  }
}
