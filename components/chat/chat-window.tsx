'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

const STARTER_QUESTIONS = [
  'Wie viele Geräte haben wir insgesamt?',
  'Welche Geräte sind im Lager?',
  'Zeig mir alle defekten Geräte.',
  'Was wurde diese Woche entnommen?',
]

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Hallo! Ich bin dein Lager-Assistent. Was möchtest du über dein Inventar wissen?' },
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
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Keine Antwort erhalten.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Fehler beim Verbinden mit dem Assistenten.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] border rounded-lg bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
            )}
            <div className={cn(
              'max-w-[75%] rounded-2xl px-4 py-2 text-sm',
              msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'
            )}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="h-8 w-8 rounded-full bg-slate-900 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-slate-100 rounded-2xl px-4 py-2 text-sm text-slate-500">Denkt nach...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-3 space-y-2">
        <div className="flex flex-wrap gap-1">
          {STARTER_QUESTIONS.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs border rounded-full px-3 py-1 hover:bg-slate-50 text-slate-600 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={e => { e.preventDefault(); sendMessage(input) }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Frage stellen..."
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