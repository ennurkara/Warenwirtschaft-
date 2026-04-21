import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DeviceStatus } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('de-DE')
}

export function getStatusLabel(s: DeviceStatus): string {
  const map: Record<DeviceStatus, string> = {
    lager: 'Im Lager',
    reserviert: 'Reserviert',
    verkauft: 'Verkauft',
    defekt: 'Defekt',
    ausgemustert: 'Ausgemustert',
  }
  return map[s]
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)
}