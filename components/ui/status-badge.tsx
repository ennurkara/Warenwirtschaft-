import { Badge } from './badge'

export type DeviceStatus =
  | 'lager'
  | 'reserviert'
  | 'verkauft'
  | 'defekt'
  | 'ausgemustert'

const MAP: Record<DeviceStatus, { label: string; variant: 'lager' | 'reserv' | 'verkauft' | 'defekt' | 'aus' }> = {
  lager:        { label: 'Im Lager',     variant: 'lager' },
  reserviert:   { label: 'Reserviert',   variant: 'reserv' },
  verkauft:     { label: 'Verkauft',     variant: 'verkauft' },
  defekt:       { label: 'Defekt',       variant: 'defekt' },
  ausgemustert: { label: 'Ausgemustert', variant: 'aus' },
}

export function StatusBadge({ status }: { status: DeviceStatus | string }) {
  const def = MAP[status as DeviceStatus] ?? MAP.lager
  return (
    <Badge variant={def.variant} withDot>
      {def.label}
    </Badge>
  )
}
