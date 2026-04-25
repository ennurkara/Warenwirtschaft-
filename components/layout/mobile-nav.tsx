'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isAdmin = profile.role === 'admin'

  // Bottom Nav muss DIREKT an <body> hängen, damit iOS Safari sie nicht mit
  // einem verschachtelten Containing-Block-Vorfahren verheddert. Render
  // erst nach mount (SSR hat kein document).
  const bottomNav = mounted ? createPortal(
    <div
      className="md:hidden bg-white border-t border-[var(--rule)]"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
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
    </div>,
    document.body,
  ) : null

  return (
    <>
      {/* Top bar — logo + sign out */}
      <nav className="md:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-white/80 backdrop-blur-md border-b border-[var(--rule)]">
        <Logo height={20} />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>Abmelden</Button>
      </nav>

      {bottomNav}
    </>
  )
}
