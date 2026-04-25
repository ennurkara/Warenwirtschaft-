'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EntityPicker } from '@/components/inventory/entity-picker'
import { DeliveryItemRow } from '@/components/delivery/delivery-item-row'
import { toast } from 'sonner'
import type { LieferscheinOcrResponse, LieferscheinRowDraft, Category, Model, LieferscheinRpcPayload } from '@/lib/types'
import { normalizeCompanyName } from '@/lib/company-match'

interface Props {
  ocr: LieferscheinOcrResponse
  categories: Category[]
  models: Model[]
  previewUrl: string
  onModelsRefresh: () => Promise<void>
}

function expandOcrToRows(ocr: LieferscheinOcrResponse, models: Model[]): LieferscheinRowDraft[] {
  const rows: LieferscheinRowDraft[] = []
  let counter = 0
  for (const item of ocr.items) {
    const expand = item.quantity > 1 && !item.serial_number ? item.quantity : 1
    const ocrMfr = normalizeCompanyName(item.manufacturer)
    const ocrModel = (item.name ?? '').toLowerCase().trim()
    for (let i = 0; i < expand; i++) {
      const match = ocrMfr && ocrModel
        ? models.find(m => {
            const mfr = normalizeCompanyName(m.manufacturer?.name)
            if (!mfr) return false
            const modelName = (m.modellname ?? '').toLowerCase().trim()
            const mfrMatch = mfr === ocrMfr || mfr.includes(ocrMfr) || ocrMfr.includes(mfr)
            return mfrMatch && modelName === ocrModel
          })
        : undefined
      rows.push({
        client_id: `r${counter++}`,
        manufacturer_id: match?.manufacturer_id ?? null,
        model_id: match?.id ?? null,
        category_id: match?.category_id ?? null,
        serial_number: i === 0 ? item.serial_number : null,
        sw_serial: i === 0 ? item.sw_serial ?? null : null,
        location: null,
        notes: null,
        ek_preis: item.ek_preis,
        ocr_manufacturer: item.manufacturer,
        ocr_name: item.name,
      })
    }
  }
  return rows
}

export function DeliveryReview({ ocr, categories, models, previewUrl, onModelsRefresh }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [supplier_id, setSupplierId] = useState('')
  const [rechnungsnr, setRechnungsnr] = useState(ocr.rechnungsnr ?? '')
  const [datum, setDatum] = useState(ocr.datum ?? new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState<LieferscheinRowDraft[]>(() => expandOcrToRows(ocr, models))
  const [saving, setSaving] = useState(false)

  function patchRow(id: string, p: Partial<LieferscheinRowDraft>) {
    setRows(prev => prev.map(r => (r.client_id === id ? { ...r, ...p } : r)))
  }
  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.client_id !== id))
  }
  function addBlankRow() {
    setRows(prev => [...prev, {
      client_id: `r${Date.now()}`,
      manufacturer_id: null, model_id: null, category_id: null,
      serial_number: null, sw_serial: null, location: null, notes: null, ek_preis: null,
      ocr_manufacturer: null, ocr_name: null,
    }])
  }

  const isPdf = useMemo(
    () => ocr.source_path.toLowerCase().endsWith('.pdf'),
    [ocr.source_path],
  )

  async function save() {
    if (!supplier_id) { toast.error('Lieferant wählen'); return }
    const missing = rows.findIndex(r => !r.model_id)
    if (missing >= 0) { toast.error(`Zeile ${missing + 1}: Modell fehlt`); return }
    if (rows.length === 0) { toast.error('Mindestens eine Zeile erforderlich'); return }

    setSaving(true)
    const payload: LieferscheinRpcPayload = {
      supplier_id,
      rechnungsnr: rechnungsnr || null,
      datum,
      source_document_path: ocr.source_path,
      items: rows.map(r => ({
        model_id: r.model_id!,
        serial_number: r.serial_number,
        sw_serial: r.sw_serial,
        location: r.location,
        notes: r.notes,
        ek_preis: r.ek_preis,
      })),
    }
    const { data, error } = await supabase.rpc('create_lieferschein', { payload })
    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        toast.error('Seriennummer bereits vergeben', { description: error.message })
      } else {
        toast.error('Speichern fehlgeschlagen', { description: error.message })
      }
      return
    }
    toast.success(`${rows.length} Geräte angelegt`)
    router.push(`/inventory?purchase=${data}`)
    router.refresh()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="border rounded-lg bg-slate-50 overflow-hidden flex items-center justify-center" style={{ height: '80vh' }}>
        {isPdf
          ? <iframe src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`} className="w-full h-full border-0" title="Lieferschein" />
          : <img src={previewUrl} alt="Lieferschein" className="max-w-full max-h-full object-contain" />}
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Rechnungsnr</Label><Input value={rechnungsnr} onChange={e => setRechnungsnr(e.target.value)} /></div>
          <div><Label>Datum</Label><Input type="date" value={datum} onChange={e => setDatum(e.target.value)} /></div>
          <div><EntityPicker table="suppliers" label="Lieferant" value={supplier_id} onChange={setSupplierId} prefillNameHint={ocr.supplier} /></div>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="p-2 text-left">Hersteller</th>
                <th className="p-2 text-left">Modell</th>
                <th className="p-2 text-left">Kategorie</th>
                <th className="p-2 text-left">SN</th>
                <th className="p-2 text-left">Standort</th>
                <th className="p-2 text-left">EK €</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <DeliveryItemRow
                  key={r.client_id}
                  row={r} categories={categories} models={models}
                  onChange={patchRow} onRemove={removeRow}
                  onModelCreated={onModelsRefresh}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={addBlankRow}>+ Zeile</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? 'Speichern…' : 'Alle speichern'}
          </Button>
        </div>
      </div>
    </div>
  )
}
