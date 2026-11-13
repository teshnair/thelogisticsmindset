// Request invariants shared by the public tariff entry points.
export function entryDateError(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'Enter an entry date (YYYY-MM-DD).';
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? 'Enter a valid calendar entry date.' : null;
}

export function sourceDecision(index, release, entryDate) {
  if (index.htsRevision !== release.revision) return 'source-stale';
  // A current-release index cannot establish the law on a prior entry date.
  if (!index.effectiveFrom || entryDate < index.effectiveFrom) return 'historical-source-required';
  if (entryDate > new Date().toISOString().slice(0, 10)) return 'future-source-required';
  return null;
}

export function isQualified(value) {
  return value === true || ['yes', 'true', 'qualified'].includes(String(value).toLowerCase());
}

