import React from 'react'
import {
  Store,
  Printer,
  Scan,
  Cable,
  Monitor,
  Keyboard,
  MousePointer,
  Network,
  Package,
} from 'lucide-react'

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

const ICON_MAP: Record<string, IconComponent> = {
  'cash-register': Store,
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
  return React.createElement(Icon, { className })
}

export { Package as AllDevicesIcon }