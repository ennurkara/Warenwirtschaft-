import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Device } from '@/lib/types'

const base: Device = {
  id: 'd1', model_id: 'm1', serial_number: null, status: 'lager',
  location: null, photo_url: null, notes: null,
  created_at: '', updated_at: '',
}

describe('deriveDisplayStatus', () => {
  it('returns "verkauft" if sale_item exists, regardless of status', () => {
    const d: Device = { ...base, status: 'lager', sale_item: { id: 's', sale_id: 'x', device_id: 'd1', vk_preis: 100 } }
    expect(deriveDisplayStatus(d)).toBe('verkauft')
  })

  it('returns device.status when no sale_item', () => {
    expect(deriveDisplayStatus({ ...base, status: 'defekt' })).toBe('defekt')
    expect(deriveDisplayStatus({ ...base, status: 'lager' })).toBe('lager')
  })
})
