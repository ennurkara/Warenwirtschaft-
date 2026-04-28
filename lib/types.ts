// lib/types.ts
export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type DeviceStatus =
  | 'lager'
  | 'reserviert'
  | 'verkauft'
  | 'im_einsatz'   // Legacy — wird nicht mehr neu vergeben, durch 'verliehen' ersetzt
  | 'verliehen'
  | 'in_reparatur'
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
  notes: string | null
  default_monthly_update_fee_ek: number | null
  default_monthly_update_fee_vk: number | null
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

export type CustomerKind = 'vectron' | 'apro' | 'sonstige'

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  vat_id: string | null
  tax_number: string | null
  customer_number: string | null
  vectron_operator_id: string | null
  last_heartbeat_at: string | null
  notes: string | null
  customer_kind: CustomerKind
  created_at: string
}

export interface CustomerSite {
  id: string
  customer_id: string
  vectron_site_id: string | null
  site_no: string | null
  name: string
  street: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ---------- TSE / Verträge / Lizenzen ----------

export type TseKind = 'usb' | 'sd'

export interface TseDetails {
  device_id: string
  kind: TseKind
  bsi_k_tr_number: string | null
  expires_at: string | null    // ISO YYYY-MM-DD
  installed_in_device: string | null
  created_at: string
  updated_at: string
}

export type ContractKind = 'myvectron' | 'smart4pay' | 'apro_updates'
export type ContractStatus = 'aktiv' | 'gekuendigt' | 'beendet'

export interface Contract {
  id: string
  customer_id: string
  kind: ContractKind
  start_date: string           // ISO YYYY-MM-DD
  end_date: string | null
  monthly_fee: number | null
  status: ContractStatus
  ec_device_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
  ec_device?: Device | null
}

export type LicenseStatus = 'aktiv' | 'gekuendigt' | 'abgelaufen'

export interface License {
  id: string
  customer_id: string
  model_id: string | null
  name: string
  license_key: string | null
  purchased_at: string | null  // ISO YYYY-MM-DD
  monthly_update_fee: number | null
  ek_preis: number | null
  vk_preis: number | null
  status: LicenseStatus
  notes: string | null
  created_at: string
  updated_at: string
  model?: Model | null
}

export type VectronLicenseType = 'full' | 'light'

export interface VectronDetails {
  device_id: string
  sw_serial: string | null
  fiskal_2020: boolean
  zvt: boolean
  license_type: VectronLicenseType | null
  sw_version: string | null
  os_version: string | null
  platform: string | null
  login: string | null
  connect_id: string | null
  fiscal_identifier: string | null
  last_heartbeat_at: string | null
  vectron_cash_register_id: string | null
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
  /** FK auf customers — wer hat das Gerät grade (verliehen oder verkauft). */
  current_customer_id: string | null
  /** FK auf customer_sites — bei Vectron-Kassen die zugeordnete Filiale. */
  site_id: string | null
  model?: Model
  vectron_details?: VectronDetails | null
  tse_details?: TseDetails | null
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
  /** Vectron-only: Software-/Lizenz-Seriennummer. Bei Nicht-Vectron null. */
  sw_serial: string | null
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
  /** Vectron-only: Software-Seriennummer. Bei Nicht-Vectron-Zeilen null. */
  sw_serial: string | null
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
    /** Vectron-only — RPC schreibt vectron_details mit dieser SW-SN, wenn das
     *  Modell zu Vectron-Hersteller gehört. Bei Nicht-Vectron ignoriert. */
    sw_serial: string | null
    location: string | null
    notes: string | null
    ek_preis: number | null
  }>
}
