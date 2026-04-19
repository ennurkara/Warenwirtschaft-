'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DeviceCard } from '@/components/inventory/device-card'
import { getStatusLabel, getConditionLabel, formatDate } from '@/lib/utils'
import type { Device, Category, DeviceStatus } from '@/lib/types'

const STATUS_COLORS: Record<DeviceStatus, string> = {
  lager: 'bg-green-100 text-green-800',
  im_einsatz: 'bg-blue-100 text-blue-800',
  defekt: 'bg-red-100 text-red-800',
  ausgemustert: 'bg-slate-100 text-slate-800',
}

interface DeviceListProps {
  devices: Device[]
  categories: Category[]
  canAdd: boolean
  hideCategoryFilter?: boolean
  hideHeading?: boolean
  emptyMessage?: string
}

export function DeviceList({ devices, categories, canAdd, hideCategoryFilter, hideHeading, emptyMessage = 'Keine Geräte gefunden.' }: DeviceListProps) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = devices.filter(d => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.serial_number ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || d.category_id === categoryFilter
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  return (
    <div className="space-y-4">
      {!hideHeading && (
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Inventar</h1>
          {canAdd && (
            <Link href="/inventory/new">
              <Button>Gerät hinzufügen</Button>
            </Link>
          )}
        </div>
      )}

      {/* Filter bar — stacks vertically on mobile */}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-3">
        <Input
          placeholder="Nach Name oder Seriennummer suchen..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full md:max-w-sm"
        />
        {!hideCategoryFilter && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Kategorien</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="lager">Im Lager</SelectItem>
            <SelectItem value="im_einsatz">Im Einsatz</SelectItem>
            <SelectItem value="defekt">Defekt</SelectItem>
            <SelectItem value="ausgemustert">Ausgemustert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card list */}
      <div className="flex flex-col gap-2 md:hidden">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm py-8 text-center">{emptyMessage}</p>
        )}
        {filtered.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Seriennummer</TableHead>
              <TableHead>Zustand</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Menge</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead>Hinzugefügt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(device => (
              <TableRow key={device.id} className="cursor-pointer hover:bg-slate-50">
                <TableCell>
                  <Link href={`/inventory/${device.id}`} className="font-medium hover:underline">
                    {device.name}
                  </Link>
                </TableCell>
                <TableCell>{device.category?.name ?? '—'}</TableCell>
                <TableCell className="font-mono text-sm">{device.serial_number ?? '—'}</TableCell>
                <TableCell>{getConditionLabel(device.condition)}</TableCell>
                <TableCell>
                  <Badge className={STATUS_COLORS[device.status]}>
                    {getStatusLabel(device.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{device.quantity}</TableCell>
                <TableCell>{device.location ?? '—'}</TableCell>
                <TableCell>{formatDate(device.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
