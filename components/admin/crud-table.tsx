'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'

interface FieldDef { key: string; label: string; type?: 'text' | 'email' }

interface Props {
  tableName: string
  title: string
  fields: FieldDef[]
}

export function CrudTable({ tableName, title, fields }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<Record<string, string | null>[]>([])
  const [form, setForm] = useState<Record<string, string>>(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  )

  async function refresh() {
    const { data } = await supabase.from(tableName).select('*').order(fields[0].key)
    setRows(data ?? [])
  }
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function add() {
    if (!form[fields[0].key]) { toast.error(`${fields[0].label} ist Pflicht`); return }
    const payload = fields.reduce((acc, f) => ({ ...acc, [f.key]: form[f.key] || null }), {} as Record<string, string | null>)
    const { error } = await supabase.from(tableName).insert(payload)
    if (error) { toast.error('Fehler', { description: error.message }); return }
    setForm(fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}))
    await refresh()
    toast.success(`${title.slice(0, -1)} angelegt`)
  }

  async function remove(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen', { description: error.message }); return }
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)] leading-tight">{title}</h1>
      <div className="border border-[var(--rule)] rounded-kb p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[var(--paper-2)]">
        {fields.map(f => (
          <div key={f.key} className="space-y-1 min-w-0">
            <Label>{f.label}</Label>
            <Input type={f.type ?? 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
          </div>
        ))}
        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <Button onClick={add} className="w-full sm:w-auto">Anlegen</Button>
        </div>
      </div>
      <div className="rounded-kb border border-[var(--rule)] bg-white overflow-x-auto kb-scroll">
        <Table>
          <TableHeader>
            <TableRow>
              {fields.map(f => <TableHead key={f.key}>{f.label}</TableHead>)}
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id as string}>
                {fields.map(f => <TableCell key={f.key}>{r[f.key] ?? '—'}</TableCell>)}
                <TableCell><Button variant="outline" size="sm" onClick={() => remove(r.id as string)}>Löschen</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
