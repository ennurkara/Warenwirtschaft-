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

export function MobileNav({ profile }: { profile: Profile }) {
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
    <>
      {/* Top bar — logo + sign out */}
      <nav className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-white/80 backdrop-blur-md border-b border-[var(--rule)]">
        <Logo height={20} />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>Abmelden</Button>
      </nav>

      {/* Bottom tab bar — 4 tabs always, +Admin for admins.
          - safe-area-inset-bottom: respect iPhone home-indicator
          - transform: translateZ(0): force a compositor layer so iOS Safari
            doesn't repaint/jiggle the bar during URL-bar collapse */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-[var(--rule)]"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: 'translateZ(0)',
          willChange: 'transform',
        }}
      >
        <div className={cn('grid h-16', isAdmin ? 'grid-cols-5' : 'grid-cols-4')}>
          {tabs.map(({ href, label, icon: Icon }) => {
            // /inventory darf nicht gegen /inventory/delivery feuern
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
    </>
  )
}
