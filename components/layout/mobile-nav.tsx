'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, ClipboardList, ShieldCheck } from 'lucide-react'
import { Logo } from './logo'
import type { Profile } from '@/lib/types'

const tabs = [
  { href: '/dashboard',       label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/inventory',       label: 'Inventar',       icon: Package },
  { href: '/arbeitsberichte', label: 'Berichte',       icon: ClipboardList },
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

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 inset-x-0 z-50 md:hidden bg-white border-t border-[var(--rule)]">
        <div className={cn('grid h-16', isAdmin ? 'grid-cols-4' : 'grid-cols-3')}>
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
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
                'flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
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
