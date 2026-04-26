'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import type { Model } from '@/lib/types'

type AproLicenseModel = Model & {
  manufacturer?: { name: string } | null
  category?: { name: string } | null
}

export function AddLicenseDialog({ customerId }: { customerId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<AproLicenseModel[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const [modelId, setModelId] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10))
  const [monthlyFee, setMonthlyFee] = useState('')
  const [vkPreis, setVkPreis] = useState('')
  const [ekPreis, setEkPreis] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'aktiv' | 'gekuendigt' | 'abgelaufen'>('aktiv')

  // Apro-Lizenz-Modelle aus dem Katalog laden, sobald der Dialog erstmals geöffnet wird.
  useEffect(() => {
    if (!open || catalog.length > 0) return
    void supabase
      .from('models')
      .select('*, manufacturer:manufacturers(name), category:categories(name)')
      .order('modellname')
      .then(({ data }) => {
        const list = (data ?? []) as unknown as AproLicenseModel[]
        const apro = list.filter(
          m => m.manufacturer?.name === 'Apro' && m.category?.name === 'Apro-Lizenz',
        )
        setCatalog(apro)
      })
  }, [open, catalog.length, supabase])

  const selected = catalog.find(m => m.id === modelId) ?? null

  function handleModelChange(id: string) {
    setModelId(id)
    const m = catalog.find(x => x.id === id)
    if (!m) return
    if (m.default_monthly_update_fee_vk != null) setMonthlyFee(String(m.default_monthly_update_fee_vk))
    if (m.default_vk != null) setVkPreis(String(m.default_vk))
    if (m.default_ek != null) setEkPreis(String(m.default_ek))
  }

  async function handleSave() {
    if (!modelId) {
      toast.error('Lizenz-Modell wählen')
      return
    }
    if (!selected) {
      toast.error('Modell nicht gefunden')
      return
    }
    setIsSaving(true)
    const { error } = await supabase.from('licenses').insert({
      customer_id: customerId,
      model_id: modelId,
      name: selected.modellname,
      license_key: licenseKey || null,
      purchased_at: purchasedAt || null,
      monthly_update_fee: monthlyFee ? Number(monthlyFee) : null,
      vk_preis: vkPreis ? Number(vkPreis) : null,
      ek_preis: ekPreis ? Number(ekPreis) : null,
      status,
      notes: notes || null,
    })
    setIsSaving(false)
    if (error) {
      toast.error('Lizenz konnte nicht angelegt werden', { description: error.message })
      return
    }
    toast.success('Lizenz hinzugefügt')
    setOpen(false)
    setModelId(''); setLicenseKey(''); setMonthlyFee(''); setVkPreis(''); setEkPreis(''); setNotes('')
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Lizenz hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Apro-Lizenz hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Lizenz-Modell *</Label>
            <Select value={modelId} onValueChange={handleModelChange}>
              <SelectTrigger><SelectValue placeholder={catalog.length ? 'Lizenz aus Katalog wählen…' : 'Lade Katalog…'} /></SelectTrigger>
              <SelectContent>
                {catalog.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.modellname}
                    {m.default_vk != null ? `  ·  VK ${Number(m.default_vk).toFixed(2)} €` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.notes && (
              <p className="text-[11.5px] text-[var(--ink-3)] pt-0.5">{selected.notes}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Erworben am</Label>
              <Input type="date" value={purchasedAt} onChange={e => setPurchasedAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aktiv">Aktiv</SelectItem>
                  <SelectItem value="gekuendigt">Gekündigt</SelectItem>
                  <SelectItem value="abgelaufen">Abgelaufen</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Lizenz-Key</Label>
            <Input
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              className="font-mono"
              placeholder="z.B. APRO-XYZ-1234"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>VK einmalig (€)</Label>
              <Input type="number" step="0.01" value={vkPreis} onChange={e => setVkPreis(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>EK einmalig (€)</Label>
              <Input type="number" step="0.01" value={ekPreis} onChange={e => setEkPreis(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Update / Monat (€)</Label>
              <Input type="number" step="0.01" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notiz</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSaving}>Abbrechen</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Speichere…' : 'Hinzufügen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
