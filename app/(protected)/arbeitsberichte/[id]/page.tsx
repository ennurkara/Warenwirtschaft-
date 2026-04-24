import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { formatDateTime, deviceDisplayName } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function BerichtDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: report } = await supabase
    .from('work_reports')
    .select(`
      *,
      customer:customers(*),
      technician:profiles!work_reports_technician_id_fkey(full_name),
      devices:work_report_devices(device:devices(
        id,
        serial_number,
        model:models(
          modellname,
          variante,
          manufacturer:manufacturers(name)
        )
      ))
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const devices = ((report as any).devices ?? []).map((d: any) => d.device)
  const customer = (report as any).customer
  const technician = (report as any).technician

  let pdfUrl: string | null = null
  if (report.pdf_path) {
    const { data: signed } = await supabase.storage
      .from('work-report-pdfs')
      .createSignedUrl(report.pdf_path, 60 * 10)
    pdfUrl = signed?.signedUrl ?? null
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/arbeitsberichte"
          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)]">
          {report.report_number ?? 'Entwurf'}
        </h1>
        <span
          className={
            report.status === 'abgeschlossen'
              ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200'
              : 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200'
          }
        >
          {report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Entwurf'}
        </span>

        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-[var(--blue)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <Download className="h-3.5 w-3.5" /> PDF herunterladen
          </a>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[var(--rule)] divide-y divide-[var(--rule)]">
        <div className="p-5">
          <p className="text-xs text-[var(--ink-4)] uppercase tracking-wide mb-1">Kunde</p>
          <p className="font-medium">{customer?.name ?? '—'}</p>
          {customer?.address && <p className="text-sm text-[var(--ink-3)]">{customer.address}</p>}
          {customer?.phone && <p className="text-sm text-[var(--ink-3)]">{customer.phone}</p>}
          {customer?.email && <p className="text-sm text-[var(--ink-3)]">{customer.email}</p>}
        </div>

        <div className="p-5">
          <p className="text-xs text-[var(--ink-4)] uppercase tracking-wide mb-1">Techniker & Aufwand</p>
          <p className="font-medium">{technician?.full_name ?? '—'}</p>
          {report.start_time && (
            <p className="text-sm text-[var(--ink-3)]">{formatDateTime(report.start_time)}</p>
          )}
          {report.work_hours != null && (
            <p className="text-sm text-[var(--ink-3)]">{report.work_hours}h Aufwand</p>
          )}
          {report.travel_from && report.travel_to && (
            <p className="text-sm text-[var(--ink-3)]">
              Anfahrt: {report.travel_from} → {report.travel_to}
            </p>
          )}
        </div>

        {report.description && (
          <div className="p-5">
            <p className="text-xs text-[var(--ink-4)] uppercase tracking-wide mb-2">Ausgeführte Tätigkeit</p>
            <p className="text-sm text-[var(--ink-2)] whitespace-pre-wrap">{report.description}</p>
          </div>
        )}

        {devices.length > 0 && (
          <div className="p-5">
            <p className="text-xs text-[var(--ink-4)] uppercase tracking-wide mb-3">Eingesetzte Geräte</p>
            <div className="space-y-2">
              {devices.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--ink-2)] font-medium">
                    {deviceDisplayName(d.model)}
                  </span>
                  {d.serial_number && (
                    <span className="text-[var(--ink-4)] font-mono text-xs">{d.serial_number}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {report.status === 'abgeschlossen' && (
          <div className="p-5 grid grid-cols-2 gap-4">
            {report.technician_signature && (
              <div>
                <p className="text-xs text-[var(--ink-4)] mb-2">Unterschrift Techniker</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.technician_signature}
                  alt="Unterschrift Techniker"
                  className="border border-[var(--rule)] rounded-lg h-20 w-full object-contain bg-white"
                />
              </div>
            )}
            {report.customer_signature && (
              <div>
                <p className="text-xs text-[var(--ink-4)] mb-2">Unterschrift Kunde</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.customer_signature}
                  alt="Unterschrift Kunde"
                  className="border border-[var(--rule)] rounded-lg h-20 w-full object-contain bg-white"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
