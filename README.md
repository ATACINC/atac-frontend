# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## Brand guard

`scripts/brand-guard.sh` blocks banned customer-facing terms — the Pioneer→Charter rename and on-chain/crypto minting copy — from shipping. Case-insensitive patterns:

`pioneer` · `ERC-?721` · `\bNFT\b` · `polygon` · `\bMATIC\b` · `chain 137` · `cohort open`

It's wired as the npm `prebuild` hook, so it runs before the build; a hit prints the offending `file:line`, exits 1, and fails the build:

```bash
npm run build     # runs the guard first, then `vite build`
```

Vercel runs `npm run build`, so **every deploy is gated**. On a hit the build dies at `> prebuild`; the Vercel deploy fails and the last good production deploy stays live — no outage, but the change does **not** ship until the copy is fixed.

**Bypass (hotfix only — deliberate and greppable):**

```bash
SKIP_BRAND_GUARD=1 npm run build
```

or set `SKIP_BRAND_GUARD=1` as a Vercel env var to force a deploy through.

Matching ignores non-rendered text: `/* ... */` and JSX `{/* ... */}` comments are stripped first; `//` line comments, code identifiers, and CSS keyframes are excluded; `useConsent.jsx` is skipped entirely.

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
