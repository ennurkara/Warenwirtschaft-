import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchDevice } from '@/lib/inventory/queries'
import { SellDialog } from '@/components/inventory/sell-dialog'
import { AddPurchaseForm } from '@/components/inventory/add-purchase-form'
import { LifecycleActions } from '@/components/inventory/lifecycle-actions'
import { AssignmentHistory } from '@/components/inventory/assignment-history'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { deriveDisplayStatus } from '@/lib/inventory/derive-status'
import { ArrowLeft, AlertTriangle, User } from 'lucide-react'

interface DetailFieldProps {
  label: string
  value: React.ReactNode
  mono?: boolean
}

function DetailField({ label, value, mono }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="kb-label">{label}</span>
      <span className={`text-[13.5px] text-[var(--ink)] ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const device = await fetchDevice(supabase, params.id)
  if (!device) notFound()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isAdmin = profile?.role === 'admin'
  const isIncomplete = !device.purchase_item

  const displayStatus = deriveDisplayStatus(device)

  // Lifecycle: aktueller Kunde + komplette Zuordnungs-Historie
  const [currentCustomerRes, historyRes] = await Promise.all([
    device.current_customer_id
      ? supabase
          .from('customers')
          .select('id, name')
          .eq('id', device.current_customer_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('device_assignments')
      .select(`
        id, kind, started_at, ended_at, notes,
        customer:customers(name),
        work_report:work_reports(report_number)
      `)
      .eq('device_id', params.id)
      .order('started_at', { ascending: false }),
  ])
  const currentCustomer = currentCustomerRes.data as { id: string; name: string | null } | null
  const historyRows = (historyRes.data ?? []) as unknown as Parameters<typeof AssignmentHistory>[0]['rows']

  const modelName = device.model?.modellname ?? '—'
  const categoryName = device.model?.category?.name ?? '—'
  const manufacturerName = device.model?.manufacturer?.name ?? '—'
  const serialDisplay = device.serial_number ?? '—'
  const ek = device.purchase_item ? formatCurrency(Number(device.purchase_item.ek_preis)) : null
  const vk = device.sale_item ? formatCurrency(Number(device.sale_item.vk_preis)) : null
  const v = device.vectron_details

  return (
    <div className="max-w-[1100px] mx-auto space-y-[18px]">
      <div className="flex flex-col gap-3 pb-4 mb-1 border-b border-[var(--rule-soft)]">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-[12px] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zum Inventar
        </Link>
        <div className="flex items-start justify-between gap-4 flex-col md:flex-row md:items-end">
          <div>
            <div className="kb-label mb-1.5">
              {categoryName} · {manufacturerName}
            </div>
            <h1 className="kb-h1">{modelName}</h1>
            <div className="text-[13px] text-[var(--ink-3)] mt-1 font-mono">
              {serialDisplay}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={displayStatus} />
            {!device.sale_item && !isIncomplete && (device.status === 'lager' || device.status === 'reserviert') && (
              <SellDialog deviceId={device.id} />
            )}
          </div>
        </div>
      </div>

      {currentCustomer && (
        <div className="rounded-kb border border-[var(--rule)] bg-[var(--blue-tint)]/40 px-[18px] py-3 text-[13px] flex items-center gap-2.5">
          <User className="h-4 w-4 text-[var(--blue)]" />
          <span className="text-[var(--ink-2)]">
            Aktuell {device.status === 'verkauft' ? 'verkauft an' : 'beim Kunden'}:
          </span>
          <span className="font-medium text-[var(--ink)]">{currentCustomer.name ?? '—'}</span>
        </div>
      )}

      {(isAdmin || profile?.role === 'mitarbeiter') && (
        <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
          <div className="kb-sec-head">
            <h3>Aktionen</h3>
          </div>
          <div className="px-[18px] py-3">
            <LifecycleActions deviceId={device.id} status={device.status} />
          </div>
        </div>
      )}

      {isIncomplete && !isAdmin && (
        <div className="rounded-kb border-l-[3px] border-[var(--amber)] bg-[var(--amber-tint)]/70 px-[18px] py-3 text-[13px] text-[#8a5a17] flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            Unvollständiges Gerät — Einkaufsdaten fehlen. Admin muss noch Lieferant und EK
            nachpflegen, bevor das Gerät verkauft werden kann.
          </span>
        </div>
      )}

      {device.photo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={device.photo_url}
          alt={modelName}
          className="rounded-kb max-h-56 object-contain border border-[var(--rule)] bg-white"
        />
      )}

      <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
        <div className="kb-sec-head">
          <h3>Stammdaten</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 p-[18px]">
          <DetailField label="Hardware-SN" value={serialDisplay} mono />
          {v?.sw_serial && <DetailField label="Software-SN" value={v.sw_serial} mono />}
          {v && <DetailField label="Lizenz" value={v.license_type === 'full' ? 'Full' : 'Light'} />}
          {v && <DetailField label="Fiskal 2020" value={v.fiskal_2020 ? 'Ja' : 'Nein'} />}
          {v && <DetailField label="ZVT" value={v.zvt ? 'Ja' : 'Nein'} />}
          {ek && <DetailField label="EK" value={ek} mono />}
          {vk && <DetailField label="VK" value={vk} mono />}
          {device.location && <DetailField label="Standort" value={device.location} />}
          <DetailField label="Hinzugefügt" value={formatDate(device.created_at)} />
        </div>
      </div>

      {device.notes && (
        <div className="rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
          <div className="kb-sec-head">
            <h3>Notizen</h3>
          </div>
          <div className="p-[18px] text-[13.5px] text-[var(--ink)] whitespace-pre-wrap">
            {device.notes}
          </div>
        </div>
      )}

      {isIncomplete && isAdmin && <AddPurchaseForm deviceId={device.id} />}

      <AssignmentHistory rows={historyRows} />
    </div>
  )
}
