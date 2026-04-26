'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Trash2, Loader2 } from 'lucide-react'

export function DeleteLicenseButton({
  licenseId,
  licenseName,
}: {
  licenseId: string
  licenseName: string
}) {
  const supabase = createClient()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Lizenz „${licenseName}" wirklich löschen?`)) return
    setIsDeleting(true)
    const { error } = await supabase.from('licenses').delete().eq('id', licenseId)
    setIsDeleting(false)
    if (error) {
      toast.error('Löschen fehlgeschlagen', { description: error.message })
      return
    }
    toast.success('Lizenz gelöscht')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      aria-label="Lizenz löschen"
      title="Löschen"
      className="rounded-md p-1.5 text-[var(--ink-3)] hover:bg-[var(--red-tint)] hover:text-[var(--red)] transition-colors disabled:opacity-50"
    >
      {isDeleting
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Trash2 className="h-3.5 w-3.5" />}
    </button>
  )
}
