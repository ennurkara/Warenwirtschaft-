'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Manufacturer, Model } from '@/lib/types'

interface ModelPickerProps {
  categoryId: string
  value: string
  onChange: (modelId: string, model: Model | null) => void
}

export function ModelPicker({ categoryId, value, onChange }: ModelPickerProps) {
  const supabase = createClient()
  const [models, setModels] = useState<Model[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [showNew, setShowNew] = useState(false)
  const [nm, setNm] = useState({ manufacturer_id: '', modellname: '', variante: '', version: '' })

  async function refresh() {
    const { data: m } = await supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*)')
      .eq('category_id', categoryId)
      .order('modellname')
    setModels((m ?? []) as Model[])
    const { data: mf } = await supabase.from('manufacturers').select('*').order('name')
    setManufacturers(mf ?? [])
  }

  useEffect(() => {
    if (categoryId) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  async function createModel() {
    if (!nm.manufacturer_id || !nm.modellname) {
      toast.error('Hersteller und Modellname sind Pflicht')
      return
    }
    const { data, error } = await supabase.from('models').insert({
      manufacturer_id: nm.manufacturer_id,
      category_id: categoryId,
      modellname: nm.modellname,
      variante: nm.variante || null,
      version: nm.version || null,
    }).select('id').single()
    if (error) { toast.error('Modell konnte nicht angelegt werden', { description: error.message }); return }
    const { data: fresh } = await supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*)')
      .eq('id', data.id)
      .single()
    await refresh()
    onChange(data.id, (fresh as Model) ?? null)
    setShowNew(false)
    setNm({ manufacturer_id: '', modellname: '', variante: '', version: '' })
  }

  return (
    <div className="space-y-2">
      <Label>Modell *</Label>
      <div className="flex gap-2">
        <Select
          value={value}
          onValueChange={id => onChange(id, models.find(m => m.id === id) ?? null)}
        >
          <SelectTrigger className="flex-1"><SelectValue placeholder="Modell wählen..." /></SelectTrigger>
          <SelectContent>
            {models.map(m => (
              <SelectItem key={m.id} value={m.id}>
                {m.manufacturer?.name} {m.modellname}
                {m.variante ? ` ${m.variante}` : ''}
                {m.version ? ` v${m.version}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={() => setShowNew(v => !v)}>
          {showNew ? 'Abbrechen' : '+ Neu'}
        </Button>
      </div>

      {showNew && (
        <div className="border rounded p-3 space-y-2 bg-slate-50">
          <div>
            <Label>Hersteller *</Label>
            <Select value={nm.manufacturer_id} onValueChange={v => setNm(p => ({ ...p, manufacturer_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Hersteller wählen..." /></SelectTrigger>
              <SelectContent>
                {manufacturers.map(mf => <SelectItem key={mf.id} value={mf.id}>{mf.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Modellname *</Label><Input value={nm.modellname} onChange={e => setNm(p => ({ ...p, modellname: e.target.value }))} /></div>
          <div><Label>Variante</Label><Input value={nm.variante} onChange={e => setNm(p => ({ ...p, variante: e.target.value }))} /></div>
          <div><Label>Version</Label><Input value={nm.version} onChange={e => setNm(p => ({ ...p, version: e.target.value }))} /></div>
          <Button type="button" onClick={createModel}>Anlegen</Button>
        </div>
      )}
    </div>
  )
}
