/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ManufacturerPicker } from '@/components/inventory/manufacturer-picker'

const insertMock = jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null })
const selectMock = jest.fn().mockResolvedValue({ data: [{ id: 'm1', name: 'Epson' }], error: null })

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ order: selectMock }),
      insert: () => ({ select: () => ({ single: insertMock }) }),
    }),
  }),
}))

describe('ManufacturerPicker', () => {
  beforeEach(() => { insertMock.mockClear(); selectMock.mockClear() })

  it('renders existing manufacturers', async () => {
    render(<ManufacturerPicker value="" onChange={() => {}} />)
    await waitFor(() => expect(selectMock).toHaveBeenCalled())
  })

  it('creates a new manufacturer and calls onChange with new id', async () => {
    const onChange = jest.fn()
    render(<ManufacturerPicker value="" onChange={onChange} />)
    await waitFor(() => expect(selectMock).toHaveBeenCalled())

    fireEvent.click(screen.getByText('+ Neu'))
    const input = screen.getByPlaceholderText(/Hersteller-Name/i)
    fireEvent.change(input, { target: { value: 'Quad' } })
    fireEvent.click(screen.getByText('Anlegen'))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('new-id'))
  })
})
