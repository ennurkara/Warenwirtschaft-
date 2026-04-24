import type { CategoryKind } from '@/lib/types'

export const COLUMN_KEY = {
  MODEL: 'model',
  MANUFACTURER: 'manufacturer',
  SERIAL: 'serial',
  SW_SERIAL: 'sw_serial',
  FISKAL_2020: 'fiskal_2020',
  ZVT: 'zvt',
  LICENSE_TYPE: 'license_type',
  EK: 'ek',
  VK: 'vk',
  STATUS: 'status',
  LOCATION: 'location',
  NAME: 'name',
  MENGE: 'menge',
} as const

export type ColumnKey = (typeof COLUMN_KEY)[keyof typeof COLUMN_KEY]

export interface ColumnDef {
  key: ColumnKey
  label: string
  align?: 'left' | 'right'
}

const KASSENHARDWARE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,        label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.SERIAL,       label: 'HW-SN' },
  { key: COLUMN_KEY.SW_SERIAL,    label: 'SW-SN' },
  { key: COLUMN_KEY.LICENSE_TYPE, label: 'Lizenz' },
  { key: COLUMN_KEY.FISKAL_2020,  label: 'Fiskal 2020' },
  { key: COLUMN_KEY.ZVT,          label: 'ZVT' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.STATUS,       label: 'Status' },
]

const GENERIC_DEVICE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,        label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.SERIAL,       label: 'Seriennummer' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.STATUS,       label: 'Status' },
]

const SIMPLE_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.NAME,         label: 'Name' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.LOCATION,     label: 'Standort' },
  { key: COLUMN_KEY.STATUS,       label: 'Status' },
]

const STOCK_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.NAME,         label: 'Name' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.MENGE,        label: 'Menge', align: 'right' },
  { key: COLUMN_KEY.EK,           label: 'EK', align: 'right' },
  { key: COLUMN_KEY.VK,           label: 'VK', align: 'right' },
  { key: COLUMN_KEY.LOCATION,     label: 'Standort' },
]

export function getColumnsForKind(kind: CategoryKind | undefined): ColumnDef[] {
  switch (kind) {
    case 'kassenhardware': return KASSENHARDWARE_COLUMNS
    case 'simple':         return SIMPLE_COLUMNS
    case 'stock':          return STOCK_COLUMNS
    case 'generic':
    default:               return GENERIC_DEVICE_COLUMNS
  }
}
