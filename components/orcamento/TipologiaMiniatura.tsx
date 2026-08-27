'use client'

type Props = {
  nome: string
  className?: string
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function TipologiaMiniatura({ nome, className = '' }: Props) {
  const n = normalizar(nome)
  const ripado = n.includes('ripado') || n.includes('lambri')
  const fachada = n.includes('fachada') || n.includes('pele de vidro') || n.includes('glazing')
  const guarda = n.includes('guarda')
  const box = n.includes('box')
  const maxim = n.includes('maxim') || n.includes('max-ar') || n.includes('max ar')
  const porta = n.includes('porta')
  const correr = n.includes('correr')
  const folhas = Math.max(2, Math.min(4, Number((n.match(/(\d+)\s*folh/) || [])[1] || (correr ? 2 : 1)))

  if (ripado) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 ${className}`}>
        <svg viewBox="0 0 240 150" className="h-full w-full" aria-label={nome}>
          <rect x="18" y="18" width="204" height="114" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
          {Array.from({ length: 15 }).map((_, i) => (
            <rect key={i} x={28 + i * 12.4} y="28" width="6" height="94" rx="2" fill={i % 2 ? '#92400e' : '#b45309'} opacity="0.9" />
          ))}
        </svg>
      </div>
    )
  }

  if (fachada) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 ${className}`}>
        <svg viewBox="0 0 240 150" className="h-full w-full" aria-label={nome}>
          <rect x="25" y="16" width="190" height="118" rx="3" fill="#dbeafe" stroke="#475569" strokeWidth="3" />
          {[63, 101, 139, 177].map(x => <line key={x} x1={x} y1="16" x2={x} y2="134" stroke="#64748b" strokeWidth="3" />)}
          {[55, 94].map(y => <line key={y} x1="25" y1={y} x2="215" y2={y} stroke="#64748b" strokeWidth="3" />)}
          <path d="M28 22 L92 22 L28 70 Z" fill="#ffffff" opacity="0.45" />
        </svg>
      </div>
    )
  }

  if (guarda) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-cyan-50 ${className}`}>
        <svg viewBox="0 0 240 150" className="h-full w-full" aria-label={nome}>
          <line x1="28" y1="38" x2="212" y2="38" stroke="#334155" strokeWidth="6" />
          {[35, 82, 129, 176, 205].map(x => <line key={x} x1={x} y1="38" x2={x} y2="122" stroke="#475569" strokeWidth="4" />)}
          <rect x="38" y="48" width="158" height="64" fill="#cffafe" stroke="#94a3b8" strokeWidth="2" opacity="0.85" />
          <line x1="20" y1="124" x2="220" y2="124" stroke="#94a3b8" strokeWidth="3" />
        </svg>
      </div>
    )
  }

  if (box) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-50 to-slate-100 ${className}`}>
        <svg viewBox="0 0 240 150" className="h-full w-full" aria-label={nome}>
          <rect x="48" y="18" width="144" height="115" fill="#e0f2fe" stroke="#475569" strokeWidth="3" />
          <line x1="120" y1="18" x2="120" y2="133" stroke="#475569" strokeWidth="3" />
          <circle cx="111" cy="77" r="4" fill="#334155" />
          <circle cx="129" cy="77" r="4" fill="#334155" />
        </svg>
      </div>
    )
  }

  if (maxim) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 ${className}`}>
        <svg viewBox="0 0 240 150" className="h-full w-full" aria-label={nome}>
          <rect x="45" y="24" width="150" height="102" fill="#dbeafe" stroke="#334155" strokeWidth="4" />
          <path d="M55 35 L185 35 L170 105 L70 105 Z" fill="#bfdbfe" stroke="#64748b" strokeWidth="3" />
          <line x1="70" y1="105" x2="55" y2="116" stroke="#64748b" strokeWidth="3" />
          <line x1="170" y1="105" x2="185" y2="116" stroke="#64748b" strokeWidth="3" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 ${className}`}>
      <svg viewBox="0 0 240 150" className="h-full w-full" aria-label={nome}>
        <rect x="32" y="16" width="176" height="118" rx="3" fill="#eff6ff" stroke="#334155" strokeWidth="4" />
        {Array.from({ length: folhas - 1 }).map((_, i) => {
          const x = 32 + (176 / folhas) * (i + 1)
          return <line key={i} x1={x} y1="16" x2={x} y2="134" stroke="#475569" strokeWidth="3" />
        })}
        {correr && Array.from({ length: folhas }).map((_, i) => {
          const x = 32 + (176 / folhas) * i + 10
          const w = 176 / folhas - 20
          return <path key={i} d={`M${x} 74 H${x + w}`} stroke="#2563eb" strokeWidth="2" strokeDasharray="5 4" />
        })}
        {porta ? (
          <line x1="32" y1="116" x2="208" y2="116" stroke="#64748b" strokeWidth="3" />
        ) : (
          <line x1="32" y1="75" x2="208" y2="75" stroke="#94a3b8" strokeWidth="2" opacity="0.6" />
        )}
        <path d="M40 25 L96 25 L40 65 Z" fill="#ffffff" opacity="0.55" />
      </svg>
    </div>
  )
}
