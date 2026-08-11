export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger'

const classes: Record<StatusTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
}

export default function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: StatusTone
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${classes[tone]}`}>
      {children}
    </span>
  )
}
