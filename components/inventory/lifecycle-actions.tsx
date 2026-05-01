'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EntityPicker } from '@/components/inventory/entity-picker'
import { toast } from 'sonner'
import { ArrowDownToLine, Wrench, Send, Archive, HandHeart, Loader2 } from 'lucide-react'
import type { DeviceStatus } from '@/lib/types'

interface Props {
  deviceId: string
  status: DeviceStatus
  // TSEs werden nie repariert. Tausch = direkt ausmustern.
  isTse?: boolean
}

export function LifecycleActions({ deviceId, status, isTse = false }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [verleihenOpen, setVerleihenOpen] = useState(false)
  const [verleihenForm, setVerleihenForm] = useState({ customer_id: '', notes: '' })

  async function callReturnRpc(targetStatus: 'lager' | 'in_reparatur' | 'defekt' | 'ausgemustert', confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(targetStatus)
    const { error } = await supabase.rpc('return_device', {
      p_device_id: deviceId,
      p_target_status: targetStatus,
      p_notes: null,
    })
    setBusy(null)
    if (error) {
      toast.error('Aktion fehlgeschlagen', { description: error.message })
      return
    }
    toast.success(MESSAGES[targetStatus])
    startTransition(() => router.refresh())
  }

  async function callVerleihen() {
    if (!verleihenForm.customer_id) { toast.error('Kunde wählen'); return }
    setBusy('verleihen')
    const { error } = await supabase.rpc('assign_device', {
      p_device_id: deviceId,
      p_customer_id: verleihenForm.customer_id,
      p_kind: 'leihe',
      p_notes: verleihenForm.notes || null,
    })
    setBusy(null)
    if (error) {
      toast.error('Verleihen fehlgeschlagen', { description: error.message })
      return
    }
    toast.success('Gerät verliehen')
    setVerleihenOpen(false)
    setVerleihenForm({ customer_id: '', notes: '' })
    startTransition(() => router.refresh())
  }

  const buttons: React.ReactNode[] = []

  // Lager / Reserviert: kann verliehen oder verkauft werden
  if (status === 'lager' || status === 'reserviert') {
    buttons.push(
      <Button key="verleihen" variant="secondary" onClick={() => setVerleihenOpen(true)} disabled={busy !== null}>
        <HandHeart className="h-4 w-4 mr-1.5" /> Verleihen
      </Button>,
    )
  }

  // Verliehen: temporäre Leihe → Rückgabe ins Lager
  if (status === 'verliehen') {
    buttons.push(
      <Button
        key="ruecknehmen"
        variant="secondary"
        onClick={() => callReturnRpc('lager', 'Leihgerät vom Kunden zurücknehmen?')}
        disabled={busy !== null}
      >
        {busy === 'lager'
          ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          : <ArrowDownToLine className="h-4 w-4 mr-1.5" />}
        Zurücknehmen
      </Button>,
    )
  }

  // Im Einsatz: permanent beim Kunden installiert. Kasse kann nur via
  // Vertragsende abgeholt, zur Reparatur eingesendet oder ausgemustert werden.
  if (status === 'im_einsatz') {
    buttons.push(
      <Button
        key="abgeholt"
        variant="secondary"
        onClick={() => callReturnRpc('lager', 'Kasse vom Kunden abgeholt (z.B. Vertragsende)? Wandert ins Lager.')}
        disabled={busy !== null}
      >
        {busy === 'lager'
          ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          : <ArrowDownToLine className="h-4 w-4 mr-1.5" />}
        Vom Kunden abgeholt
      </Button>,
      ...(isTse ? [] : [
        <Button
          key="zur-reparatur-einsatz"
          variant="secondary"
          onClick={() => callReturnRpc('in_reparatur', 'Kasse zur Service-Reparatur entgegennehmen?')}
          disabled={busy !== null}
        >
          {busy === 'in_reparatur'
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <Send className="h-4 w-4 mr-1.5" />}
          Zur Reparatur
        </Button>,
      ]),
      <Button
        key="ausmustern-einsatz"
        variant="outline"
        onClick={() => callReturnRpc('ausgemustert', 'Kasse endgültig ausmustern? Kann nicht zurückgesetzt werden.')}
        disabled={busy !== null}
      >
        <Archive className="h-4 w-4 mr-1.5" /> Ausmustern
      </Button>,
    )
  }

  // Verkauft: Service-Reparatur möglich (Eigentum bleibt beim Kunden).
  // TSE: keine Reparatur — Tausch heißt direkt ausmustern.
  if (status === 'verkauft') {
    if (isTse) {
      buttons.push(
        <Button
          key="ausmustern-verkauft-tse"
          variant="outline"
          onClick={() => callReturnRpc('ausgemustert', 'TSE getauscht? Wird endgültig ausgemustert.')}
          disabled={busy !== null}
        >
          <Archive className="h-4 w-4 mr-1.5" /> Ausmustern (Tausch)
        </Button>,
      )
    } else {
      buttons.push(
        <Button
          key="rep-start-verkauft"
          variant="secondary"
          onClick={() => callReturnRpc('in_reparatur', 'Verkauftes Gerät zur Service-Reparatur entgegennehmen?')}
          disabled={busy !== null}
        >
          {busy === 'in_reparatur'
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <Send className="h-4 w-4 mr-1.5" />}
          Zur Reparatur
        </Button>,
      )
    }
  }

  // In Reparatur: zurück (verkauft → verkauft, sonst → lager) oder ausmustern.
  // Der Server erkennt automatisch ob das Gerät einem Kunden gehört.
  if (status === 'in_reparatur') {
    buttons.push(
      <Button
        key="rep-fertig"
        variant="primary"
        onClick={() => callReturnRpc('lager', 'Reparatur als abgeschlossen markieren?')}
        disabled={busy !== null}
      >
        {busy === 'lager'
          ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          : <Wrench className="h-4 w-4 mr-1.5" />}
        Reparatur abgeschlossen
      </Button>,
      <Button
        key="ausmustern-rep"
        variant="outline"
        onClick={() => callReturnRpc('ausgemustert', 'Gerät endgültig ausmustern? Kann nicht zurückgesetzt werden.')}
        disabled={busy !== null}
      >
        <Archive className="h-4 w-4 mr-1.5" /> Ausmustern
      </Button>,
    )
  }

  // Defekt im Lager: Reparatur veranlassen oder ausmustern.
  // TSE: keine Reparatur — nur ausmustern.
  if (status === 'defekt') {
    if (!isTse) {
      buttons.push(
        <Button
          key="rep-start"
          variant="secondary"
          onClick={() => callReturnRpc('in_reparatur', 'Gerät in die Werkstatt geben?')}
          disabled={busy !== null}
        >
          {busy === 'in_reparatur'
            ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            : <Send className="h-4 w-4 mr-1.5" />}
          Reparatur starten
        </Button>,
      )
    }
    buttons.push(
      <Button
        key="ausmustern-defekt"
        variant="outline"
        onClick={() => callReturnRpc('ausgemustert', 'Gerät ausmustern?')}
        disabled={busy !== null}
      >
        <Archive className="h-4 w-4 mr-1.5" /> Ausmustern
      </Button>,
    )
  }

  if (buttons.length === 0) return null

  return (
    <>
      <div className="flex flex-wrap gap-2">{buttons}</div>

      <Dialog open={verleihenOpen} onOpenChange={setVerleihenOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Gerät verleihen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <EntityPicker
              table="customers"
              label="Kunde"
              value={verleihenForm.customer_id}
              onChange={v => setVerleihenForm(p => ({ ...p, customer_id: v }))}
            />
            <div className="space-y-1.5">
              <Label>Notiz (optional)</Label>
              <Textarea
                rows={2}
                value={verleihenForm.notes}
                onChange={e => setVerleihenForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="z.B. „Bis Ende Q3 bei XY"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setVerleihenOpen(false)} disabled={busy !== null}>
                Abbrechen
              </Button>
              <Button onClick={callVerleihen} disabled={busy !== null}>
                {busy === 'verleihen' ? 'Speichern…' : 'Verleihen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

const MESSAGES: Record<string, string> = {
  lager: 'Gerät ist wieder im Lager',
  in_reparatur: 'Gerät in die Werkstatt gegeben',
  defekt: 'Gerät als defekt markiert',
  ausgemustert: 'Gerät ausgemustert',
  reserviert: 'Gerät reserviert',
}
