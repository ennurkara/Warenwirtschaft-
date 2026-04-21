import type { Device, DeviceStatus } from '@/lib/types'

export function deriveDisplayStatus(device: Device): DeviceStatus {
  if (device.sale_item) return 'verkauft'
  return device.status
}
