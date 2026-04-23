import { countDevicesByCategory } from '@/lib/inventory/queries'

describe('countDevicesByCategory', () => {
  it('counts every device, not unique models (regression: 7 devices sharing 1 model)', () => {
    const devices = Array.from({ length: 7 }, () => ({ model_id: 'model-a' }))
    const models = [{ id: 'model-a', category_id: 'cat-1' }]

    expect(countDevicesByCategory(devices, models)).toEqual({ 'cat-1': 7 })
  })

  it('sums counts across multiple categories', () => {
    const devices = [
      { model_id: 'model-a' },
      { model_id: 'model-a' },
      { model_id: 'model-b' },
      { model_id: 'model-c' },
    ]
    const models = [
      { id: 'model-a', category_id: 'cat-1' },
      { id: 'model-b', category_id: 'cat-1' },
      { id: 'model-c', category_id: 'cat-2' },
    ]

    expect(countDevicesByCategory(devices, models)).toEqual({ 'cat-1': 3, 'cat-2': 1 })
  })

  it('skips devices with null model_id', () => {
    const devices = [
      { model_id: null },
      { model_id: 'model-a' },
    ]
    const models = [{ id: 'model-a', category_id: 'cat-1' }]

    expect(countDevicesByCategory(devices, models)).toEqual({ 'cat-1': 1 })
  })

  it('skips devices whose model has no category', () => {
    const devices = [{ model_id: 'orphan' }]
    const models = [{ id: 'orphan', category_id: null }]

    expect(countDevicesByCategory(devices, models)).toEqual({})
  })

  it('returns empty counts for empty input', () => {
    expect(countDevicesByCategory([], [])).toEqual({})
  })
})
