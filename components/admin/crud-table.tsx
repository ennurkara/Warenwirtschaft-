'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'

interface FieldDef { key: string; label: string; type?: 'text' | 'email' }

interface Props {
  tableName: string
  title: string
  fields: FieldDef[]
}

type Row = Record<string, string | null>

function emptyForm(fields: FieldDef[]): Record<string, string> {
  return fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
}

function formFromRow(fields: FieldDef[], row: Row): Record<string, string> {
  return fields.reduce(
    (acc, f) => ({ ...acc, [f.key]: row[f.key] != null ? String(row[f.key]) : '' }),
    {}
  )
}

export function CrudTable({ tableName, title, fields }: Props) {
  const supabase = createClient()
  const [rows, setRows] = useState<Row[]>([])
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(fields))

  // Edit-Dialog state. editingRow=null bedeutet Dialog zu.
  const [editingRow, setEditingRow] = useState<Row | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  async function refresh() {
    const { data } = await supabase.from(tableName).select('*').order(fields[0].key)
    setRows(data ?? [])
  }
  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function add() {
    if (!form[fields[0].key]) { toast.error(`${fields[0].label} ist Pflicht`); return }
    const payload = fields.reduce(
      (acc, f) => ({ ...acc, [f.key]: form[f.key] || null }),
      {} as Record<string, string | null>,
    )
    const { error } = await supabase.from(tableName).insert(payload)
    if (error) { toast.error('Fehler', { description: error.message }); return }
    setForm(emptyForm(fields))
    await refresh()
    toast.success(`${title.slice(0, -1)} angelegt`)
  }

  async function remove(id: string) {
    if (!confirm('Wirklich löschen?')) return
    const { error } = await supabase.from(tableName).delete().eq('id', id)
    if (error) { toast.error('Löschen fehlgeschlagen', { description: error.message }); return }
    await refresh()
  }

  function startEdit(row: Row) {
    setEditingRow(row)
    setEditForm(formFromRow(fields, row))
  }

  async function saveEdit() {
    if (!editingRow) return
    if (!editForm[fields[0].key]) {
      toast.error(`${fields[0].label} ist Pflicht`)
      return
    }
    setIsSaving(true)
    const payload = fields.reduce(
      (acc, f) => ({ ...acc, [f.key]: editForm[f.key] || null }),
      {} as Record<string, string | null>,
    )
    const { error } = await supabase
      .from(tableName)
      .update(payload)
      .eq('id', editingRow.id as string)
    setIsSaving(false)
    if (error) {
      toast.error('Speichern fehlgeschlagen', { description: error.message })
      return
    }
    setEditingRow(null)
    await refresh()
    toast.success('Gespeichert')
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-[28px] font-semibold tracking-[-0.022em] text-[var(--ink)] leading-tight">{title}</h1>

      <div className="border border-[var(--rule)] rounded-kb p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[var(--paper-2)]">
        {fields.map(f => (
          <div key={f.key} className="space-y-1 min-w-0">
            <Label>{f.label}</Label>
            <Input
              type={f.type ?? 'text'}
              value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
            />
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
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id as string}>
                {fields.map(f => <TableCell key={f.key}>{r[f.key] ?? '—'}</TableCell>)}
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(r)}
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline ml-1">Bearbeiten</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => remove(r.id as string)}
                      aria-label="Löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline ml-1">Löschen</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editingRow !== null} onOpenChange={open => { if (!open) setEditingRow(null) }}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>{title.slice(0, -1)} bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key} className="space-y-1 min-w-0">
                <Label>{f.label}</Label>
                <Input
                  type={f.type ?? 'text'}
                  value={editForm[f.key] ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingRow(null)} disabled={isSaving}>
              Abbrechen
            </Button>
            <Button onClick={saveEdit} disabled={isSaving}>
              {isSaving ? 'Speichere…' : 'Speichern'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
