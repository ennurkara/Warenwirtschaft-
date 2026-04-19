export type UserRole = 'admin' | 'mitarbeiter' | 'viewer'
export type DeviceCondition = 'neu' | 'gebraucht'
export type DeviceStatus = 'lager' | 'im_einsatz' | 'defekt' | 'ausgemustert'
export type MovementAction = 'entnahme' | 'einlagerung' | 'defekt_gemeldet'

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

export interface Device {
  id: string
  name: string
  category_id: string
  serial_number: string | null
  condition: DeviceCondition
  status: DeviceStatus
  quantity: number
  location: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  category?: Category
}

export interface DeviceMovement {
  id: string
  device_id: string
  user_id: string
  action: MovementAction
  quantity: number
  note: string | null
  created_at: string
  device?: Device
  profile?: Profile
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