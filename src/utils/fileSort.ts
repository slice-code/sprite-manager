/**
 * Extract primary numeric value from a filename for ascending sort.
 * 0033.png → 33, 0001.png → 1, walk_0010.png → 10
 */
export function extractFilenameSortKey(filename: string): number {
  const base = filename.replace(/\.[^/.]+$/, '').trim();

  if (/^\d+$/.test(base)) {
    return parseInt(base, 10);
  }

  const leading = base.match(/^(\d+)/);
  if (leading) {
    return parseInt(leading[1], 10);
  }

  const groups = base.match(/\d+/g);
  if (groups && groups.length > 0) {
    return parseInt(groups[groups.length - 1], 10);
  }

  return Number.MAX_SAFE_INTEGER;
}

/** Ascending: smallest number first (0001 → 0010 → 0033). */
export function compareNumericFilenames(a: string, b: string): number {
  const na = extractFilenameSortKey(a);
  const nb = extractFilenameSortKey(b);
  if (na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortFilesByNumericName(files: File[]): File[] {
  return [...files].sort((a, b) => compareNumericFilenames(a.name, b.name));
}
