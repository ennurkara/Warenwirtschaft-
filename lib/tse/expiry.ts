export type TseAmpel = 'rot' | 'gelb' | 'gruen' | 'grau'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function daysUntil(expiresAt: string | null, now: Date = new Date()): number | null {
  if (!expiresAt) return null
  const target = new Date(expiresAt + 'T00:00:00Z')
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return Math.floor((target.getTime() - today.getTime()) / MS_PER_DAY)
}

// Ampel-Schwellen: rot < 60 Tage, gelb < 180, sonst grün; null → grau.
export function getTseAmpel(expiresAt: string | null, now: Date = new Date()): TseAmpel {
  const days = daysUntil(expiresAt, now)
  if (days === null) return 'grau'
  if (days < 60) return 'rot'
  if (days < 180) return 'gelb'
  return 'gruen'
}
