import { createClient } from '@/lib/supabase/server'
import { ChatWindow } from '@/components/chat/chat-window'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user!.id)
    .single()

  const role = (profile?.role ?? 'mitarbeiter') as 'admin' | 'mitarbeiter' | 'techniker' | 'viewer'

  return (
    <div className="max-w-[1100px] mx-auto space-y-[18px]">
      <div className="flex flex-col gap-2 pb-4 mb-1 border-b border-[var(--rule-soft)]">
        <div className="kb-label">Hilfe</div>
        <h1 className="kb-h1">Kassen Buch Assistent</h1>
        <p className="text-[13px] text-[var(--ink-3)]">
          Frag den Assistenten zu Daten (Kunden, Geräte, Lizenzen, TSE-Ablauf, Berichte)
          oder zur Bedienung der Warenwirtschaft + Arbeitsbericht. Antworten basieren auf
          dem, was du laut Rolle <span className="font-medium">{profile?.role}</span> sehen darfst.
        </p>
      </div>
      <div className="h-[calc(100vh-14rem)]">
        <ChatWindow role={role} />
      </div>
    </div>
  )
}
