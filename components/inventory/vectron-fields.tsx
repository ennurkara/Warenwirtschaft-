'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { VectronLicenseType } from '@/lib/types'

export interface VectronFormState {
  sw_serial: string
  fiskal_2020: boolean
  zvt: boolean
  license_type: VectronLicenseType
}

export const INITIAL_VECTRON: VectronFormState = {
  sw_serial: '',
  fiskal_2020: false,
  zvt: false,
  license_type: 'full',
}

interface Props {
  value: VectronFormState
  onChange: (v: VectronFormState) => void
}

export function VectronFields({ value, onChange }: Props) {
  function set<K extends keyof VectronFormState>(k: K, v: VectronFormState[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <fieldset className="border rounded p-4 space-y-3">
      <legend className="px-2 text-sm font-medium">Vectron-Details</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Software-Seriennummer</Label>
          <Input
            value={value.sw_serial}
            onChange={e => set('sw_serial', e.target.value)}
            className="font-mono"
            placeholder="z.B. VEC-12345"
          />
        </div>
        <div>
          <Label>Lizenzstufe *</Label>
          <Select value={value.license_type} onValueChange={v => set('license_type', v as VectronLicenseType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Full (Verbund-fähig)</SelectItem>
              <SelectItem value="light">Light (Standalone)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-6 pt-1">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={value.fiskal_2020} onChange={e => set('fiskal_2020', e.target.checked)} />
          Fiskal-2020-Lizenz
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={value.zvt} onChange={e => set('zvt', e.target.checked)} />
          ZVT-Lizenz
        </label>
      </div>
    </fieldset>
  )
}
