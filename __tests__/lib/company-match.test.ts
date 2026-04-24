import { normalizeCompanyName, findCompanyMatches } from '@/lib/company-match'

describe('normalizeCompanyName', () => {
  it('lowercases and strips legal suffixes', () => {
    expect(normalizeCompanyName('Vectron Systems AG')).toBe('vectron')
    expect(normalizeCompanyName('Quad GmbH')).toBe('quad')
    expect(normalizeCompanyName('Epson Deutschland GmbH')).toBe('epson')
    expect(normalizeCompanyName('Foo GmbH & Co. KG')).toBe('foo')
  })

  it('is stable for already-clean names', () => {
    expect(normalizeCompanyName('Vectron')).toBe('vectron')
    expect(normalizeCompanyName('Epson')).toBe('epson')
  })

  it('handles punctuation and whitespace', () => {
    expect(normalizeCompanyName('  Bar,  Inc.  ')).toBe('bar')
    expect(normalizeCompanyName('Foo-Tech S.E.')).toBe('foo-tech')
  })

  it('returns empty string for null/empty input', () => {
    expect(normalizeCompanyName('')).toBe('')
    expect(normalizeCompanyName(null)).toBe('')
    expect(normalizeCompanyName(undefined)).toBe('')
  })
})

describe('findCompanyMatches', () => {
  const items = [
    { id: '1', name: 'Vectron Systems AG' },
    { id: '2', name: 'Epson Deutschland GmbH' },
    { id: '3', name: 'Quad GmbH' },
  ]

  it('matches stripped form against full legal name', () => {
    const r = findCompanyMatches(items, 'Vectron')
    expect(r.map(x => x.id)).toEqual(['1'])
  })

  it('matches full legal name against stripped form', () => {
    const r = findCompanyMatches(items, 'Vectron Systems AG')
    expect(r.map(x => x.id)).toEqual(['1'])
  })

  it('matches case-insensitively and ignores extra suffixes', () => {
    const r = findCompanyMatches(items, 'epson')
    expect(r.map(x => x.id)).toEqual(['2'])
  })

  it('returns empty array when no match', () => {
    expect(findCompanyMatches(items, 'Samsung')).toEqual([])
  })

  it('returns empty array for null/empty needle', () => {
    expect(findCompanyMatches(items, null)).toEqual([])
    expect(findCompanyMatches(items, '')).toEqual([])
  })

  it('returns all candidates when multiple match (caller decides)', () => {
    const multi = [
      { id: 'a', name: 'Vectron Systems AG' },
      { id: 'b', name: 'Vectron Deutschland GmbH' },
    ]
    const r = findCompanyMatches(multi, 'Vectron')
    expect(r.map(x => x.id).sort()).toEqual(['a', 'b'])
  })
})
