'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Package, ShieldCheck } from 'lucide-react'
import type { Profile } from '@/lib/types'

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventar' },
]

const tabLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventar', icon: Package },
]

export function Navbar({ profile }: { profile: Profile }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Top navbar — hidden on mobile, visible md+ */}
      <nav className="border-b bg-white hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">Warenwirtschaft</span>
            <div className="flex gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    pathname.startsWith(link.href)
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {profile.role === 'admin' && (
                <>
                  {[
                    { href: '/admin/users', label: 'Benutzer' },
                    { href: '/admin/models', label: 'Modelle' },
                    { href: '/admin/suppliers', label: 'Lieferanten' },
                    { href: '/admin/customers', label: 'Kunden' },
                    { href: '/admin/purchases', label: 'Einkäufe' },
                    { href: '/admin/sales', label: 'Verkäufe' },
                  ].map(link => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        pathname.startsWith(link.href)
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{profile.full_name}</span>
            <Button variant="outline" size="sm" onClick={handleSignOut}>Abmelden</Button>
          </div>
        </div>
      </nav>

      {/* Mobile top bar — logo + sign out, visible only on mobile */}
      <nav className="border-b bg-white flex items-center justify-between px-4 h-14 md:hidden">
        <span className="font-semibold text-slate-900">Warenwirtschaft</span>
        <Button variant="outline" size="sm" onClick={handleSignOut}>Abmelden</Button>
      </nav>

      {/* Bottom tab bar — visible only on mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t md:hidden">
        <div className={cn('grid h-16', profile.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2')}>
          {tabLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                pathname.startsWith(href)
                  ? 'text-slate-900'
                  : 'text-slate-400'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
          {profile.role === 'admin' && (
            <Link
              href="/admin/users"
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs transition-colors',
                pathname.startsWith('/admin')
                  ? 'text-slate-900'
                  : 'text-slate-400'
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
