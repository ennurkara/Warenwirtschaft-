import { Badge } from './badge'

export type DeviceStatus =
  | 'lager'
  | 'reserviert'
  | 'verliehen'    // temporaere Leihe (z.B. Ersatzgeraet)
  | 'im_einsatz'   // installiert beim Kunden, ohne Sale-Beleg (z.B. Vectron-Import)
  | 'verkauft'     // beim Kunden mit Sale-Beleg
  | 'in_reparatur'
  | 'defekt'
  | 'ausgemustert'

const MAP: Record<DeviceStatus, { label: string; variant: 'lager' | 'reserv' | 'verkauft' | 'defekt' | 'aus' }> = {
  lager:        { label: 'Im Lager',     variant: 'lager' },
  reserviert:   { label: 'Reserviert',   variant: 'reserv' },
  verliehen:    { label: 'Verliehen',    variant: 'verkauft' },   // blau (Leihe)
  im_einsatz:   { label: 'Im Einsatz',   variant: 'verkauft' },   // blau (installiert beim Kunden)
  verkauft:     { label: 'Im Einsatz',   variant: 'verkauft' },   // blau (Kunde nutzt es aktiv via Sale)
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
