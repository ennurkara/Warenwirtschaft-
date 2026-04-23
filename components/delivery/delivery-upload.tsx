'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { LieferscheinOcrResponse } from '@/lib/types'

interface Props {
  onResult: (ocr: LieferscheinOcrResponse, localPreviewUrl: string) => void
}

export function DeliveryUpload({ onResult }: Props) {
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center space-y-3">
      <p className="text-slate-500 text-sm">Lieferschein als Foto oder PDF hochladen</p>
      <div className="flex justify-center gap-3">
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          Datei hochladen
        </Button>
        <Button
          type="button" variant="outline"
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.setAttribute('capture', 'environment')
              fileRef.current.click()
            }
          }}
          disabled={loading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Kamera
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </div>
  )
}
