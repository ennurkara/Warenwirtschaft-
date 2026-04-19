'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { CategoryIcon, AllDevicesIcon } from './category-icon'
import type { CategoryWithCount } from '@/lib/types'

interface CategoryGridProps {
  categories: CategoryWithCount[]
  totalDevices: number
  canAdd: boolean
}

export function CategoryGrid({ categories, totalDevices, canAdd }: CategoryGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventar</h1>
        {canAdd && (
          <Link href="/inventory/new" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Gerät hinzufügen
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/inventory?category=all">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="flex flex-col items-center justify-center p-6 text-center">
              <AllDevicesIcon className="h-8 w-8 mb-2 text-slate-600" />
              <span className="font-medium">Alle Geräte</span>
              <span className="text-sm text-muted-foreground">{totalDevices} Geräte</span>
            </CardContent>
          </Card>
        </Link>
        {categories.map(category => (
          <Link key={category.id} href={`/inventory?category=${category.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                <CategoryIcon name={category.icon} className="h-8 w-8 mb-2 text-slate-600" />
                <span className="font-medium">{category.name}</span>
                <span className="text-sm text-muted-foreground">
                  {category.device_count} Gerät{category.device_count !== 1 ? 'e' : ''}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}