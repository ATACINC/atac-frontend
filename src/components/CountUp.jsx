/**
 * ATAC Platform - CountUp.jsx
 * Path: frontend/src/components/CountUp.jsx
 *
 * Renders a number that animates from 0 to `value` (see useCountUp), with an
 * optional suffix (e.g. "%"). Wrapping the hook in a component lets each figure
 * animate independently inside a list/grid without calling hooks in a loop.
 *
 * While the value is not yet known (null/undefined, e.g. config still loading)
 * a muted placeholder is shown so the figure has a genuine loading state.
 */

import { useCountUp } from '../hooks/useCountUp';

export default function CountUp({ value, suffix = '', duration = 900, placeholder = '—' }) {
  const ready = value != null && Number.isFinite(Number(value));
  const display = useCountUp(ready ? value : 0, { duration });
  if (!ready) return <>{placeholder}</>;
  return <>{display}{suffix}</>;
}
