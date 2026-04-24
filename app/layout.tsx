import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'Kassen Buch · Warenwirtschaft',
  description: 'Firmen-Inventarverwaltung',
}

// Explicit viewport stops iOS Safari auto-zooming on input focus without
// restoring. `initialScale: 1` is the canonical baseline.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
