'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OcrUpload } from '@/components/inventory/ocr-upload'
import { DeviceForm } from '@/components/inventory/device-form'
import { Check, X } from 'lucide-react'
import type { Category, OcrResult, Model } from '@/lib/types'

interface DevicePrefill {
  serial_number?: string
  category_id?: string
  model?: Model
}

function normalize(s: string | null | undefined) {
  return (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Sucht in der geladenen Modell-Liste das beste Match auf einen OCR-Treffer.
 *
 *  Zwei Pässe:
 *  1. Exakter Name-Match (modellname == ocr.name oder mit variante kombiniert).
 *     Wenn genau ein Treffer existiert → den nehmen, fertig.
 *  2. Fuzzy-Substring nur als Fallback. Wenn der OCR-Name "Pos Touch 15 II"
 *     auch "Pos Touch 15" enthält, würde Pass-1-only fairerweise beide treffen
 *     und nichts auswählen — Pass 1 verhindert das, weil der exakte Match
 *     "Pos Touch 15 II" gewinnt. */
function resolveModel(ocr: OcrResult, models: Model[]): Model | null {
  const ocrMfr = normalize(ocr.manufacturer)
  const ocrName = normalize(ocr.name)
  if (!ocrName) return null

  function manufacturerMatches(m: Model) {
    const mfr = normalize(m.manufacturer?.name)
    if (!ocrMfr) return true
    return mfr === ocrMfr || mfr.includes(ocrMfr) || ocrMfr.includes(mfr)
  }

  // Pass 1: exact name match
  const exact = models.filter(m => {
    if (!manufacturerMatches(m)) return false
    const name = normalize(m.modellname)
    const variante = normalize(m.variante)
    const fullName = variante ? `${name} ${variante}` : name
    return name === ocrName || fullName === ocrName
  })
  if (exact.length >= 1) return exact[0]

  // Pass 2: fuzzy substring (both directions) — nur eindeutige Treffer
  const fuzzy = models.filter(m => {
    if (!manufacturerMatches(m)) return false
    const name = normalize(m.modellname)
    const variante = normalize(m.variante)
    const fullName = variante ? `${name} ${variante}` : name
    return name.includes(ocrName) || ocrName.includes(name) ||
      fullName.includes(ocrName) || ocrName.includes(fullName)
  })
  return fuzzy.length === 1 ? fuzzy[0] : null
}

export default function NewDevicePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [prefill, setPrefill] = useState<DevicePrefill>({})
  const [prefillKey, setPrefillKey] = useState(0)
  const [lastOcr, setLastOcr] = useState<OcrResult | null>(null)
  const [resolvedSuccessfully, setResolvedSuccessfully] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
      if (profile?.role === 'viewer') { router.push('/inventory'); return }
      setIsAdmin(profile?.role === 'admin')
      const [{ data: cats }, { data: mods }] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase
          .from('models')
          .select('*, manufacturer:manufacturers(*), category:categories(*)')
          .order('modellname'),
      ])
      setCategories(cats ?? [])
      setModels((mods ?? []) as Model[])
    }
    load()
  }, [])

  function handleOcrResult(result: OcrResult) {
    setLastOcr(result)
    const match = resolveModel(result, models)
    if (match) {
      setPrefill({
        serial_number: result.serial_number ?? undefined,
        category_id: match.category_id,
        model: match,
      })
      setResolvedSuccessfully(true)
    } else {
      // Kein eindeutiges Modell — wenigstens die Seriennummer durchreichen,
      // User muss Kategorie + Modell selbst pflegen.
      setPrefill({ serial_number: result.serial_number ?? undefined })
      setResolvedSuccessfully(false)
    }
    // Force remount der DeviceForm, damit useState die neuen prefill-Werte aufnimmt.
    setPrefillKey(k => k + 1)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Neues Gerät hinzufügen</h1>
      <OcrUpload onResult={handleOcrResult} />

      {lastOcr && (
        <div className={`rounded-md border px-4 py-3 text-sm ${
          resolvedSuccessfully
            ? 'border-green-200 bg-green-50 text-green-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          <div className="flex items-start gap-2">
            {resolvedSuccessfully
              ? <Check className="h-4 w-4 shrink-0 mt-0.5" />
              : <X className="h-4 w-4 shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium mb-1">
                {resolvedSuccessfully
                  ? 'Modell automatisch erkannt'
                  : 'Kein passendes Modell in der Stammdatenbank'}
              </div>
              <div className="text-xs space-y-0.5">
                {lastOcr.manufacturer && <div><span className="opacity-60">Hersteller:</span> {lastOcr.manufacturer}</div>}
                {lastOcr.name && <div><span className="opacity-60">Modell:</span> {lastOcr.name}</div>}
                {lastOcr.serial_number && <div><span className="opacity-60">Seriennummer:</span> <span className="font-mono">{lastOcr.serial_number}</span></div>}
              </div>
              {!resolvedSuccessfully && (
                <p className="text-xs mt-2 opacity-80">
                  Bitte Kategorie + Modell unten manuell wählen — die Seriennummer
                  ist bereits vorbefüllt.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <DeviceForm
        key={prefillKey}
        categories={categories}
        prefill={prefill}
        isAdmin={isAdmin}
      />
    </div>
  )
}
