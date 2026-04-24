'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { EntityPicker } from '@/components/inventory/entity-picker'

export function AddPurchaseForm({ deviceId }: { deviceId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    supplier_id: '',
    rechnungsnr: '',
    datum: new Date().toISOString().slice(0, 10),
    ek_preis: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.supplier_id) { toast.error('Lieferant wählen'); return }
    if (!form.ek_preis) { toast.error('EK eingeben'); return }

    setIsLoading(true)

    let purchase_id: string | null = null
    const rechnungsnr = form.rechnungsnr || ''
    const { data: existing } = await supabase
      .from('purchases')
      .select('id')
      .eq('supplier_id', form.supplier_id)
      .eq('datum', form.datum)
      .eq('rechnungsnr', rechnungsnr)
      .maybeSingle()

    if (existing?.id) {
      purchase_id = existing.id
    } else {
      const { data: newP, error: pErr } = await supabase.from('purchases').insert({
        supplier_id: form.supplier_id,
        rechnungsnr: form.rechnungsnr || null,
        datum: form.datum,
      }).select('id').single()
      if (pErr) { toast.error('Einkaufsbeleg fehlgeschlagen', { description: pErr.message }); setIsLoading(false); return }
      purchase_id = newP.id
    }

    const { error: piErr } = await supabase.from('purchase_items').insert({
      purchase_id,
      device_id: deviceId,
      ek_preis: Number(form.ek_preis),
    })
    if (piErr) { toast.error('Beleg-Position fehlgeschlagen', { description: piErr.message }); setIsLoading(false); return }

    toast.success('Einkaufsdaten ergänzt')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-amber-300 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">Einkauf nachpflegen</p>
      <EntityPicker
        table="suppliers"
        label="Lieferant"
        value={form.supplier_id}
        onChange={v => setForm(p => ({ ...p, supplier_id: v }))}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Rechnungsnr</Label>
          <Input value={form.rechnungsnr} onChange={e => setForm(p => ({ ...p, rechnungsnr: e.target.value }))} />
        </div>
        <div>
          <Label>Datum</Label>
          <Input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} />
        </div>
        <div>
          <Label>Einkaufspreis (€) *</Label>
          <Input type="number" step="0.01" min="0" value={form.ek_preis} onChange={e => setForm(p => ({ ...p, ek_preis: e.target.value }))} required />
        </div>
      </div>
      <Button type="submit" disabled={isLoading}>{isLoading ? 'Speichern...' : 'Speichern'}</Button>
    </form>
  )
}
