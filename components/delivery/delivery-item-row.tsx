'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ManufacturerPicker } from '@/components/inventory/manufacturer-picker'
import { toast } from 'sonner'
import { X, Plus } from 'lucide-react'
import type { LieferscheinRowDraft, Category, Model } from '@/lib/types'

interface Props {
  row: LieferscheinRowDraft
  categories: Category[]
  models: Model[]
  onChange: (client_id: string, patch: Partial<LieferscheinRowDraft>) => void
  onRemove: (client_id: string) => void
  onModelCreated: () => Promise<void> | void
}

export function DeliveryItemRow({ row, categories, models, onChange, onRemove, onModelCreated }: Props) {
  const supabase = createClient()
  const [showNewModel, setShowNewModel] = useState(false)
  const [newModelName, setNewModelName] = useState(row.ocr_name ?? '')

  const availableModels = row.manufacturer_id
    ? models.filter(m => m.manufacturer_id === row.manufacturer_id)
    : []

  const canCreateModel = !!row.manufacturer_id && !!row.category_id

  function patch(p: Partial<LieferscheinRowDraft>) {
    onChange(row.client_id, p)
  }

  async function createModel() {
    if (!row.manufacturer_id || !row.category_id) {
      toast.error('Hersteller und Kategorie müssen erst gesetzt sein')
      return
    }
    if (!newModelName.trim()) { toast.error('Modellname erforderlich'); return }
    const { data, error } = await supabase.from('models').insert({
      manufacturer_id: row.manufacturer_id,
      category_id: row.category_id,
      modellname: newModelName.trim(),
    }).select('id').single()
    if (error) { toast.error('Modell konnte nicht angelegt werden', { description: error.message }); return }
    await onModelCreated()
    patch({ model_id: data.id })
    setShowNewModel(false)
  }

  return (
    <>
      <tr className="border-b">
        <td className="p-2 align-top min-w-[180px]">
          <ManufacturerPicker
            value={row.manufacturer_id ?? ''}
            onChange={id => patch({ manufacturer_id: id, model_id: null })}
            hint={row.ocr_manufacturer}
          />
        </td>
        <td className="p-2 align-top min-w-[220px]">
          <div className="flex gap-1">
            <Select
              value={row.model_id ?? ''}
              onValueChange={id => {
                const m = availableModels.find(x => x.id === id)
                patch({ model_id: id, category_id: m?.category_id ?? row.category_id })
              }}
              disabled={!row.manufacturer_id}
            >
              <SelectTrigger className="flex-1"><SelectValue placeholder="Modell..." /></SelectTrigger>
              <SelectContent>
                {availableModels.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.modellname}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="icon"
              aria-label="Modell neu anlegen"
              disabled={!canCreateModel}
              onClick={() => setShowNewModel(v => !v)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {row.ocr_name && !row.model_id && (
            <p className="text-xs text-amber-600 mt-1">OCR: „{row.ocr_name}"</p>
          )}
          {!canCreateModel && row.manufacturer_id && !row.category_id && (
            <p className="text-xs text-slate-500 mt-1">Erst Kategorie wählen, dann neues Modell anlegen.</p>
          )}
        </td>
        <td className="p-2 align-top min-w-[150px]">
          <Select value={row.category_id ?? ''} onValueChange={id => patch({ category_id: id })}>
            <SelectTrigger><SelectValue placeholder="Kategorie..." /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="p-2 align-top min-w-[140px]">
          <Input
            placeholder="Seriennummer"
            className="font-mono"
            value={row.serial_number ?? ''}
            onChange={e => patch({ serial_number: e.target.value || null })}
          />
        </td>
        <td className="p-2 align-top min-w-[120px]">
          <Input
            placeholder="Standort"
            value={row.location ?? ''}
            onChange={e => patch({ location: e.target.value || null })}
          />
        </td>
        <td className="p-2 align-top min-w-[100px]">
          <Input
            type="number" step="0.01" min="0" placeholder="EK €"
            value={row.ek_preis ?? ''}
            onChange={e => patch({ ek_preis: e.target.value ? Number(e.target.value) : null })}
          />
        </td>
        <td className="p-2 align-top">
          <Button
            type="button" variant="ghost" size="icon"
            aria-label="Zeile entfernen"
            onClick={() => onRemove(row.client_id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      {showNewModel && (
        <tr className="bg-slate-50 border-b">
          <td colSpan={7} className="p-3">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Label className="text-xs">Modellname</Label>
                <Input
                  placeholder="Modellname (z.B. TM-T88VI)"
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                />
              </div>
              <Button type="button" onClick={createModel}>Anlegen</Button>
              <Button type="button" variant="ghost" onClick={() => setShowNewModel(false)}>Abbrechen</Button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
