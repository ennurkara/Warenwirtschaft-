// lib/types.ts
export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type DeviceStatus =
  | 'lager'
  | 'reserviert'
  | 'verkauft'
  | 'im_einsatz'
  | 'defekt'
  | 'ausgemustert'

export type WorkReportStatus = 'entwurf' | 'abgeschlossen'
export type CategoryKind = 'kassenhardware' | 'generic' | 'simple' | 'stock'
export type Cluster = 'kassen' | 'druck' | 'mobile' | 'peripherie' | 'netzwerk_strom' | 'montage' | 'sonstiges'
export type StockMovementKind = 'einkauf' | 'verkauf' | 'korrektur'

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
  kind: CategoryKind
  cluster: Cluster
  created_at: string
}

export interface CategoryWithCount extends Category {
  device_count: number
}

export interface Manufacturer {
  id: string
  name: string
  default_supplier_id: string | null
  created_at: string
  default_supplier?: Supplier | null
}

export interface Model {
  id: string
  manufacturer_id: string
  category_id: string
  modellname: string
  variante: string | null
  version: string | null
  default_ek: number | null
  default_vk: number | null
  default_supplier_id: string | null
  created_at: string
  manufacturer?: Manufacturer
  category?: Category
  default_supplier?: Supplier | null
}

export interface Supplier {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  notes: string | null
  created_at: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
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

export interface WorkReport {
  id: string
  report_number: string | null
  customer_id: string
  technician_id: string
  description: string | null
  work_hours: number | null
  travel_from: string | null
  travel_to: string | null
  start_time: string
  end_time: string | null
  status: WorkReportStatus
  technician_signature: string | null
  customer_signature: string | null
  completed_at: string | null
  pdf_path: string | null
  pdf_uploaded_at: string | null
  created_at: string
  updated_at: string
  customer?: Customer
  technician?: Profile
  devices?: Array<{ device?: Device }>
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

export interface StockItem {
  id: string
  model_id: string
  quantity: number
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
  model?: Model
}

export interface StockMovement {
  id: string
  stock_item_id: string
  kind: StockMovementKind
  delta: number
  unit_price: number | null
  reference_id: string | null
  user_id: string
  note: string | null
  created_at: string
}

// ---------- Lieferscheinmodus ----------
export interface LieferscheinOcrItem {
  manufacturer: string | null
  name: string | null
  serial_number: string | null
  quantity: number
  ek_preis: number | null
}

export interface LieferscheinOcrResponse {
  supplier: string | null
  rechnungsnr: string | null
  datum: string | null            // ISO YYYY-MM-DD
  source_path: string
  items: LieferscheinOcrItem[]
}

export interface LieferscheinRowDraft {
  client_id: string               // React key, not persisted
  manufacturer_id: string | null
  model_id: string | null
  category_id: string | null      // derived from model when possible
  serial_number: string | null
  location: string | null
  notes: string | null
  ek_preis: number | null
  // Prefilled OCR values kept for UI hints when no DB match exists
  ocr_manufacturer: string | null
  ocr_name: string | null
}

export interface LieferscheinRpcPayload {
  supplier_id: string
  rechnungsnr: string | null
  datum: string                   // ISO YYYY-MM-DD
  source_document_path: string
  items: Array<{
    model_id: string
    serial_number: string | null
    location: string | null
    notes: string | null
    ek_preis: number | null
  }>
}
