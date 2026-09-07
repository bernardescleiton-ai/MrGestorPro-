/**
 * Single logging adapter for application diagnostics.
 * Keeping console access here lets the rest of the app depend on one seam
 * without changing the existing browser/Android logging behavior.
 */
export const logger = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};
