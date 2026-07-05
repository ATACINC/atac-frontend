#!/usr/bin/env bash
# ATAC Global CX brand guard.
# Blocks banned customer-facing terms from shipping to production.
# Wire into package.json: "prebuild": "bash scripts/brand-guard.sh"
# so it runs before every vite build and every Vercel deploy.
#
# It scans rendered-copy files and fails the build if a banned term appears.
# It excludes code identifiers, props, comments, and CSS keyframes so it only
# flags text that actually reaches a user (matching the recon distinction used
# in the July 4 2026 brand cleanup).

set -e

# Strip /* ... */ block comments (including JSX {/* ... */}) from each file
# before matching -- terms inside comments are never rendered to a user. The
# tr/\n//cd keeps the newlines so grep still reports accurate line numbers.
# useConsent.jsx is excluded: it names ERC-721/Polygon intentionally as a
# legal consent disclosure, not marketing copy.
HITS=$(
  find src -type f \( -name '*.jsx' -o -name '*.js' -o -name '*.json' \) ! -name 'useConsent.jsx' -print0 \
  | while IFS= read -r -d '' f; do
      perl -0777 -pe 's{/\*.*?\*/}{(my $c=$&)=~tr/\n//cd;$c}ges' "$f" \
      | grep -niE \
        -e 'pioneer' \
        -e 'ERC-?721' \
        -e '\bNFT\b' \
        -e 'polygon' \
        -e '\bMATIC\b' \
        -e 'chain 137' \
        -e 'cohort open' \
      | sed "s|^|$f:|"
    done \
  | grep -viE '//|isPioneer|pioneer_revalidate|pioneerCard|pioneerCred|pioneerFlow|source *= *.?pioneer|keyframes|@keyframes' \
  || true)

if [ -n "$HITS" ]; then
  echo "=================================================="
  echo "BRAND GUARD FAILED."
  echo "Banned terms found in customer-facing copy:"
  echo "--------------------------------------------------"
  echo "$HITS"
  echo "--------------------------------------------------"
  echo "Fix the copy, or if this is a false positive (a code"
  echo "identifier, not rendered text), extend the exclusion"
  echo "list in scripts/brand-guard.sh with a comment saying why."
  echo "=================================================="
  exit 1
fi

echo "Brand guard passed. No banned terms in customer-facing copy."
