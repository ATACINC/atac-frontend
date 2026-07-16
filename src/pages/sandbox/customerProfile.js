/**
 * ATAC Platform - customerProfile.js
 * Path: frontend/src/pages/sandbox/customerProfile.js
 *
 * Shared logic for the sandbox customer account card. Lives outside the
 * component file so non-component exports do not break Fast Refresh (the same
 * reason sandboxTheme.js holds the shared styles).
 */

// API key -> visible label. Order is the display order. Note the API sends the
// singular `note`; the label is "Notes".
export const PROFILE_FIELDS = [
  { key: 'company',        label: 'Company' },
  { key: 'customer_name',  label: 'Customer' },
  { key: 'account_number', label: 'Account number' },
  { key: 'balance',        label: 'Balance' },
  { key: 'last_payment',   label: 'Last payment' },
  { key: 'note',           label: 'Notes' },
];

// Keep only fields the API actually sent as a usable string. A missing key, a
// non-string value, or an empty/whitespace-only string is treated as absent and
// its row is skipped rather than rendered blank. Never throws on an odd shape.
export function readProfileRows(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return [];
  return PROFILE_FIELDS
    .map(({ key, label }) => ({ label, value: profile[key] }))
    .filter(({ value }) => typeof value === 'string' && value.trim() !== '');
}

// Will the card render anything for this profile? The call screen uses this to
// decide whether the desktop layout gets a card rail at all, so it must stay
// in lockstep with readProfileRows (it is the same check).
export function hasCustomerProfile(profile) {
  return readProfileRows(profile).length > 0;
}
