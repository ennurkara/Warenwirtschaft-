'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DeliveryUpload } from '@/components/delivery/delivery-upload'
import { DeliveryReview } from '@/components/delivery/delivery-review'
import type { LieferscheinOcrResponse, Category, Model } from '@/lib/types'

export default function NewDeliveryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [ocr, setOcr] = useState<LieferscheinOcrResponse | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  async function refreshModels() {
    const { data: ms } = await supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*)')
      .order('modellname')
    setModels((ms ?? []) as Model[])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'viewer') { router.push('/inventory'); return }
      const { data: cats } = await supabase.from('categories').select('*').order('name')
      setCategories(cats ?? [])
      await refreshModels()
    }
    load()
  }, [])

  // Best-effort cleanup: if user leaves after OCR without saving, delete the uploaded file.
  useEffect(() => {
    if (!ocr) return
    function onUnload() {
      navigator.sendBeacon(
        '/api/lieferschein/ocr/cancel',
        new Blob([JSON.stringify({ source_path: ocr!.source_path })], { type: 'application/json' }),
      )
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [ocr])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Lieferschein scannen</h1>
      {!ocr && (
        <DeliveryUpload
          onResult={(data, preview) => { setOcr(data); setPreviewUrl(preview) }}
        />
      )}
      {ocr && (
        <DeliveryReview
          ocr={ocr}
          categories={categories}
          models={models}
          previewUrl={previewUrl}
          onModelsRefresh={refreshModels}
        />
      )}
    </div>
  )
}
