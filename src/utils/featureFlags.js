/**
 * Build-time feature flags (Vite exposes only VITE_-prefixed vars).
 * File: src/utils/featureFlags.js
 *
 * Every flag defaults OFF. Turn one on by setting the variable to the
 * literal string "true" in the environment of the build (Vercel project
 * env or a local .env file); anything else, including unset, is off.
 */

const isOn = (v) => String(v ?? '').trim().toLowerCase() === 'true';

/**
 * Speaking band (estimated) indicator on the simulator results page and the
 * public Verify page. Backend counterpart: SPEAKING_BAND_ENABLED on the API
 * service, which controls whether new sessions get a band at all. Both
 * default off; the frontend also renders nothing when no band is present.
 */
export const SPEAKING_BAND_ENABLED = isOn(import.meta.env.VITE_SPEAKING_BAND_ENABLED);
