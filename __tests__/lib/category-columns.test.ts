import { getColumnsForKind, COLUMN_KEY } from '@/lib/category-columns'

describe('getColumnsForKind', () => {
  it('returns Kassenhardware columns for kind="kassenhardware"', () => {
    const cols = getColumnsForKind('kassenhardware')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.LICENSE_TYPE)
    expect(keys).toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).toContain(COLUMN_KEY.ZVT)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
  })

  it('returns generic columns for kind="generic"', () => {
    const cols = getColumnsForKind('generic')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).not.toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).not.toContain(COLUMN_KEY.MENGE)
  })

  it('returns simple columns for kind="simple"', () => {
    const cols = getColumnsForKind('simple')
    const keys = cols.map(c => c.key)
    expect(keys).not.toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.NAME)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
    expect(keys).toContain(COLUMN_KEY.LOCATION)
    expect(keys).not.toContain(COLUMN_KEY.MENGE)
  })

  it('returns stock columns for kind="stock"', () => {
    const cols = getColumnsForKind('stock')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.NAME)
    expect(keys).toContain(COLUMN_KEY.MANUFACTURER)
    expect(keys).toContain(COLUMN_KEY.MENGE)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
    expect(keys).toContain(COLUMN_KEY.LOCATION)
    expect(keys).not.toContain(COLUMN_KEY.SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.STATUS)
  })

  it('falls back to generic for an undefined kind', () => {
    // @ts-expect-error testing runtime fallback
    const cols = getColumnsForKind(undefined)
    expect(cols.map(c => c.key)).toContain(COLUMN_KEY.SERIAL)
  })
})
