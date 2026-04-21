'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { OcrUpload } from '@/components/inventory/ocr-upload'
import { DeviceForm } from '@/components/inventory/device-form'
import type { Category, OcrResult } from '@/lib/types'

export default function NewDevicePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [prefill, setPrefill] = useState<{ serial_number?: string }>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
      if (profile?.role === 'viewer') { router.push('/inventory'); return }
      setIsAdmin(profile?.role === 'admin')
      const { data: cats } = await supabase.from('categories').select('*').order('name')
      setCategories(cats ?? [])
    }
    load()
  }, [])

  function handleOcrResult(result: OcrResult) {
    setPrefill({ serial_number: result.serial_number ?? undefined })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Neues Gerät hinzufügen</h1>
      <OcrUpload onResult={handleOcrResult} />
      {Object.keys(prefill).length > 0 && (
        <p className="text-sm text-green-600">Daten per OCR erkannt — bitte prüfen und bestätigen.</p>
      )}
      <DeviceForm categories={categories} prefill={prefill} isAdmin={isAdmin} />
    </div>
  )
}