/**
 * ATAC Platform — Email Validation Utility (Frontend)
 * File: frontend/src/utils/validation.js
 *
 * Mirrors backend/utils/validation.js. Single source of truth for email
 * format validation across all forms (Login, EmployerPortal, VerifyLanding).
 *
 * Strategy: validate on blur, block on submit.
 * Backend has the same regex as a defense-in-depth backstop.
 */

// Block: commas, whitespace, missing @, missing dot.
// Allow: pretty much everything else (Postmark catches truly malformed).
const EMAIL_REGEX = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * Returns true if the input is a valid email format.
 * Returns false for null, undefined, non-strings, empty strings, or malformed addresses.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Returns null if email is valid, or a user-friendly error string if not.
 * Use this in form components for inline error messages.
 */
export function getEmailError(email) {
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return 'Email is required';
  }
  if (!isValidEmail(email)) {
    return 'Please enter a valid email address';
  }
  return null;
}

/**
 * Normalizes email: trim + lowercase. Use AFTER validation passes.
 */
export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
