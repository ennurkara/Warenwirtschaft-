'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CategoryIcon, AllDevicesIcon } from './category-icon'
import { Plus } from 'lucide-react'
import type { CategoryWithCount } from '@/lib/types'

interface CategoryGridProps {
  categories: CategoryWithCount[]
  totalDevices: number
  canAdd: boolean
}

export function CategoryGrid({ categories, totalDevices, canAdd }: CategoryGridProps) {
  const max = Math.max(1, ...categories.map(c => c.device_count))

  return (
    <div className="max-w-[1280px] mx-auto space-y-[18px]">
      <div className="kb-h-row flex-col md:flex-row items-start md:items-end gap-4 pb-4 mb-2 border-b border-[var(--rule-soft)]">
        <div>
          <div className="kb-label mb-1.5">Inventar · Übersicht</div>
          <h1 className="kb-h1">Bestand nach Kategorie</h1>
          <div className="text-[13px] text-[var(--ink-3)] mt-1">
            {totalDevices} Geräte · {categories.length} Kategorie{categories.length === 1 ? '' : 'n'}
          </div>
        </div>
        {canAdd && (
          <Button asChild>
            <Link href="/inventory/new">
              <Plus className="h-3.5 w-3.5" />
              Gerät anlegen
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[14px]">
        <Link
          href="/inventory?category=all"
          className="col-span-2 row-span-1 group"
        >
          <div className="h-full rounded-kb border border-[var(--rule)] bg-gradient-to-br from-[var(--blue-tint)] to-white p-[18px] shadow-xs transition-all hover:shadow-md hover:border-[var(--blue-line)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="kb-label mb-1.5" style={{ color: 'var(--blue-ink)' }}>
                  Gesamt
                </div>
                <div className="font-display text-[36px] font-semibold tracking-[-0.022em] leading-none tabular-nums text-[var(--ink)]">
                  {totalDevices}
                </div>
                <div className="mt-2 text-[12.5px] font-medium text-[var(--ink-2)]">
                  Alle Geräte
                </div>
              </div>
              <div className="shrink-0 rounded-kb-sm bg-white/80 p-2.5 border border-[var(--blue-line)]">
                <AllDevicesIcon className="h-5 w-5 text-[var(--blue)]" />
              </div>
            </div>
          </div>
        </Link>

        {categories.map(category => (
          <Link key={category.id} href={`/inventory?category=${category.id}`} className="group">
            <div className="h-full rounded-kb border border-[var(--rule)] bg-white p-[18px] shadow-xs transition-all hover:shadow-md hover:border-[var(--blue-line)]">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-kb-sm bg-[var(--paper-2)] p-2 text-[var(--ink-2)] group-hover:text-[var(--blue)] group-hover:bg-[var(--blue-tint)] transition-colors">
                  <CategoryIcon name={category.icon} className="h-[18px] w-[18px]" />
                </div>
                <span className="text-[11px] font-mono text-[var(--ink-4)] tabular-nums">
                  {String(category.device_count).padStart(2, '0')}
                </span>
              </div>
              <div className="text-[13.5px] font-medium text-[var(--ink)] leading-tight mb-2.5">
                {category.name}
              </div>
              <div className="kb-bar" style={{ height: 4 }}>
                <span style={{ width: `${(category.device_count / max) * 100}%` }} />
              </div>
              <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">
                {category.device_count} Gerät{category.device_count === 1 ? '' : 'e'}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
