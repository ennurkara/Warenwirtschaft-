'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeviceCard } from '@/components/inventory/device-card'
import { getStatusLabel, formatDate, formatCurrency } from '@/lib/utils'
import { getColumnsForCategory, COLUMN_KEY, ColumnKey } from '@/lib/category-columns'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import type { Device, Category, DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager:       'bg-green-100 text-green-800',
  reserviert:  'bg-yellow-100 text-yellow-800',
  verkauft:    'bg-blue-100 text-blue-800',
  defekt:      'bg-red-100 text-red-800',
  ausgemustert:'bg-slate-100 text-slate-800',
}

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
  devices, categories, canAdd,
  activeCategoryName, hideCategoryFilter, hideHeading,
  emptyMessage = 'Keine Geräte gefunden.',
}: DeviceListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const columns = useMemo(() => getColumnsForCategory(activeCategoryName ?? 'Unbekannt'), [activeCategoryName])

  const filtered = devices.filter(d => {
    const s = search.toLowerCase()
    const name = (d.model?.modellname ?? '').toLowerCase()
    const ms = (d.serial_number ?? '').toLowerCase()
    const hw = (d.kassen_details?.hw_serial ?? '').toLowerCase()
    const matchesSearch = !s || name.includes(s) || ms.includes(s) || hw.includes(s)
    const display = deriveDisplayStatus(d)
    const matchesStatus = statusFilter === 'all' || display === statusFilter
    return matchesSearch && matchesStatus
  })

  function cellValue(d: Device, key: ColumnKey): React.ReactNode {
    switch (key) {
      case COLUMN_KEY.MODEL:        return <Link href={`/inventory/${d.id}`} className="font-medium hover:underline">{d.model?.modellname ?? '—'}</Link>
      case COLUMN_KEY.MANUFACTURER: return d.model?.manufacturer?.name ?? '—'
      case COLUMN_KEY.SERIAL:       return <span className="font-mono text-sm">{d.serial_number ?? '—'}</span>
      case COLUMN_KEY.HW_SERIAL:    return <span className="font-mono text-sm">{d.kassen_details?.hw_serial ?? '—'}</span>
      case COLUMN_KEY.SW_SERIAL:    return <span className="font-mono text-sm">{d.kassen_details?.sw_serial ?? '—'}</span>
      case COLUMN_KEY.TSE_SERIAL:   return <span className="font-mono text-sm">{d.kassen_details?.tse_serial ?? '—'}</span>
      case COLUMN_KEY.TSE_VALID:    return d.kassen_details?.tse_valid_until ? formatDate(d.kassen_details.tse_valid_until) : '—'
      case COLUMN_KEY.FISKAL_2020:  return d.kassen_details?.fiskal_2020 ? 'Ja' : 'Nein'
      case COLUMN_KEY.ZVT:          return d.kassen_details?.zvt ? 'Ja' : 'Nein'
      case COLUMN_KEY.EK:           return d.purchase_item ? formatCurrency(Number(d.purchase_item.ek_preis)) : '—'
      case COLUMN_KEY.VK:           return d.sale_item ? formatCurrency(Number(d.sale_item.vk_preis)) : '—'
      case COLUMN_KEY.STATUS:       { const st = deriveDisplayStatus(d); return <Badge className={STATUS_COLORS[st]}>{getStatusLabel(st)}</Badge> }
      case COLUMN_KEY.LOCATION:     return d.location ?? '—'
      case COLUMN_KEY.NAME:         return <Link href={`/inventory/${d.id}`} className="font-medium hover:underline">{d.model?.modellname ?? '—'}</Link>
      default: return '—'
    }
  }

  return (
    <div className="space-y-4">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{activeCategoryName ?? 'Inventar'}</h1>
          {canAdd && <Link href="/inventory/new"><Button>Gerät hinzufügen</Button></Link>}
        </div>
      )}

      <div className="flex flex-col gap-2 md:flex-row md:gap-3">
        <Input placeholder="Suchen (Name, Seriennr, HW-SN)..." value={search} onChange={e => setSearch(e.target.value)} className="w-full md:max-w-sm" />
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
        {filtered.length === 0 && <p className="text-slate-500 text-sm py-8 text-center">{emptyMessage}</p>}
        {filtered.map(device => <DeviceCard key={device.id} device={device} />)}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border bg-white overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-slate-500 py-8">{emptyMessage}</TableCell>
              </TableRow>
            )}
            {filtered.map(device => (
              <TableRow key={device.id} className="cursor-pointer hover:bg-slate-50">
                {columns.map(col => (
                  <TableCell key={col.key} className={col.align === 'right' ? 'text-right' : ''}>
                    {cellValue(device, col.key)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
