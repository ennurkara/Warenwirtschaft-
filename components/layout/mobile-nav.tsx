'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, ClipboardList, ShieldCheck, ScanLine } from 'lucide-react'
import { Logo } from './logo'
import type { Profile } from '@/lib/types'

const tabs = [
  { href: '/dashboard',              label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory',              label: 'Inventar',  icon: Package },
  { href: '/inventory/delivery/new', label: 'Scan',      icon: ScanLine },
  { href: '/arbeitsberichte',        label: 'Berichte',  icon: ClipboardList },
]

export function MobileTopBar({ onSignOut }: { onSignOut: () => void }) {
  return (
    <nav className="md:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-[var(--rule)] shrink-0">
      <Logo height={20} />
      <Button variant="ghost" size="sm" onClick={onSignOut}>Abmelden</Button>
    </nav>
  )
}

/** Bottom Nav als regulärer Flex-Child am Ende der Inner-Column.
 *  KEIN `position: fixed` — auf iOS Safari ist fixed unter URL-bar-Animation
 *  unzuverlässig. Die Nav ist jetzt Teil des Layout-Flows, das ist kugelsicher. */
export function MobileBottomNav({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const isAdmin = profile.role === 'admin'

  return (
    <div
      className="md:hidden bg-white border-t border-[var(--rule)] shrink-0"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className={cn('grid h-16', isAdmin ? 'grid-cols-5' : 'grid-cols-4')}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const isScan = href === '/inventory/delivery/new'
          const isInventory = href === '/inventory'
          const active = isScan
            ? pathname.startsWith('/inventory/delivery')
            : isInventory
              ? pathname === '/inventory' || (pathname.startsWith('/inventory/') && !pathname.startsWith('/inventory/delivery'))
              : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors',
                active ? 'text-[var(--blue)]' : 'text-[var(--ink-4)]'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin/users"
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-[10.5px] font-medium transition-colors',
              pathname.startsWith('/admin') ? 'text-[var(--blue)]' : 'text-[var(--ink-4)]'
            )}
          >
            <ShieldCheck className="h-5 w-5" />
            Admin
          </Link>
        )}
      </div>
    </div>
  )
}

/** Backwards-compat shell — rendert nur die Top-Bar; Bottom-Nav wird vom
 *  Protected-Layout als separate Komponente direkt eingehängt. */
export function MobileNav({ profile }: { profile: Profile }) {
  const router = useRouter()
  const supabase = createClient()
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  // Keep the top-bar export point for legacy imports.
  void profile
  return <MobileTopBar onSignOut={handleSignOut} />
}
