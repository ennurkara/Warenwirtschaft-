import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { DeviceStatus, DeviceCondition } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getStatusLabel(status: DeviceStatus): string {
  const labels: Record<DeviceStatus, string> = {
    lager: 'Im Lager',
    im_einsatz: 'Im Einsatz',
    defekt: 'Defekt',
    ausgemustert: 'Ausgemustert',
  }
  return labels[status]
}

export function getConditionLabel(condition: DeviceCondition): string {
  return condition === 'neu' ? 'Neu' : 'Gebraucht'
}