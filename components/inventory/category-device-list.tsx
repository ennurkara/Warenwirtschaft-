'use client'

import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeviceList } from './device-list'
import type { Device, Category, CategoryKind } from '@/lib/types'

interface CategoryDeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  categoryName: string
  activeCategoryName?: string
  activeCategoryKind?: CategoryKind
  hideCategoryFilter: boolean
  emptyMessage?: string
}

export function CategoryDeviceList({
  devices,
  categories,
  canAdd,
  categoryName,
  activeCategoryName,
  activeCategoryKind,
  hideCategoryFilter,
  emptyMessage,
}: CategoryDeviceListProps) {
  return (
    <div className="max-w-[1280px] mx-auto space-y-[18px]">
      <div className="kb-h-row flex-col md:flex-row items-start md:items-end gap-4 pb-4 mb-2 border-b border-[var(--rule-soft)]">
        <div>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zur Übersicht
          </Link>
          <h1 className="kb-h1">{categoryName}</h1>
          <div className="text-[13px] text-[var(--ink-3)] mt-1">
            {devices.length} Gerät{devices.length === 1 ? '' : 'e'} in dieser Kategorie
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

      <DeviceList
        devices={devices}
        categories={categories}
        canAdd={canAdd}
        activeCategoryName={activeCategoryName ?? categoryName}
        activeCategoryKind={activeCategoryKind}
        hideCategoryFilter={hideCategoryFilter}
        hideHeading
        emptyMessage={emptyMessage}
      />
    </div>
  )
}
