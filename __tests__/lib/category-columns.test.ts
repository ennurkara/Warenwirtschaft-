import { getColumnsForCategory, COLUMN_KEY } from '@/lib/category-columns'

describe('getColumnsForCategory', () => {
  it('returns Kassenhardware columns with Vectron-specific keys', () => {
    const cols = getColumnsForCategory('Kassenhardware')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)        // HW-SN (devices.serial_number)
    expect(keys).toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).toContain(COLUMN_KEY.LICENSE_TYPE)
    expect(keys).toContain(COLUMN_KEY.FISKAL_2020)
    expect(keys).toContain(COLUMN_KEY.ZVT)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).toContain(COLUMN_KEY.VK)
  })

  it('no longer returns Vectron-specific columns for old Registrierkasse name', () => {
    const cols = getColumnsForCategory('Registrierkasse')
    const keys = cols.map(c => c.key)
    expect(keys).not.toContain(COLUMN_KEY.SW_SERIAL)
    expect(keys).not.toContain(COLUMN_KEY.LICENSE_TYPE)
    // Old name falls back to generic columns now
    expect(keys).toContain(COLUMN_KEY.SERIAL)
  })

  it('returns generic columns for Drucker', () => {
    const cols = getColumnsForCategory('Drucker')
    const keys = cols.map(c => c.key)
    expect(keys).toContain(COLUMN_KEY.SERIAL)
    expect(keys).toContain(COLUMN_KEY.EK)
    expect(keys).not.toContain(COLUMN_KEY.SW_SERIAL)
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
