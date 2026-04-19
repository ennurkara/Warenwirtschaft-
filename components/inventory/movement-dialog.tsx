'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Device, MovementAction } from '@/lib/types'

export function MovementDialog({ device }: { device: Device }) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<MovementAction>('entnahme')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: movErr } = await supabase.from('device_movements').insert({
      device_id: device.id,
      user_id: user!.id,
      action,
      quantity,
      note: note || null,
    })

    if (movErr) {
      toast.error('Fehler', { description: movErr.message })
      setIsLoading(false)
      return
    }

    const delta = action === 'entnahme' ? -quantity : action === 'einlagerung' ? quantity : 0
    if (delta !== 0) {
      await supabase.from('devices').update({ quantity: device.quantity + delta }).eq('id', device.id)
    }
    if (action === 'defekt_gemeldet') {
      await supabase.from('devices').update({ status: 'defekt' }).eq('id', device.id)
    }

    toast.success('Buchung erfolgreich')
    setOpen(false)
    router.refresh()
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Buchung erstellen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bewegung buchen — {device.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Aktion</Label>
            <Select value={action} onValueChange={v => setAction(v as MovementAction)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entnahme">Entnahme</SelectItem>
                <SelectItem value="einlagerung">Einlagerung</SelectItem>
                <SelectItem value="defekt_gemeldet">Defekt melden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Menge</Label>
            <Input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Notiz (optional)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} rows={2} />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Buchen...' : 'Buchen'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}