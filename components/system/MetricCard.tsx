import { LucideIcon } from 'lucide-react'
import SystemCard from './SystemCard'

export default function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string
  value: string | number
  helper?: string
  icon?: LucideIcon
}) {
  return (
    <SystemCard className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
        </div>
        {Icon && (
          <div className="rounded-xl bg-slate-100 p-2.5 text-slate-600">
            <Icon size={18} />
          </div>
        )}
      </div>
    </SystemCard>
  )
}
