'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Category, Device, DeviceCondition, DeviceStatus } from '@/lib/types'

interface DeviceFormProps {
  categories: Category[]
  device?: Device
  isAdmin: boolean
  prefill?: { name?: string; serial_number?: string }
}

export function DeviceForm({ categories, device, isAdmin, prefill }: DeviceFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const [form, setForm] = useState({
    name: prefill?.name ?? device?.name ?? '',
    category_id: device?.category_id ?? '',
    serial_number: prefill?.serial_number ?? device?.serial_number ?? '',
    condition: (device?.condition ?? 'neu') as DeviceCondition,
    status: (device?.status ?? 'lager') as DeviceStatus,
    quantity: device?.quantity ?? 1,
    location: device?.location ?? '',
    notes: device?.notes ?? '',
  })

  useEffect(() => {
    if (prefill) {
      setForm(prev => ({
        ...prev,
        ...(prefill.name && { name: prefill.name }),
        ...(prefill.serial_number && { serial_number: prefill.serial_number }),
      }))
    }
  }, [prefill])

  function set(key: string, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const payload = {
      name: form.name,
      category_id: form.category_id,
      serial_number: form.serial_number || null,
      condition: form.condition,
      status: form.status,
      quantity: Number(form.quantity),
      location: form.location || null,
      notes: form.notes || null,
    }

    if (device) {
      const { error } = await supabase.from('devices').update(payload).eq('id', device.id)
      if (error) {
        toast.error('Fehler beim Speichern', { description: error.message })
        setIsLoading(false)
        return
      }
      toast.success('Gerät aktualisiert')
    } else {
      const { error } = await supabase.from('devices').insert(payload)
      if (error) {
        toast.error('Fehler beim Erstellen', { description: error.message })
        setIsLoading(false)
        return
      }
      toast.success('Gerät hinzugefügt')
    }

    router.push('/inventory')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Gerätename *</Label>
          <Input id="name" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Kategorie *</Label>
          <Select value={form.category_id} onValueChange={v => set('category_id', v)}>
            <SelectTrigger id="category">
              <SelectValue placeholder="Kategorie wählen..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="serial">Seriennummer</Label>
          <Input id="serial" value={form.serial_number} onChange={e => set('serial_number', e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="condition">Zustand *</Label>
          <Select value={form.condition} onValueChange={v => set('condition', v as DeviceCondition)}>
            <SelectTrigger id="condition"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neu">Neu</SelectItem>
              <SelectItem value="gebraucht">Gebraucht</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isAdmin && (
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v as DeviceStatus)}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lager">Im Lager</SelectItem>
                <SelectItem value="im_einsatz">Im Einsatz</SelectItem>
                <SelectItem value="defekt">Defekt</SelectItem>
                <SelectItem value="ausgemustert">Ausgemustert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="quantity">Menge *</Label>
          <Input id="quantity" type="number" min="0" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="location">Standort</Label>
          <Input id="location" placeholder="z.B. Lager Raum 2, Regal B3" value={form.location} onChange={e => set('location', e.target.value)} />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="notes">Notizen</Label>
          <Textarea id="notes" value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={isLoading}>{isLoading ? 'Speichern...' : (device ? 'Aktualisieren' : 'Hinzufügen')}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Abbrechen</Button>
      </div>
    </form>
  )
}