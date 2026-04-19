'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageCircle } from 'lucide-react'

export function ChatFab() {
  return (
    <Link href="/chat" className="fixed bottom-6 right-6 z-50">
      <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
        <MessageCircle className="h-6 w-6" />
      </Button>
    </Link>
  )
}