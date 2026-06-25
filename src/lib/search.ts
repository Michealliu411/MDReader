export function findMatches(
  text: string,
  keyword: string,
  caseSensitive: boolean,
): number[] {
  if (!keyword) return [];

  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? keyword : keyword.toLowerCase();
  const matches: number[] = [];
  let idx = hay.indexOf(needle);
  while (idx !== -1) {
    matches.push(idx);
    idx = hay.indexOf(needle, idx + needle.length);
  }
  return matches;
}

export function nextIndex(matches: number[], current: number): number {
  if (matches.length === 0) return -1;
  const next = current + 1;
  return next >= matches.length ? 0 : next;
}

export function prevIndex(matches: number[], current: number): number {
  if (matches.length === 0) return -1;
  const prev = current - 1;
  return prev < 0 ? matches.length - 1 : prev;
}
