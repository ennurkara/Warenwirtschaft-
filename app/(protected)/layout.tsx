import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav, MobileBottomNav } from '@/components/layout/mobile-nav'
import { TopBar } from '@/components/layout/topbar'
import { ChatFab } from '@/components/layout/chat-fab'
import type { Profile } from '@/lib/types'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  /*
   * Layout-Struktur:
   * - Outer: exakt 100dvh hoch, kein Body-Scroll → URL-bar bleibt sichtbar.
   * - Sidebar (md+) links als Flex-Item mit voller Höhe.
   * - Inner column: flex-col, voller Höhe.
   *   - MobileTopBar (md:hidden, shrink-0)
   *   - DesktopTopBar (hidden md:flex)
   *   - main (flex-1, overflow-y-auto) — scrollt INTERN, nicht der Body
   *   - MobileBottomNav (md:hidden, shrink-0) — regulärer Flex-Child,
   *     daher kein fixed-Voodoo nötig und auf iOS Safari kugelsicher.
   */
  return (
    <div
      className="bg-[var(--paper-2)] md:flex"
      style={{ height: '100dvh', overflow: 'hidden' }}
    >
      <Sidebar profile={profile as Profile} />
      <div className="flex flex-col flex-1 min-w-0 h-full">
        <MobileNav profile={profile as Profile} />
        <TopBar />
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 py-6 kb-scroll"
          style={{
            // iOS: smooth Inertia-Scrolling im internen Scroll-Container
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain',
          }}
        >
          {children}
        </main>
        <MobileBottomNav profile={profile as Profile} />
      </div>
      <div className="hidden md:block">
        <ChatFab role={(profile.role ?? 'mitarbeiter') as 'admin' | 'mitarbeiter' | 'techniker' | 'viewer'} />
      </div>
    </div>
  )
}
