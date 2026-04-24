const LEGAL_FORM_TOKENS = new Set([
  'gmbh', 'ag', 'kg', 'ohg', 'ug', 'se', 'ek', 'ev',
  'co', 'inc', 'ltd', 'llc', 'plc', 'corp', 'corporation',
  'gesellschaft', 'mbh',
])

const NOISE_TOKENS = new Set([
  'systems', 'system', 'solutions', 'solution',
  'group', 'holding', 'holdings',
  'technology', 'technologies', 'tech',
  'deutschland', 'germany', 'europe', 'international',
  'services',
])

export function normalizeCompanyName(s: string | null | undefined): string {
  if (!s) return ''
  const stripped = s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[,&()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const tokens = stripped.split(' ').filter(t => t.length > 0)
  const kept = tokens.filter(t => !LEGAL_FORM_TOKENS.has(t) && !NOISE_TOKENS.has(t))
  return kept.join(' ')
}

export function findCompanyMatches<T extends { name: string }>(
  items: T[],
  needle: string | null | undefined,
): T[] {
  const n = normalizeCompanyName(needle)
  if (!n) return []
  return items.filter(it => {
    const h = normalizeCompanyName(it.name)
    if (!h) return false
    return h === n || h.includes(n) || n.includes(h)
  })
}
