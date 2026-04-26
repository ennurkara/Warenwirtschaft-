'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TseKind } from '@/lib/types'

export interface TseFormState {
  kind: TseKind
  bsi_k_tr_number: string
  expires_at: string
}

export const INITIAL_TSE: TseFormState = {
  kind: 'usb',
  bsi_k_tr_number: '',
  expires_at: '',
}

interface Props {
  value: TseFormState
  onChange: (v: TseFormState) => void
}

export function TseDetailBlock({ value, onChange }: Props) {
  function set<K extends keyof TseFormState>(k: K, v: TseFormState[K]) {
    onChange({ ...value, [k]: v })
  }
  return (
    <fieldset className="border rounded p-4 space-y-3">
      <legend className="px-2 text-sm font-medium">TSE-Details</legend>
      <div>
        <Label>Art *</Label>
        <div className="flex gap-4 mt-1">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tse_kind"
              checked={value.kind === 'usb'}
              onChange={() => set('kind', 'usb')}
            />
            USB
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="tse_kind"
              checked={value.kind === 'sd'}
              onChange={() => set('kind', 'sd')}
            />
            microSD
          </label>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>BSI-K-TR-Nummer</Label>
          <Input
            value={value.bsi_k_tr_number}
            onChange={e => set('bsi_k_tr_number', e.target.value)}
            className="font-mono"
            placeholder="z.B. BSI-K-TR-0123-2024"
          />
        </div>
        <div>
          <Label>Ablaufdatum</Label>
          <Input
            type="date"
            value={value.expires_at}
            onChange={e => set('expires_at', e.target.value)}
          />
        </div>
      </div>
    </fieldset>
  )
}
