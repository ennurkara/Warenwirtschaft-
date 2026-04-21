// lib/types.ts
export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type DeviceStatus = 'lager' | 'reserviert' | 'verkauft' | 'defekt' | 'ausgemustert'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Category {
  id: string
  name: string
  icon: string | null
  created_at: string
}

export interface CategoryWithCount extends Category {
  device_count: number
}

export interface Manufacturer {
  id: string
  name: string
  created_at: string
}

export interface Model {
  id: string
  manufacturer_id: string
  category_id: string
  modellname: string
  variante: string | null
  version: string | null
  created_at: string
  manufacturer?: Manufacturer
  category?: Category
}

export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export type VectronLicenseType = 'full' | 'light'

export interface VectronDetails {
  device_id: string
  sw_serial: string | null
  fiskal_2020: boolean
  zvt: boolean
  license_type: VectronLicenseType
}

export interface Device {
  id: string
  model_id: string
  serial_number: string | null
  status: DeviceStatus
  location: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  model?: Model
  vectron_details?: VectronDetails | null
  purchase_item?: PurchaseItem | null
  sale_item?: SaleItem | null
}

export interface Purchase {
  id: string
  supplier_id: string
  rechnungsnr: string | null
  datum: string
  notes: string | null
  created_by: string | null
  created_at: string
  supplier?: Supplier
  items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  device_id: string
  ek_preis: number
  purchase?: Purchase
  device?: Device
}

export interface Sale {
  id: string
  customer_id: string
  rechnungsnr: string | null
  datum: string
  notes: string | null
  created_by: string | null
  created_at: string
  customer?: Customer
  items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  device_id: string
  vk_preis: number
  sale?: Sale
  device?: Device
}

export interface OcrResult {
  name: string | null
  serial_number: string | null
  manufacturer: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
