/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DeliveryItemRow } from '@/components/delivery/delivery-item-row'
import type { LieferscheinRowDraft, Category, Model } from '@/lib/types'

const insertMock = jest.fn().mockResolvedValue({ data: { id: 'new-model' }, error: null })
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (_t: string) => ({
      select: () => ({ order: async () => ({ data: [], error: null }) }),
      insert: () => ({ select: () => ({ single: insertMock }) }),
    }),
  }),
}))

const baseRow: LieferscheinRowDraft = {
  client_id: 'r1',
  manufacturer_id: null,
  model_id: null,
  category_id: null,
  serial_number: null,
  location: null,
  notes: null,
  ek_preis: null,
  ocr_manufacturer: 'Epson',
  ocr_name: 'TM-T88VI',
}

const categories: Category[] = [
  { id: 'c1', name: 'Drucker' } as Category,
]
const models: Model[] = []

// Helper: wrap <tr> in a table so React doesn't warn
function renderRow(ui: React.ReactElement) {
  return render(<table><tbody>{ui}</tbody></table>)
}

describe('DeliveryItemRow', () => {
  beforeEach(() => insertMock.mockClear())

  it('renders OCR hint when no manufacturer selected', () => {
    renderRow(
      <DeliveryItemRow
        row={baseRow} categories={categories} models={models}
        onChange={() => {}} onRemove={() => {}} onModelCreated={() => {}}
      />
    )
    expect(screen.getByText(/OCR: „Epson"/)).toBeInTheDocument()
  })

  it('calls onRemove when delete button clicked', () => {
    const onRemove = jest.fn()
    renderRow(
      <DeliveryItemRow
        row={baseRow} categories={categories} models={models}
        onChange={() => {}} onRemove={onRemove} onModelCreated={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('Zeile entfernen'))
    expect(onRemove).toHaveBeenCalledWith('r1')
  })

  it('updates serial_number on input', () => {
    const onChange = jest.fn()
    renderRow(
      <DeliveryItemRow
        row={baseRow} categories={categories} models={models}
        onChange={onChange} onRemove={() => {}} onModelCreated={() => {}}
      />
    )
    const sn = screen.getByPlaceholderText(/Seriennummer/i)
    fireEvent.change(sn, { target: { value: 'SN123' } })
    expect(onChange).toHaveBeenCalledWith('r1', expect.objectContaining({ serial_number: 'SN123' }))
  })

  it('creates a new model inline and calls onModelCreated + onChange', async () => {
    const onChange = jest.fn()
    const onModelCreated = jest.fn()
    const row: LieferscheinRowDraft = {
      ...baseRow,
      manufacturer_id: 'mf1',
      category_id: 'c1',
    }
    renderRow(
      <DeliveryItemRow
        row={row} categories={categories} models={models}
        onChange={onChange} onRemove={() => {}} onModelCreated={onModelCreated}
      />
    )
    fireEvent.click(screen.getByLabelText('Modell neu anlegen'))
    const input = screen.getByPlaceholderText(/Modellname/i)
    fireEvent.change(input, { target: { value: 'TM-T88VI' } })
    fireEvent.click(screen.getByText('Anlegen'))

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled()
      expect(onModelCreated).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith('r1', expect.objectContaining({ model_id: 'new-model' }))
    })
  })
})
