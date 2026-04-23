'use client'

import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, X, Camera, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LieferscheinOcrResponse } from '@/lib/types'

interface Props {
  onResult: (ocr: LieferscheinOcrResponse, localPreviewUrl: string) => void
}

export function DeliveryUpload({ onResult }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  async function handle(file: File) {
    setLoading(true)
    const previewUrl = URL.createObjectURL(file)
    const form = new FormData()
    form.append('file', file, file.name)
    try {
      const res = await fetch('/api/lieferschein/ocr', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data: LieferscheinOcrResponse = await res.json()
      onResult(data, previewUrl)
    } catch (e) {
      toast.error('OCR fehlgeschlagen', { description: e instanceof Error ? e.message : 'unbekannt' })
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setDragActive(false)
    if (loading) return
    const f = e.dataTransfer.files?.[0]
    if (f) handle(f)
  }

  return (
    <div className="flex justify-center pt-4 sm:pt-8">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 w-9 rounded-full ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            aria-label="Zurück"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold text-slate-900">Lieferschein scannen</h2>
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 w-9 rounded-full ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => !loading && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); if (!loading) setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          disabled={loading}
          className={[
            'w-full rounded-2xl border-2 border-dashed px-6 py-12 transition-colors',
            'flex flex-col items-center justify-center gap-3',
            dragActive ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50',
            loading ? 'opacity-60 cursor-wait' : 'cursor-pointer',
          ].join(' ')}
        >
          <div className="h-12 w-12 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center text-slate-600">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-slate-900">Lieferschein hochladen</div>
            <div className="text-xs text-slate-500 mt-1">Datei ablegen oder klicken, um eine Datei auszuwählen.</div>
          </div>
        </button>

        <Button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={loading}
          className="mt-6 w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium"
        >
          <Camera className="h-4 w-4 mr-2" />
          Foto aufnehmen
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
        />
      </div>
    </div>
  )
}
