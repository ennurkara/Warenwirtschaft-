'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Logo } from './logo'
import type { Profile } from '@/lib/types'
import {
  LayoutDashboard,
  Package,
  Truck,
  Users,
  Banknote,
  FileText,
  Settings,
  Factory,
  Tag,
  ScanLine,
  ClipboardList,
  LogOut,
} from 'lucide-react'

const mainLinks = [
  { href: '/dashboard',              label: 'Dashboard',            icon: LayoutDashboard, kb: '1' },
  { href: '/inventory',              label: 'Inventar',             icon: Package,         kb: '2' },
  { href: '/inventory/delivery/new', label: 'Lieferschein scannen', icon: ScanLine,        kb: '3' },
  { href: '/customers',              label: 'Kunden',               icon: Users,           kb: '4' },
  { href: '/arbeitsberichte',        label: 'Arbeitsberichte',      icon: ClipboardList,   kb: '5' },
]

const adminLinks = [
  { href: '/admin/models',        label: 'Modelle',     icon: Banknote },
  { href: '/admin/categories',    label: 'Kategorien',  icon: Tag },
  { href: '/admin/manufacturers', label: 'Hersteller',  icon: Factory },
  { href: '/admin/customers',     label: 'Kunden',      icon: Users },
  { href: '/admin/suppliers',     label: 'Lieferanten', icon: Truck },
  { href: '/admin/purchases',     label: 'Einkäufe',    icon: FileText },
  { href: '/admin/sales',         label: 'Verkäufe',    icon: FileText },
  { href: '/admin/users',         label: 'Benutzer',    icon: Settings },
]

function initials(name: string | null | undefined) {
  if (!name) return '··'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? '')
    .join('')
}

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isAdmin = profile.role === 'admin'

  return (
    <aside className="hidden md:flex w-[232px] flex-col flex-shrink-0 bg-white border-r border-[var(--rule)] h-screen sticky top-0 overflow-y-auto kb-scroll">
      <div className="px-5 pt-5 pb-4">
        <Logo height={22} />
        <div className="mt-2 text-[11px] font-medium text-[var(--ink-3)] tracking-[-0.003em]">
          Warenwirtschaft · v2.4
        </div>
      </div>

      <div className="px-1 pt-2">
        <div className="kb-label px-3 mb-1">Betrieb</div>
        {mainLinks.map(({ href, label, icon: Icon, kb }) => {
          const active = href === '/inventory'
            ? pathname === '/inventory' || (pathname.startsWith('/inventory/') && !pathname.startsWith('/inventory/delivery'))
            : pathname.startsWith(href)
          return (
            <Link key={href} href={href} className={cn('kb-side-item', active && 'active')}>
              <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
              <span>{label}</span>
              <span className="kbn">⌘{kb}</span>
            </Link>
          )
        })}
      </div>

      {isAdmin && (
        <div className="px-1 pt-3">
          <div className="kb-label px-3 mb-1">Stammdaten</div>
          {adminLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} className={cn('kb-side-item', active && 'active')}>
                <Icon className="h-[15px] w-[15px]" strokeWidth={1.75} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-auto border-t border-[var(--rule)] px-4 py-3 flex items-center gap-2.5">
        <div className="kb-av">{initials(profile.full_name)}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">
            {profile.full_name ?? 'Benutzer'}
          </div>
          <div className="text-[11px] text-[var(--ink-3)] capitalize">
            {profile.role}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          aria-label="Abmelden"
          className="rounded-md p-1.5 text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
