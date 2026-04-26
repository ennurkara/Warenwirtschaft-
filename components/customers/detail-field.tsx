import * as React from 'react'

interface DetailFieldProps {
  label: string
  value: React.ReactNode
  mono?: boolean
}

export function DetailField({ label, value, mono }: DetailFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="kb-label">{label}</span>
      <span className={`text-[13.5px] text-[var(--ink)] ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  )
}
