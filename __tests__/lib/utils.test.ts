import { getStatusLabel, formatCurrency } from '@/lib/utils'

describe('getStatusLabel', () => {
  it('returns German labels for all statuses', () => {
    expect(getStatusLabel('lager')).toBe('Im Lager')
    expect(getStatusLabel('verkauft')).toBe('Verkauft')
    expect(getStatusLabel('reserviert')).toBe('Reserviert')
    expect(getStatusLabel('defekt')).toBe('Defekt')
    expect(getStatusLabel('ausgemustert')).toBe('Ausgemustert')
  })
})

describe('formatCurrency', () => {
  it('formats numbers as German EUR', () => {
    expect(formatCurrency(1234.5)).toMatch(/1\.234,50/)
    expect(formatCurrency(0)).toMatch(/0,00/)
  })
})