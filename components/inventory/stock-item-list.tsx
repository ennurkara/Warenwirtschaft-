'use client'

import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getColumnsForKind, COLUMN_KEY } from '@/lib/category-columns'
import { formatCurrency } from '@/lib/utils'
import type { StockItem } from '@/lib/types'

interface StockItemListProps {
  items: StockItem[]
  categoryName: string
  canAdd: boolean
}

export function StockItemList({ items, categoryName, canAdd }: StockItemListProps) {
  const columns = getColumnsForKind('stock')

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
            {items.length} Posten
          </div>
        </div>
        {canAdd && (
          <Button asChild>
            <Link href={`/inventory/stock-new?category=${encodeURIComponent(categoryName)}`}>
              <Plus className="h-3.5 w-3.5" />
              Bestand erfassen
            </Link>
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-kb border border-[var(--rule)] bg-white p-10 text-center text-[var(--ink-3)]">
          Keine Bestandsposten in dieser Kategorie.
        </div>
      ) : (
        <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
          <table className="kb-table">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className={col.align === 'right' ? 'num' : ''}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  {columns.map(col => (
                    <td key={col.key} className={col.align === 'right' ? 'num' : ''}>
                      {renderStockCell(item, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function renderStockCell(item: StockItem, key: string): React.ReactNode {
  switch (key) {
    case COLUMN_KEY.NAME:
      return <span className="font-medium text-[var(--ink)]">{item.model?.modellname ?? '—'}</span>
    case COLUMN_KEY.MANUFACTURER:
      return <span className="text-[var(--ink-2)]">{item.model?.manufacturer?.name ?? '—'}</span>
    case COLUMN_KEY.MENGE:
      return <span className="tabular-nums">{item.quantity}</span>
    case COLUMN_KEY.EK:
      return item.model?.default_ek != null
        ? <span className="tabular-nums">{formatCurrency(Number(item.model.default_ek))}</span>
        : '—'
    case COLUMN_KEY.VK:
      return item.model?.default_vk != null
        ? <span className="tabular-nums">{formatCurrency(Number(item.model.default_vk))}</span>
        : '—'
    case COLUMN_KEY.LOCATION:
      return <span className="text-[var(--ink-2)]">{item.location ?? '—'}</span>
    default:
      return '—'
  }
}
