// projects/api/_lib/log.js

/**
 * Logs a structured JSON message to the console.
 *
 * @param {'info' | 'warn' | 'error'} level - The log level.
 * @param {string} subsystem - The part of the application generating the log (e.g., 'asset-sucker').
 * @param {string} action - The specific action being performed (e.g., 'zip_generated').
 * @param {object} [fields={}] - Additional structured data to include in the log.
 */
export function log(level, subsystem, action, fields = {}) {
  const event = {
    ts: new Date().toISOString(),
    level,
    subsystem,
    action,
    ...fields
  };
  // Vercel automatically captures console.log/error and treats them as logs.
  const logger = level === 'error' ? console.error : console.log;
  logger(JSON.stringify(event));
}