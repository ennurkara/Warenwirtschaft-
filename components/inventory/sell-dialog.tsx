'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { EntityPicker } from '@/components/inventory/entity-picker'

interface SellDialogProps { deviceId: string }

export function SellDialog({ deviceId }: SellDialogProps) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    customer_id: '',
    rechnungsnr: '',
    datum: new Date().toISOString().slice(0, 10),
    vk_preis: '',
  })

  async function sell() {
    if (!form.customer_id || !form.vk_preis) { toast.error('Kunde und Preis pflichtfeld'); return }
    setLoading(true)

    const rechnungsnr = form.rechnungsnr || ''
    const { data: existing } = await supabase
      .from('sales')
      .select('id')
      .eq('customer_id', form.customer_id)
      .eq('datum', form.datum)
      .eq('rechnungsnr', rechnungsnr)
      .maybeSingle()

    let sale_id = existing?.id
    if (!sale_id) {
      const { data: newS, error } = await supabase.from('sales').insert({
        customer_id: form.customer_id,
        rechnungsnr: form.rechnungsnr || null,
        datum: form.datum,
      }).select('id').single()
      if (error) { toast.error('Verkaufsbeleg fehlgeschlagen', { description: error.message }); setLoading(false); return }
      sale_id = newS.id
    }

    const { error: siErr } = await supabase.from('sale_items').insert({
      sale_id, device_id: deviceId, vk_preis: Number(form.vk_preis),
    })
    if (siErr) { toast.error('Position fehlgeschlagen', { description: siErr.message }); setLoading(false); return }

    const { error: dErr } = await supabase.from('devices').update({ status: 'verkauft' }).eq('id', deviceId)
    if (dErr) { toast.error('Status-Update fehlgeschlagen', { description: dErr.message }); setLoading(false); return }

    toast.success('Gerät verkauft')
    setOpen(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>Verkaufen</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerät verkaufen</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <EntityPicker table="customers" label="Kunde" value={form.customer_id} onChange={v => setForm(p => ({ ...p, customer_id: v }))} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label>Rechnungsnr</Label><Input value={form.rechnungsnr} onChange={e => setForm(p => ({ ...p, rechnungsnr: e.target.value }))} /></div>
            <div><Label>Datum</Label><Input type="date" value={form.datum} onChange={e => setForm(p => ({ ...p, datum: e.target.value }))} /></div>
            <div><Label>VK (€) *</Label><Input type="number" step="0.01" min="0" value={form.vk_preis} onChange={e => setForm(p => ({ ...p, vk_preis: e.target.value }))} /></div>
          </div>
          <Button onClick={sell} disabled={loading}>{loading ? 'Speichern...' : 'Verkauf abschließen'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
