'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DeviceList } from './device-list'
import type { Device, Category } from '@/lib/types'

interface CategoryDeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  categoryName: string
  hideCategoryFilter: boolean
}

export function CategoryDeviceList({
  devices,
  categories,
  canAdd,
  categoryName,
  hideCategoryFilter,
}: CategoryDeviceListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Inventar
          </Link>
          <span className="text-muted-foreground mx-2">/</span>
          <span className="text-sm font-medium">{categoryName}</span>
        </div>
        {canAdd && (
          <Link href="/inventory/new" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Gerät hinzufügen
          </Link>
        )}
      </div>
      <DeviceList
        devices={devices}
        categories={categories}
        canAdd={canAdd}
        hideCategoryFilter={hideCategoryFilter}
        hideHeading
      />
    </div>
  )
}