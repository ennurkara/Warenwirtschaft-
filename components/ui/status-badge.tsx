import { Badge } from './badge'

export type DeviceStatus =
  | 'lager'
  | 'reserviert'
  | 'verliehen'
  | 'im_einsatz'   // Legacy — semantisch = verliehen
  | 'verkauft'
  | 'in_reparatur'
  | 'defekt'
  | 'ausgemustert'

const MAP: Record<DeviceStatus, { label: string; variant: 'lager' | 'reserv' | 'verkauft' | 'defekt' | 'aus' }> = {
  lager:        { label: 'Im Lager',     variant: 'lager' },
  reserviert:   { label: 'Reserviert',   variant: 'reserv' },
  verliehen:    { label: 'Verliehen',    variant: 'verkauft' },   // blau
  im_einsatz:   { label: 'Verliehen',    variant: 'verkauft' },   // legacy → verliehen
  verkauft:     { label: 'Verkauft',     variant: 'aus' },        // grau (Endzustand)
  in_reparatur: { label: 'In Reparatur', variant: 'reserv' },     // amber (Aufgabe)
  defekt:       { label: 'Defekt',       variant: 'defekt' },     // rot
  ausgemustert: { label: 'Ausgemustert', variant: 'aus' },
}

export function StatusBadge({ status }: { status: DeviceStatus | string }) {
  const def = MAP[status as DeviceStatus] ?? { label: status, variant: 'aus' as const }
  return (
    <Badge variant={def.variant} withDot>
      {def.label}
    </Badge>
  )
}
