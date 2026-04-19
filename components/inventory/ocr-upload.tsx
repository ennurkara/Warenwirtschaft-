'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Camera, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { OcrResult } from '@/lib/types'

interface OcrUploadProps {
  onResult: (result: OcrResult) => void
}

export function OcrUpload({ onResult }: OcrUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setIsLoading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 }),
        })
        if (!res.ok) throw new Error('OCR fehlgeschlagen')
        const data: OcrResult = await res.json()
        onResult(data)
        toast.success('Gerät erkannt', { description: `${data.name ?? 'Unbekannt'} gefunden` })
      } catch {
        toast.error('OCR fehlgeschlagen', { description: 'Bitte Daten manuell eingeben.' })
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center space-y-3">
      <p className="text-slate-500 text-sm">Foto des Geräts oder Etiketts aufnehmen/hochladen</p>
      <div className="flex justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
          Foto hochladen
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            if (fileRef.current) {
              fileRef.current.setAttribute('capture', 'environment')
              fileRef.current.click()
            }
          }}
          disabled={isLoading}
        >
          <Camera className="h-4 w-4 mr-2" />
          Kamera
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  )
}