'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Manufacturer { id: string; name: string }

interface ManufacturerPickerProps {
  value: string
  onChange: (id: string) => void
  hint?: string | null             // OCR value shown when no DB match
}

export function ManufacturerPicker({ value, onChange, hint }: ManufacturerPickerProps) {
  const supabase = createClient()
  const [items, setItems] = useState<Manufacturer[]>([])
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState(hint ?? '')

  async function refresh() {
    const { data } = await supabase.from('manufacturers').select('id, name').order('name')
    setItems((data ?? []) as Manufacturer[])
  }
  useEffect(() => { refresh() }, [])

  async function create() {
    if (!name.trim()) { toast.error('Name ist Pflicht'); return }
    const { data, error } = await supabase.from('manufacturers').insert({ name: name.trim() }).select('id').single()
    if (error) { toast.error('Konnte nicht angelegt werden', { description: error.message }); return }
    await refresh()
    onChange(data.id)
    setShowNew(false)
    setName('')
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Hersteller wählen..." /></SelectTrigger>
          <SelectContent>
            {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Abbrechen' : '+ Neu'}
        </Button>
      </div>
      {hint && !value && !showNew && (
        <p className="text-xs text-amber-600">{'OCR: „'}{hint}{'" — nicht in DB, bitte wählen oder anlegen.'}</p>
      )}
      {showNew && (
        <div className="border rounded p-2 space-y-2 bg-slate-50">
          <Label className="text-xs">Hersteller-Name</Label>
          <Input placeholder="Hersteller-Name" value={name} onChange={e => setName(e.target.value)} />
          <Button type="button" size="sm" onClick={create}>Anlegen</Button>
        </div>
      )}
    </div>
  )
}
