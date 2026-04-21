import { getColumnsForCategory, COLUMN_KEY } from '@/lib/category-columns'

describe('getColumnsForCategory', () => {
  it('returns Kassen columns for Registrierkasse', () => {
    const cols = getColumnsForCategory('Registrierkasse')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.HW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.TSE_VALID)
    expect(keys).toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).toContain(COLUMN_KEY.ZVT)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
  })

  it('returns generic columns for Drucker', () => {
    const cols = getColumnsForCategory('Drucker')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).not.toContain(COLUMN_KEY.HW_SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.FISKAL_2020)
  })

  it('returns simple columns for Kabel', () => {
    const cols = getColumnsForCategory('Kabel')
    const keys = cols.map(c => c.key)
    expect(keys).not.toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
    expect(keys).toContain(COLUMN_KEY.LOCATION)
  })

  it('falls back to generic for unknown categories', () => {
    const cols = getColumnsForCategory('Unbekannt')
    expect(cols.map(c => c.key)).toContain(COLUMN_KEY.SERIAL)
  })
})
