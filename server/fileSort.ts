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

export function compareNumericFilenames(a: string, b: string): number {
  const na = extractFilenameSortKey(a);
  const nb = extractFilenameSortKey(b);
  if (na !== nb) return na - nb;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortByNumericFilename<T extends { originalname: string }>(files: T[]): T[] {
  return [...files].sort((a, b) => compareNumericFilenames(a.originalname, b.originalname));
}

export function sortRecordsByNumericFilename<T extends { fileName: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => compareNumericFilenames(a.fileName, b.fileName));
}
