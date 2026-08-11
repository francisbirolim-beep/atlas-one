import { ReactNode } from 'react'

export default function SystemCard({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${padded ? 'p-5' : ''} ${className}`}
    >
      {children}
    </section>
  )
}
