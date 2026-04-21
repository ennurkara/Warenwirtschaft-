export const COLUMN_KEY = {
  MODEL: 'model',
  MANUFACTURER: 'manufacturer',
  SERIAL: 'serial',
  HW_SERIAL: 'hw_serial',
  SW_SERIAL: 'sw_serial',
  TSE_SERIAL: 'tse_serial',
  TSE_VALID: 'tse_valid',
  FISKAL_2020: 'fiskal_2020',
  ZVT: 'zvt',
  EK: 'ek',
  VK: 'vk',
  STATUS: 'status',
  LOCATION: 'location',
  NAME: 'name',
} as const

export type ColumnKey = (typeof COLUMN_KEY)[keyof typeof COLUMN_KEY]

export interface ColumnDef {
  key: ColumnKey
  label: string
  align?: 'left' | 'right'
}

const KASSEN_COLUMNS: ColumnDef[] = [
  { key: COLUMN_KEY.MODEL,        label: 'Modell' },
  { key: COLUMN_KEY.MANUFACTURER, label: 'Hersteller' },
  { key: COLUMN_KEY.HW_SERIAL,    label: 'HW-SN' },
  { key: COLUMN_KEY.SW_SERIAL,    label: 'SW-SN' },
  { key: COLUMN_KEY.TSE_VALID,    label: 'TSE gültig bis' },
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

export function getColumnsForCategory(categoryName: string): ColumnDef[] {
  const simple = new Set(['Kabel', 'Sonstiges'])
  if (categoryName === 'Registrierkasse') return KASSEN_COLUMNS
  if (simple.has(categoryName)) return SIMPLE_COLUMNS
  return GENERIC_DEVICE_COLUMNS
}
