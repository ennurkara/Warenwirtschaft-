import { formatDate, getStatusLabel, getConditionLabel } from '@/lib/utils'

describe('formatDate', () => {
  it('formats ISO timestamp to German date', () => {
    expect(formatDate('2026-04-19T10:00:00Z')).toBe('19.04.2026')
  })
})

describe('getStatusLabel', () => {
  it('returns German label for lager', () => {
    expect(getStatusLabel('lager')).toBe('Im Lager')
  })
  it('returns German label for im_einsatz', () => {
    expect(getStatusLabel('im_einsatz')).toBe('Im Einsatz')
  })
  it('returns German label for defekt', () => {
    expect(getStatusLabel('defekt')).toBe('Defekt')
  })
  it('returns German label for ausgemustert', () => {
    expect(getStatusLabel('ausgemustert')).toBe('Ausgemustert')
  })
})

describe('getConditionLabel', () => {
  it('returns German label for neu', () => {
    expect(getConditionLabel('neu')).toBe('Neu')
  })
  it('returns German label for gebraucht', () => {
    expect(getConditionLabel('gebraucht')).toBe('Gebraucht')
  })
})