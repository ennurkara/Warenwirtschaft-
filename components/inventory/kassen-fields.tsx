'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface KassenFormState {
  fiskal_2020: boolean
  zvt: boolean
  hw_serial: string
  sw_serial: string
  tse_serial: string
  tse_valid_until: string   // ISO-Date-String ('' = leer)
}

export const INITIAL_KASSEN: KassenFormState = {
  fiskal_2020: false, zvt: false,
  hw_serial: '', sw_serial: '', tse_serial: '', tse_valid_until: '',
}

interface Props {
  value: KassenFormState
  onChange: (v: KassenFormState) => void
}

export function KassenFields({ value, onChange }: Props) {
  function set<K extends keyof KassenFormState>(k: K, v: KassenFormState[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <fieldset className="border rounded p-4 space-y-3">
      <legend className="px-2 text-sm font-medium">Kassen-Details</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label>HW-Seriennummer</Label><Input value={value.hw_serial} onChange={e => set('hw_serial', e.target.value)} className="font-mono" /></div>
        <div><Label>SW-Seriennummer</Label><Input value={value.sw_serial} onChange={e => set('sw_serial', e.target.value)} className="font-mono" /></div>
        <div><Label>TSE-Seriennummer</Label><Input value={value.tse_serial} onChange={e => set('tse_serial', e.target.value)} className="font-mono" /></div>
        <div><Label>TSE gültig bis</Label><Input type="date" value={value.tse_valid_until} onChange={e => set('tse_valid_until', e.target.value)} /></div>
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.fiskal_2020} onChange={e => set('fiskal_2020', e.target.checked)} /> Fiskal 2020</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.zvt} onChange={e => set('zvt', e.target.checked)} /> ZVT-Schnittstelle</label>
      </div>
    </fieldset>
  )
}
