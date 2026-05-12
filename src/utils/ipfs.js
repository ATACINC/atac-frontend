/**
 * ATAC Platform - ipfs.js
 * Path: frontend/src/utils/ipfs.js
 *
 * Defensive normalizer that converts an IPFS URI or bare hash to a Pinata
 * gateway URL. Mirrors backend services/pinata.ipfsUriToGatewayUrl().
 *
 * Backend API responses (e.g., /api/photo/headshot, /api/credentials/verify)
 * already pre-convert URIs to gateway URLs, so most callers do not need this
 * helper. It exists for cases where only the raw URI is available, such as
 * reading candidate.headshot_ipfs_uri from a cached /me payload.
 */

// Pinata dedicated gateway for ATAC headshot images.
const PINATA_GATEWAY = 'https://aquamarine-implicit-gecko-312.mypinata.cloud/ipfs';

/**
 * Convert an IPFS URI or bare hash to a Pinata gateway URL.
 *
 * Accepts:
 *   'ipfs://Qm...'    -> 'https://aquamarine.../ipfs/Qm...'
 *   'Qm...'           -> 'https://aquamarine.../ipfs/Qm...'  (bare hash)
 *   'https://.../...' -> pass-through (already a URL)
 *   null / undefined / '' -> null
 *   non-string types  -> null
 */
export function ipfsUriToGatewayUrl(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a full URL - pass through unchanged.
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Strip ipfs:// prefix if present, otherwise treat as bare hash.
  const hash = trimmed.replace(/^ipfs:\/\//, '');
  if (!hash) return null;

  return `${PINATA_GATEWAY}/${hash}`;
}
