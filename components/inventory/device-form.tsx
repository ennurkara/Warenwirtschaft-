'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ModelPicker } from '@/components/inventory/model-picker'
import { EntityPicker } from '@/components/inventory/entity-picker'
import { VectronFields, INITIAL_VECTRON, VectronFormState } from '@/components/inventory/vectron-fields'
import type { Category, Model } from '@/lib/types'

interface DeviceFormProps {
  categories: Category[]
  prefill?: { serial_number?: string }
  isAdmin: boolean
}

export function DeviceForm({ categories, prefill, isAdmin }: DeviceFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const [category_id, setCategoryId] = useState('')
  const category = categories.find(c => c.id === category_id)
  const isKassenhardware = category?.name === 'Kassenhardware'

  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const isVectron = selectedModel?.manufacturer?.name === 'Vectron'

  const [core, setCore] = useState({
    model_id: '',
    serial_number: prefill?.serial_number ?? '',
    location: '',
    notes: '',
  })
  const [vectron, setVectron] = useState<VectronFormState>(INITIAL_VECTRON)

  const [purchase, setPurchase] = useState({
    supplier_id: '',
    rechnungsnr: '',
    datum: new Date().toISOString().slice(0, 10),
    ek_preis: '',
  })

  // Modell-Defaults als Basis für Warnungen / Auto-Fill
  const modelHasEk = selectedModel?.default_ek != null
  const modelHasSupplier = selectedModel?.default_supplier_id != null
  const hasFullPurchase = !!(purchase.supplier_id && purchase.ek_preis)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category_id) { toast.error('Kategorie wählen'); return }
    if (!core.model_id) { toast.error('Modell wählen'); return }

    setIsLoading(true)

    // 1. device insert
    const { data: device, error: devErr } = await supabase.from('devices').insert({
      model_id: core.model_id,
      serial_number: core.serial_number || null,
      status: 'lager',
      location: core.location || null,
      notes: core.notes || null,
    }).select('id').single()

    if (devErr) { toast.error('Gerät konnte nicht angelegt werden', { description: devErr.message }); setIsLoading(false); return }

    // 2. vectron_details insert (nur wenn Kassenhardware + Vectron)
    if (isKassenhardware && isVectron) {
      const { error: vErr } = await supabase.from('vectron_details').insert({
        device_id: device.id,
        sw_serial: vectron.sw_serial || null,
        fiskal_2020: vectron.fiskal_2020,
        zvt: vectron.zvt,
        license_type: vectron.license_type,
      })
      if (vErr) { toast.error('Vectron-Details fehlgeschlagen', { description: vErr.message }); setIsLoading(false); return }
    }

    // 3. Einkaufsbeleg nur anlegen wenn Lieferant UND EK gesetzt.
    //    Fehlt eins → Gerät steht ohne Beleg im Lager, Dashboard flaggt es.
    if (hasFullPurchase) {
      let purchase_id: string | null = null
      const rechnungsnr = purchase.rechnungsnr || ''
      const { data: existing } = await supabase
        .from('purchases')
        .select('id')
        .eq('supplier_id', purchase.supplier_id)
        .eq('datum', purchase.datum)
        .eq('rechnungsnr', rechnungsnr)
        .maybeSingle()

      if (existing?.id) {
        purchase_id = existing.id
      } else {
        const { data: newP, error: pErr } = await supabase.from('purchases').insert({
          supplier_id: purchase.supplier_id,
          rechnungsnr: purchase.rechnungsnr || null,
          datum: purchase.datum,
        }).select('id').single()
        if (pErr) { toast.error('Einkaufsbeleg fehlgeschlagen', { description: pErr.message }); setIsLoading(false); return }
        purchase_id = newP.id
      }

      const { error: piErr } = await supabase.from('purchase_items').insert({
        purchase_id,
        device_id: device.id,
        ek_preis: Number(purchase.ek_preis),
      })
      if (piErr) { toast.error('Beleg-Position fehlgeschlagen', { description: piErr.message }); setIsLoading(false); return }
    }

    toast.success(hasFullPurchase ? 'Gerät hinzugefügt' : 'Gerät ohne Einkaufsbeleg angelegt — Admin ergänzt später')
    router.push(`/inventory?category=${category_id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Label>Kategorie *</Label>
        <Select value={category_id} onValueChange={v => { setCategoryId(v); setSelectedModel(null); setCore(p => ({ ...p, model_id: '' })); setPurchase(p => ({ ...p, supplier_id: '', ek_preis: '' })) }}>
          <SelectTrigger><SelectValue placeholder="Kategorie wählen..." /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {category_id && (
        <>
          <ModelPicker
            categoryId={category_id}
            value={core.model_id}
            onChange={(id, model) => {
              setCore(p => ({ ...p, model_id: id }))
              setSelectedModel(model)
              setPurchase(p => ({
                ...p,
                ek_preis: model?.default_ek != null ? String(model.default_ek) : (isAdmin ? p.ek_preis : ''),
                supplier_id: model?.default_supplier_id ?? (isAdmin ? p.supplier_id : ''),
              }))
            }}
          />

          <div className="space-y-2">
            <Label>{isKassenhardware ? 'Hardware-Seriennummer' : 'Seriennummer'}</Label>
            <Input value={core.serial_number} onChange={e => setCore(p => ({ ...p, serial_number: e.target.value }))} className="font-mono" />
          </div>

          {isKassenhardware && isVectron && <VectronFields value={vectron} onChange={setVectron} />}

          <div className="space-y-2">
            <Label>Standort</Label>
            <Input value={core.location} onChange={e => setCore(p => ({ ...p, location: e.target.value }))} placeholder="z.B. Lager Raum 2, Regal B3" />
          </div>

          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea rows={3} value={core.notes} onChange={e => setCore(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <fieldset className="border rounded p-4 space-y-3">
            <legend className="px-2 text-sm font-medium">Einkauf <span className="text-slate-500 font-normal">(optional)</span></legend>
            {selectedModel && !modelHasSupplier && !modelHasEk && (
              <p className="text-xs text-amber-600">
                Kein Standard-Lieferant und kein Standardpreis am Modell hinterlegt. Beleg bleibt leer — Admin ergänzt später. Das Gerät erscheint im Dashboard unter „Unvollständige Geräte".
              </p>
            )}
            <EntityPicker table="suppliers" label="Lieferant" value={purchase.supplier_id} onChange={v => setPurchase(p => ({ ...p, supplier_id: v }))} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label>Rechnungsnr</Label><Input value={purchase.rechnungsnr} onChange={e => setPurchase(p => ({ ...p, rechnungsnr: e.target.value }))} /></div>
              <div><Label>Datum</Label><Input type="date" value={purchase.datum} onChange={e => setPurchase(p => ({ ...p, datum: e.target.value }))} /></div>
              <div>
                <Label>Einkaufspreis (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchase.ek_preis}
                  onChange={e => setPurchase(p => ({ ...p, ek_preis: e.target.value }))}
                  readOnly={!isAdmin}
                  disabled={!isAdmin && !purchase.ek_preis}
                />
                {!isAdmin && !purchase.ek_preis && selectedModel && (
                  <p className="text-xs text-amber-600 mt-1">Kein Standardpreis — Admin ergänzt später.</p>
                )}
              </div>
            </div>
          </fieldset>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Speichern...' : 'Hinzufügen'}</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Abbrechen</Button>
          </div>
        </>
      )}
    </form>
  )
}
