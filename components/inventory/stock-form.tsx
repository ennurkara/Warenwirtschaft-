'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { Category, Model } from '@/lib/types'

interface StockFormProps {
  categories: Category[]
  models: Model[]
  preselectedCategoryId?: string
}

export function StockForm({ categories, models, preselectedCategoryId }: StockFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  const stockCategories = categories.filter(c => c.kind === 'stock')

  const [categoryId, setCategoryId] = useState(preselectedCategoryId ?? '')
  const [modelId, setModelId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [location, setLocation] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [notes, setNotes] = useState('')

  const filteredModels = useMemo(
    () => models.filter(m => m.category_id === categoryId).sort((a, b) => a.modellname.localeCompare(b.modellname)),
    [models, categoryId],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!categoryId) { toast.error('Kategorie wählen'); return }
    if (!modelId)    { toast.error('Modell wählen'); return }
    const delta = Number(quantity)
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error('Menge muss ungleich 0 sein')
      return
    }

    setIsLoading(true)

    // 1. User-ID für stock_movements.user_id
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      toast.error('Kein Benutzer angemeldet'); setIsLoading(false); return
    }

    // 2. Existing stock_item für dieses Modell? (UNIQUE on model_id)
    const { data: existing } = await supabase
      .from('stock_items')
      .select('id, quantity')
      .eq('model_id', modelId)
      .maybeSingle()

    let stockItemId: string
    if (existing) {
      const newQty = (existing.quantity ?? 0) + delta
      const { error: updateErr } = await supabase
        .from('stock_items')
        .update({
          quantity: newQty,
          // location/notes nur überschreiben, wenn der Nutzer was eingibt
          ...(location ? { location } : {}),
          ...(notes ? { notes } : {}),
        })
        .eq('id', existing.id)
      if (updateErr) {
        toast.error('Bestand-Update fehlgeschlagen', { description: updateErr.message })
        setIsLoading(false); return
      }
      stockItemId = existing.id
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('stock_items')
        .insert({
          model_id: modelId,
          quantity: delta,
          location: location || null,
          notes: notes || null,
        })
        .select('id')
        .single()
      if (insertErr || !created) {
        toast.error('Bestand-Anlage fehlgeschlagen', { description: insertErr?.message })
        setIsLoading(false); return
      }
      stockItemId = created.id
    }

    // 3. Bewegung protokollieren (kind='einkauf', delta>0)
    const { error: movErr } = await supabase.from('stock_movements').insert({
      stock_item_id: stockItemId,
      kind: 'einkauf',
      delta,
      unit_price: unitPrice ? Number(unitPrice) : null,
      user_id: user.id,
      note: notes || null,
    })
    if (movErr) {
      toast.error('Bewegung konnte nicht protokolliert werden', { description: movErr.message })
      setIsLoading(false); return
    }

    toast.success(`+${delta} hinzugefügt`)
    setIsLoading(false)
    router.push(`/inventory?category=${categoryId}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <Label>Kategorie *</Label>
        <Select
          value={categoryId}
          onValueChange={v => { setCategoryId(v); setModelId('') }}
        >
          <SelectTrigger><SelectValue placeholder="Kategorie wählen…" /></SelectTrigger>
          <SelectContent>
            {stockCategories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {categoryId && (
        <div className="space-y-2">
          <Label>Artikel *</Label>
          <Select value={modelId} onValueChange={setModelId}>
            <SelectTrigger>
              <SelectValue placeholder={
                filteredModels.length
                  ? 'Artikel aus Stammdaten wählen…'
                  : 'Keine Modelle in dieser Kategorie — bitte in /admin/models anlegen'
              } />
            </SelectTrigger>
            <SelectContent>
              {filteredModels.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.modellname}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {modelId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Menge *</Label>
              <Input
                type="number"
                step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="z.B. 10"
              />
              <p className="text-[12px] text-[var(--ink-3)]">
                Wird zur bestehenden Menge addiert. Negative Werte für Korrektur möglich.
              </p>
            </div>
            <div className="space-y-2">
              <Label>EK pro Einheit (€)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lager-Standort</Label>
            <Input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="z.B. Lager Raum 2, Regal C1"
            />
          </div>

          <div className="space-y-2">
            <Label>Notiz</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="z.B. Lieferant, Charge, Maße"
            />
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Speichern…' : 'Bestand buchen'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Abbrechen
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
