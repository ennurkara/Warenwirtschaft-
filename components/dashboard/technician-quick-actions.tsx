import { ClipboardPlus, ExternalLink } from 'lucide-react'

export function TechnicianQuickActions() {
  return (
    <div className="rounded-kb border border-[var(--blue)] bg-[var(--blue-tint)]/30 shadow-xs overflow-hidden p-[18px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-[var(--ink)]">
            Neuen Arbeitsbericht erstellen
          </div>
          <div className="text-[12.5px] text-[var(--ink-3)] mt-0.5">
            Wizard läuft in der Schwester-App. Du wirst automatisch eingeloggt, falls Session aktiv.
          </div>
        </div>
        <a
          href="https://arbeitsbericht.kassen-buch.cloud/arbeitsberichte/new"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--blue)] text-white px-4 py-2 text-[12.5px] font-medium hover:bg-[var(--blue-ink)] transition-colors"
        >
          <ClipboardPlus className="h-4 w-4" />
          AB starten
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      </div>
    </div>
  )
}
