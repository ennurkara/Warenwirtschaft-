'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { DeviceCard } from '@/components/inventory/device-card'
import { formatCurrency } from '@/lib/utils'
import { getColumnsForCategory, COLUMN_KEY, ColumnKey } from '@/lib/category-columns'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import { Search } from 'lucide-react'
import type { Device, Category } from '@/lib/types'

interface DeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  activeCategoryName?: string
  hideCategoryFilter?: boolean
  hideHeading?: boolean
  emptyMessage?: string
}

export function DeviceList({
  devices, canAdd,
  activeCategoryName, hideHeading,
  emptyMessage = 'Keine Geräte gefunden.',
}: DeviceListProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const columns = useMemo(() => getColumnsForCategory(activeCategoryName ?? 'Unbekannt'), [activeCategoryName])

  const filtered = devices.filter(d => {
    const s = search.toLowerCase()
    const name = (d.model?.modellname ?? '').toLowerCase()
    const ms = (d.serial_number ?? '').toLowerCase()
    const sw = (d.vectron_details?.sw_serial ?? '').toLowerCase()
    const matchesSearch = !s || name.includes(s) || ms.includes(s) || sw.includes(s)
    const display = deriveDisplayStatus(d)
    const matchesStatus = statusFilter === 'all' || display === statusFilter
    return matchesSearch && matchesStatus
  })

  function cellValue(d: Device, key: ColumnKey): React.ReactNode {
    switch (key) {
      case COLUMN_KEY.MODEL:        return <Link href={`/inventory/${d.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--blue)]">{d.model?.modellname ?? '—'}</Link>
      case COLUMN_KEY.MANUFACTURER: return <span className="text-[var(--ink-2)]">{d.model?.manufacturer?.name ?? '—'}</span>
      case COLUMN_KEY.SERIAL:       return <span className="kb-mono text-[12px] text-[var(--ink-2)]">{d.serial_number ?? '—'}</span>
      case COLUMN_KEY.SW_SERIAL:    return <span className="kb-mono text-[12px] text-[var(--ink-2)]">{d.vectron_details?.sw_serial ?? '—'}</span>
      case COLUMN_KEY.FISKAL_2020:  return d.vectron_details ? (d.vectron_details.fiskal_2020 ? 'Ja' : 'Nein') : '—'
      case COLUMN_KEY.ZVT:          return d.vectron_details ? (d.vectron_details.zvt ? 'Ja' : 'Nein') : '—'
      case COLUMN_KEY.LICENSE_TYPE: {
        const lt = d.vectron_details?.license_type
        if (!lt) return '—'
        return lt === 'full' ? 'Full' : 'Light'
      }
      case COLUMN_KEY.EK:           return d.purchase_item ? <span className="tabular-nums">{formatCurrency(Number(d.purchase_item.ek_preis))}</span> : '—'
      case COLUMN_KEY.VK:           return d.sale_item ? <span className="tabular-nums">{formatCurrency(Number(d.sale_item.vk_preis))}</span> : '—'
      case COLUMN_KEY.STATUS:       return <StatusBadge status={deriveDisplayStatus(d)} />
      case COLUMN_KEY.LOCATION:     return <span className="text-[var(--ink-2)]">{d.location ?? '—'}</span>
      case COLUMN_KEY.NAME:         return <Link href={`/inventory/${d.id}`} className="font-medium text-[var(--ink)] hover:text-[var(--blue)]">{d.model?.modellname ?? '—'}</Link>
      default: return '—'
    }
  }

  return (
    <div className="space-y-4">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h1 className="kb-h1">{activeCategoryName ?? 'Inventar'}</h1>
          {canAdd && <Link href="/inventory/new"><Button>Gerät anlegen</Button></Link>}
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:gap-3">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--ink-3)] pointer-events-none" />
          <Input
            placeholder="Suchen · Name, Seriennr., SW-SN…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="lager">Im Lager</SelectItem>
            <SelectItem value="reserviert">Reserviert</SelectItem>
            <SelectItem value="verkauft">Verkauft</SelectItem>
            <SelectItem value="defekt">Defekt</SelectItem>
            <SelectItem value="ausgemustert">Ausgemustert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {filtered.length === 0 && <p className="text-[var(--ink-3)] text-sm py-8 text-center">{emptyMessage}</p>}
        {filtered.map(device => <DeviceCard key={device.id} device={device} />)}
      </div>

      {/* Desktop ledger table */}
      <div className="hidden md:block rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="text-center text-[var(--ink-3)] py-10">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {filtered.map(device => (
              <tr
                key={device.id}
                className="cursor-pointer"
                onClick={() => router.push(`/inventory/${device.id}`)}
              >
                {columns.map(col => (
                  <td key={col.key} className={col.align === 'right' ? 'num' : ''}>
                    {cellValue(device, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
