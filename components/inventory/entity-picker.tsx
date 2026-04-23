'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { findCompanyMatches } from '@/lib/company-match'

type EntityTable = 'suppliers' | 'customers'

interface Entity { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null }

interface EntityPickerProps {
  table: EntityTable
  label: string
  value: string
  onChange: (id: string) => void
  /** If set and the current value is empty, attempts a fuzzy match once after load
   *  and auto-selects the entity if exactly one candidate matches. */
  prefillNameHint?: string | null
}

export function EntityPicker({ table, label, value, onChange, prefillNameHint }: EntityPickerProps) {
  const supabase = createClient()
  const [items, setItems] = useState<Entity[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const prefillTriedRef = useRef(false)

  async function refresh() {
    const { data } = await supabase.from(table).select('id, name, email, phone, address').order('name')
    setItems((data ?? []) as Entity[])
  }

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    if (prefillTriedRef.current) return
    if (value) return
    if (!prefillNameHint) return
    if (items.length === 0) return
    prefillTriedRef.current = true
    const matches = findCompanyMatches(items, prefillNameHint)
    if (matches.length === 1) onChange(matches[0].id)
  }, [items, prefillNameHint, value, onChange])

  async function create() {
    if (!form.name) { toast.error('Name ist Pflicht'); return }
    const { data, error } = await supabase.from(table).insert({
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
    }).select('id').single()
    if (error) { toast.error('Konnte nicht angelegt werden', { description: error.message }); return }
    await refresh()
    onChange(data.id)
    setShowNew(false)
    setForm({ name: '', email: '', phone: '', address: '' })
  }

  return (
    <div className="space-y-2">
      <Label>{label} *</Label>
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder={`${label} wählen...`} /></SelectTrigger>
          <SelectContent>
            {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Abbrechen' : '+ Neu'}
        </Button>
      </div>

      {showNew && (
        <div className="border rounded p-3 space-y-2 bg-slate-50">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div><Label>Telefon</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          <Button type="button" onClick={create}>Anlegen</Button>
        </div>
      )}
    </div>
  )
}
