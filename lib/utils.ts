import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DeviceStatus, Model } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('de-DE')
}

export function formatDateTime(s: string): string {
  return new Date(s).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function getStatusLabel(s: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    lager: 'Im Lager',
    reserviert: 'Reserviert',
    verkauft: 'Verkauft',
    im_einsatz: 'Im Einsatz',
    defekt: 'Defekt',
    ausgemustert: 'Ausgemustert',
  }
  return map[s]
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}

export function deviceDisplayName(
  model: Pick<Model, 'modellname' | 'variante'> & { manufacturer?: { name: string } | null } | null | undefined,
): string {
  if (!model) return '—'
  const parts = [model.manufacturer?.name, model.modellname, model.variante].filter(Boolean)
  return parts.join(' ') || '—'
}