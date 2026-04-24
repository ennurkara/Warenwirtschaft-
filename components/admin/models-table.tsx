'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import type { Manufacturer, Category, Model, Supplier } from '@/lib/types'

const NO_SUPPLIER = '__none__'

export function ModelsTable() {
  const supabase = createClient()
  const [models, setModels] = useState<Model[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [form, setForm] = useState({
    manufacturer_id: '',
    category_id: '',
    modellname: '',
    default_ek: '',
    default_vk: '',
  })

  async function refresh() {
    const { data: m } = await supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*), category:categories(*), default_supplier:suppliers!default_supplier_id(*)')
      .order('modellname')
    setModels((m ?? []) as Model[])
    const { data: mf } = await supabase.from('manufacturers').select('*').order('name')
    setManufacturers(mf ?? [])
    const { data: c } = await supabase.from('categories').select('*').order('name')
    setCategories(c ?? [])
    const { data: s } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(s ?? [])
  }
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function add() {
    if (!form.manufacturer_id || !form.category_id || !form.modellname) { toast.error('Pflichtfelder fehlen'); return }
    const { error } = await supabase.from('models').insert({
      manufacturer_id: form.manufacturer_id,
      category_id: form.category_id,
      modellname: form.modellname,
      default_ek: form.default_ek ? Number(form.default_ek) : null,
      default_vk: form.default_vk ? Number(form.default_vk) : null,
    })
    if (error) { toast.error('Fehler', { description: error.message }); return }
    setForm({ manufacturer_id: '', category_id: '', modellname: '', default_ek: '', default_vk: '' })
    await refresh()
  }

  async function updatePrice(id: string, field: 'default_ek' | 'default_vk', raw: string) {
    const value = raw.trim() === '' ? null : Number(raw)
    if (value !== null && Number.isNaN(value)) { toast.error('Ungültiger Preis'); return }
    const { error } = await supabase.from('models').update({ [field]: value }).eq('id', id)
    if (error) { toast.error('Speichern fehlgeschlagen', { description: error.message }); return }
    setModels(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m))
  }

  async function updateSupplier(id: string, raw: string) {
    const value = raw === NO_SUPPLIER ? null : raw
    const { error } = await supabase.from('models').update({ default_supplier_id: value }).eq('id', id)
    if (error) { toast.error('Lieferant speichern fehlgeschlagen', { description: error.message }); return }
    const supplier = value ? suppliers.find(s => s.id === value) ?? null : null
    setModels(prev => prev.map(m => m.id === id ? { ...m, default_supplier_id: value, default_supplier: supplier } : m))
  }

  async function remove(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const { error } = await supabase.from('models').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen', { description: error.message }); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Modelle</h1>
      <div className="border rounded p-4 grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-50">
        <div><Label>Hersteller *</Label>
          <Select value={form.manufacturer_id} onValueChange={v => setForm(p => ({ ...p, manufacturer_id: v }))}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{manufacturers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Kategorie *</Label>
          <Select value={form.category_id} onValueChange={v => setForm(p => ({ ...p, category_id: v }))}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Modellname *</Label><Input value={form.modellname} onChange={e => setForm(p => ({ ...p, modellname: e.target.value }))} /></div>
        <div><Label>EK (€)</Label><Input type="number" step="0.01" min="0" value={form.default_ek} onChange={e => setForm(p => ({ ...p, default_ek: e.target.value }))} /></div>
        <div><Label>VK (€)</Label><Input type="number" step="0.01" min="0" value={form.default_vk} onChange={e => setForm(p => ({ ...p, default_vk: e.target.value }))} /></div>
        <div className="flex items-end"><Button onClick={add}>Anlegen</Button></div>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Hersteller</TableHead><TableHead>Kategorie</TableHead>
            <TableHead>Modell</TableHead>
            <TableHead className="w-28">EK (€)</TableHead><TableHead className="w-28">VK (€)</TableHead>
            <TableHead className="w-48">Lieferant</TableHead>
            <TableHead className="w-20" />
          </TableRow></TableHeader>
          <TableBody>
            {models.map(m => (
              <TableRow key={m.id}>
                <TableCell>{m.manufacturer?.name ?? '—'}</TableCell>
                <TableCell>{m.category?.name ?? '—'}</TableCell>
                <TableCell>{m.modellname}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={m.default_ek ?? ''}
                    onBlur={e => { if (e.target.value !== (m.default_ek?.toString() ?? '')) updatePrice(m.id, 'default_ek', e.target.value) }}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={m.default_vk ?? ''}
                    onBlur={e => { if (e.target.value !== (m.default_vk?.toString() ?? '')) updatePrice(m.id, 'default_vk', e.target.value) }}
                    className="h-8"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={m.default_supplier_id ?? NO_SUPPLIER}
                    onValueChange={v => updateSupplier(m.id, v)}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLIER}>—</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell><Button variant="outline" size="sm" onClick={() => remove(m.id)}>Löschen</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
