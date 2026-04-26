import { daysUntil, getTseAmpel } from '@/lib/tse/expiry'

const NOW = new Date('2026-04-26T12:00:00Z')

describe('daysUntil', () => {
  it('returns null for null input', () => {
    expect(daysUntil(null, NOW)).toBeNull()
  })

  it('returns 0 for today', () => {
    expect(daysUntil('2026-04-26', NOW)).toBe(0)
  })

  it('returns positive for future', () => {
    expect(daysUntil('2026-05-01', NOW)).toBe(5)
  })

  it('returns negative for past', () => {
    expect(daysUntil('2026-04-20', NOW)).toBe(-6)
  })

  it('returns null for invalid date', () => {
    expect(daysUntil('not-a-date', NOW)).toBeNull()
  })
})

describe('getTseAmpel', () => {
  it('grau bei null', () => {
    expect(getTseAmpel(null, NOW)).toBe('grau')
  })

  it('rot bei 0 Tagen', () => {
    expect(getTseAmpel('2026-04-26', NOW)).toBe('rot')
  })

  it('rot bei 59 Tagen', () => {
    const d = new Date(NOW)
    d.setUTCDate(d.getUTCDate() + 59)
    expect(getTseAmpel(d.toISOString().slice(0, 10), NOW)).toBe('rot')
  })

  it('gelb bei 60 Tagen', () => {
    const d = new Date(NOW)
    d.setUTCDate(d.getUTCDate() + 60)
    expect(getTseAmpel(d.toISOString().slice(0, 10), NOW)).toBe('gelb')
  })

  it('gelb bei 179 Tagen', () => {
    const d = new Date(NOW)
    d.setUTCDate(d.getUTCDate() + 179)
    expect(getTseAmpel(d.toISOString().slice(0, 10), NOW)).toBe('gelb')
  })

  it('gruen bei 180 Tagen', () => {
    const d = new Date(NOW)
    d.setUTCDate(d.getUTCDate() + 180)
    expect(getTseAmpel(d.toISOString().slice(0, 10), NOW)).toBe('gruen')
  })

  it('gruen bei 365 Tagen', () => {
    const d = new Date(NOW)
    d.setUTCDate(d.getUTCDate() + 365)
    expect(getTseAmpel(d.toISOString().slice(0, 10), NOW)).toBe('gruen')
  })

  it('rot bei abgelaufen (negativ)', () => {
    expect(getTseAmpel('2026-04-20', NOW)).toBe('rot')
  })
})
