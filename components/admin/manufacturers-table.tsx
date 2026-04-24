'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import type { Manufacturer, Supplier } from '@/lib/types'

const NO_SUPPLIER = '__none__'

export function ManufacturersTable() {
  const supabase = createClient()
  const [rows, setRows] = useState<Manufacturer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [name, setName] = useState('')

  async function refresh() {
    const { data: m } = await supabase
      .from('manufacturers')
      .select('*, default_supplier:suppliers!default_supplier_id(*)')
      .order('name')
    setRows((m ?? []) as Manufacturer[])
    const { data: s } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(s ?? [])
  }
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function add() {
    if (!name) { toast.error('Name ist Pflicht'); return }
    const { error } = await supabase.from('manufacturers').insert({ name })
    if (error) { toast.error('Fehler', { description: error.message }); return }
    setName('')
    await refresh()
  }

  async function updateSupplier(id: string, raw: string) {
    const value = raw === NO_SUPPLIER ? null : raw
    const { error } = await supabase.from('manufacturers').update({ default_supplier_id: value }).eq('id', id)
    if (error) { toast.error('Lieferant speichern fehlgeschlagen', { description: error.message }); return }
    const supplier = value ? suppliers.find(s => s.id === value) ?? null : null
    setRows(prev => prev.map(r => r.id === id ? { ...r, default_supplier_id: value, default_supplier: supplier } : r))
  }

  async function remove(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const { error } = await supabase.from('manufacturers').delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen', { description: error.message }); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Hersteller</h1>
      <div className="border rounded p-4 grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50">
        <div className="space-y-1">
          <Label>Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="flex items-end"><Button onClick={add}>Anlegen</Button></div>
      </div>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-64">Lieferant</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <Select
                    value={r.default_supplier_id ?? NO_SUPPLIER}
                    onValueChange={v => updateSupplier(r.id, v)}
                  >
                    <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLIER}>—</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => remove(r.id)}>Löschen</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
