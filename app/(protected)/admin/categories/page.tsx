'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Category } from '@/lib/types'

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => setCategories(data ?? []))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setIsLoading(true)
    const { error } = await supabase.from('categories').insert({ name: newName.trim() })
    if (error) {
      toast.error('Fehler', { description: error.message })
    } else {
      toast.success('Kategorie hinzugefügt')
      setNewName('')
      router.refresh()
      const { data } = await supabase.from('categories').select('*').order('name')
      setCategories(data ?? [])
    }
    setIsLoading(false)
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) {
      toast.error('Fehler', { description: 'Kategorie wird noch verwendet.' })
      return
    }
    setCategories(prev => prev.filter(c => c.id !== id))
    toast.success('Kategorie gelöscht')
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-semibold">Kategorien</h1>
      <form onSubmit={handleAdd} className="flex gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-cat">Neue Kategorie</Label>
          <Input id="new-cat" value={newName} onChange={e => setNewName(e.target.value)} placeholder="z.B. Headset" />
        </div>
        <Button type="submit" disabled={isLoading} className="self-end">Hinzufügen</Button>
      </form>
      <div className="rounded-md border bg-white divide-y">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between px-4 py-3">
            <span>{c.name}</span>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-red-500 hover:text-red-700">
              Löschen
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}