import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { StockForm } from '@/components/inventory/stock-form'
import type { Category, Model } from '@/lib/types'

export default async function StockNewPage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const supabase = await createClient()

  const [{ data: cats }, { data: mods }] = await Promise.all([
    supabase.from('categories').select('*').order('name'),
    supabase
      .from('models')
      .select('*, manufacturer:manufacturers(*), category:categories(*)')
      .order('modellname'),
  ])
  const categories = (cats ?? []) as Category[]
  const models = (mods ?? []) as Model[]

  // ?category=Bonrollen → wir nehmen die ID der gleichnamigen kind=stock Kategorie als Vorauswahl
  const preselectedCategoryId = searchParams.category
    ? categories.find(c => c.name === searchParams.category && c.kind === 'stock')?.id
    : undefined

  return (
    <div className="max-w-[1100px] mx-auto space-y-[18px]">
      <div className="flex flex-col gap-3 pb-4 mb-1 border-b border-[var(--rule-soft)]">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Übersicht
        </Link>
        <div>
          <div className="kb-label mb-1.5">Bestand</div>
          <h1 className="kb-h1">Bestand erfassen</h1>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            Wareneingang einer Bestandsposition. Wenn das Modell schon einen Bestand hat,
            wird die Menge addiert; sonst wird ein neuer Posten angelegt. Jede Buchung schreibt
            eine Bewegung mit Datum + Menge + EK.
          </p>
        </div>
      </div>

      <StockForm
        categories={categories}
        models={models}
        preselectedCategoryId={preselectedCategoryId}
      />
    </div>
  )
}
