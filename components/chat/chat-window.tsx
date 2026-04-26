'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

type Role = 'admin' | 'mitarbeiter' | 'techniker' | 'viewer'

const STARTERS_BY_ROLE: Record<Role, string[]> = {
  admin: [
    'Wie viele Geräte sind im Lager und was ist der Bestandswert?',
    'Welche TSE läuft als nächstes ab?',
    'Was kostet eine APRO. Kasse 9 im VK?',
    'Wie viele Arbeitsberichte wurden diese Woche abgeschlossen?',
    'Wie lege ich einen neuen Apro-Kunden an?',
  ],
  mitarbeiter: [
    'Welche TSE läuft in den nächsten 60 Tagen ab?',
    'Welche Geräte sind unvollständig (kein EK)?',
    'Wie erfasse ich Bestand für Bonrollen?',
    'Was kostet eine Apro Kasse 10 Lizenz?',
    'Welche Berichte wurden heute abgeschlossen?',
  ],
  techniker: [
    'Wie viele Berichte hab ich diese Woche?',
    'Wie installiere ich eine TSE in eine Kasse?',
    'Welche Aktion soll ich für eine neue Kasse wählen — Leihe oder Installation?',
    'Welche meiner letzten Kunden hatte einen Austausch?',
    'Was bedeutet rote Ampel bei einer TSE?',
  ],
  viewer: [
    'Welche TSE läuft als nächstes ab?',
    'Wie viele Vectron-Kunden gibt es?',
    'Wo finde ich die Kundenkartei?',
    'Welche Apro-Lizenzen kostet was?',
  ],
}

const GREETING = 'Hallo! Frag mich zu Daten (Kunden, Geräte, Lizenzen, TSE) oder zur Bedienung. Ich nutze nur das, was du laut Rolle sehen darfst.'

interface ChatWindowProps {
  role: Role
}

export function ChatWindow({ role }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: GREETING },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return
    const userMessage: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      // Geschichte mitsenden (ohne den Greeter), damit der Bot Folgefragen versteht
      const history = newMessages.slice(1, -1).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? data.error ?? 'Keine Antwort erhalten.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Fehler beim Verbinden mit dem Assistenten.' }])
    } finally {
      setIsLoading(false)
    }
  }

  const starters = STARTERS_BY_ROLE[role] ?? STARTERS_BY_ROLE.mitarbeiter

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] rounded-kb border border-[var(--rule)] bg-white shadow-xs overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-[var(--paper-2)] flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-[var(--ink-2)]" />
              </div>
            )}
            <div className={cn(
              'max-w-[78%] rounded-2xl px-4 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed',
              msg.role === 'user'
                ? 'bg-[var(--ink)] text-white'
                : 'bg-[var(--paper-2)] text-[var(--ink)]'
            )}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-[var(--ink)] flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-[var(--paper-2)] flex items-center justify-center">
              <Bot className="h-4 w-4 text-[var(--ink-3)]" />
            </div>
            <div className="bg-[var(--paper-2)] rounded-2xl px-4 py-2.5 text-[13px] text-[var(--ink-3)]">
              denkt nach…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-[var(--rule-soft)] p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {starters.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="text-[11.5px] border border-[var(--rule)] rounded-full px-3 py-1 hover:bg-[var(--paper-2)] text-[var(--ink-3)] hover:text-[var(--ink-2)] transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Frage stellen…"
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
