import {
  CashRegister,
  Printer,
  Scan,
  Cable,
  Monitor,
  Keyboard,
  MousePointer,
  Network,
  Package,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  'cash-register': CashRegister,
  'printer': Printer,
  'scan': Scan,
  'cable': Cable,
  'monitor': Monitor,
  'keyboard': Keyboard,
  'mouse-pointer': MousePointer,
  'network': Network,
}

interface CategoryIconProps {
  name: string | null
  className?: string
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  const Icon = (name && ICON_MAP[name]) ?? Package
  return <Icon className={className} />
}

export { Package as AllDevicesIcon }