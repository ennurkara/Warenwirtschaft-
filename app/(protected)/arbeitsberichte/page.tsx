import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { FileText, ExternalLink } from 'lucide-react'
import type { WorkReport } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function ArbeitsberichtePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reports } = await supabase
    .from('work_reports')
    .select(`
      id, report_number, customer_id, technician_id, status,
      work_hours, start_time, completed_at, created_at, pdf_path,
      customer:customers(name),
      technician:profiles!work_reports_technician_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  const rows = (reports ?? []) as unknown as WorkReport[]

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">
            Arbeitsberichte
          </h1>
          <p className="text-sm text-[var(--ink-3)] mt-1">
            Eingehende Berichte aus der Arbeitsbericht-App. Erstellung erfolgt dort —{' '}
            <a
              href="https://arbeitsbericht.kassen-buch.cloud"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--blue)] inline-flex items-center gap-1 hover:underline"
            >
              Arbeitsbericht öffnen <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[var(--rule)] rounded-lg">
          <FileText className="h-12 w-12 text-[var(--ink-4)] mx-auto mb-4" />
          <p className="text-[var(--ink-3)]">Noch keine Arbeitsberichte vorhanden.</p>
        </div>
      ) : (
        <div className="bg-white border border-[var(--rule)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] text-[11px] uppercase tracking-wide text-[var(--ink-3)]">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Nummer</th>
                <th className="text-left px-4 py-2 font-medium">Kunde</th>
                <th className="text-left px-4 py-2 font-medium">Techniker</th>
                <th className="text-left px-4 py-2 font-medium">Datum</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--rule)]">
              {rows.map(r => {
                const customer = (r as any).customer
                const technician = (r as any).technician
                return (
                  <tr key={r.id} className="hover:bg-[var(--paper-2)]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/arbeitsberichte/${r.id}`}
                        className="font-medium text-[var(--ink)] hover:text-[var(--blue)]"
                      >
                        {r.report_number ?? 'Entwurf'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-2)]">{customer?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--ink-2)]">{technician?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-[var(--ink-3)]">
                      {r.completed_at ? formatDate(r.completed_at) : formatDate(r.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          r.status === 'abgeschlossen'
                            ? 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-50 text-green-700 border border-green-200'
                            : 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200'
                        }
                      >
                        {r.status === 'abgeschlossen' ? 'Abgeschlossen' : 'Entwurf'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.pdf_path ? (
                        <span className="text-[var(--blue)] text-xs">verfügbar</span>
                      ) : (
                        <span className="text-[var(--ink-4)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
