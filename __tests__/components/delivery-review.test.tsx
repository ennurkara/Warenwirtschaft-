/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { DeliveryReview } from '@/components/delivery/delivery-review'
import type { LieferscheinOcrResponse, Category, Model } from '@/lib/types'

const rpcMock = jest.fn().mockResolvedValue({ data: 'purchase-id', error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
    rpc: (_name: string, args: unknown) => rpcMock(args),
  }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }))

const ocr: LieferscheinOcrResponse = {
  supplier: 'Quad',
  rechnungsnr: 'LS-1',
  datum: '2026-04-20',
  source_path: 'lieferscheine/x.pdf',
  items: [
    { manufacturer: 'Epson', name: 'TM-T88VI', serial_number: null, quantity: 3, ek_preis: 249 },
    { manufacturer: 'Epson', name: 'TM-T88VI', serial_number: 'SN-X', quantity: 1, ek_preis: 249 },
  ],
}
const categories: Category[] = []
const models: Model[] = []

describe('DeliveryReview', () => {
  beforeEach(() => rpcMock.mockClear())

  it('expands quantity>1 without SN into multiple rows', () => {
    render(
      <DeliveryReview
        ocr={ocr} categories={categories} models={models}
        previewUrl="about:blank" onModelsRefresh={async () => {}}
      />
    )
    // 3 expanded + 1 with SN = 4 rows
    const removeButtons = screen.getAllByLabelText('Zeile entfernen')
    expect(removeButtons).toHaveLength(4)
  })

  it('adds a blank row when "+ Zeile" clicked', () => {
    render(
      <DeliveryReview
        ocr={ocr} categories={categories} models={models}
        previewUrl="about:blank" onModelsRefresh={async () => {}}
      />
    )
    fireEvent.click(screen.getByText('+ Zeile'))
    const removeButtons = screen.getAllByLabelText('Zeile entfernen')
    expect(removeButtons).toHaveLength(5)
  })

  it('blocks save when no supplier picked', () => {
    render(
      <DeliveryReview
        ocr={ocr} categories={categories} models={models}
        previewUrl="about:blank" onModelsRefresh={async () => {}}
      />
    )
    fireEvent.click(screen.getByText(/Alle speichern/))
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
