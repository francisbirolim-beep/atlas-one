'use client'

type Props = {
  label: string
  className?: string
}

function normalizar(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function quantidadeFolhas(label: string) {
  const match = normalizar(label).match(/\b0?(\d{1,2})\s*folh/)
  const numero = match ? Number(match[1]) : 1
  return Math.min(9, Math.max(1, Number.isFinite(numero) ? numero : 1))
}

function Seta({ cx, cy, direcao }: { cx: number; cy: number; direcao: 'esq' | 'dir' }) {
  const inicio = direcao === 'dir' ? cx - 8 : cx + 8
  const fim = direcao === 'dir' ? cx + 8 : cx - 8
  const ponta = direcao === 'dir' ? 1 : -1
  return (
    <g stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1={inicio} y1={cy} x2={fim} y2={cy} />
      <path d={`M ${fim - 5 * ponta} ${cy - 4} L ${fim} ${cy} L ${fim - 5 * ponta} ${cy + 4}`} />
    </g>
  )
}

export default function TipologiaMiniatura({ label, className = '' }: Props) {
  const texto = normalizar(label)
  const folhas = quantidadeFolhas(label)
  const porta = texto.includes('porta') || texto.includes('portinhola')
  const correr = texto.includes('correr')
  const maxim = texto.includes('maxim')
  const basculante = texto.includes('basculante')
  const guilhotina = texto.includes('guilhotina')
  const pivotante = texto.includes('pivotante')
  const giro = texto.includes('giro') || texto.includes('vai e vem')
  const camarao = texto.includes('camarao')
  const fixo = texto.includes('fixo') || texto.includes('modulo fixo')

  const x = 18
  const y = porta ? 8 : 22
  const largura = 124
  const altura = porta ? 100 : 76
  const centroY = y + altura / 2

  return (
    <div className={`flex h-full w-full flex-col items-center justify-center gap-1 px-2 py-2 text-slate-500 ${className}`}>
      <svg
        viewBox="0 0 160 120"
        className="h-full max-h-[108px] w-full"
        role="img"
        aria-label={`Esquema visual de ${label}`}
      >
        <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x={x} y={y} width={largura} height={altura} rx="2" strokeWidth="2.4" />
          <rect x={x + 4} y={y + 4} width={largura - 8} height={altura - 8} rx="1" strokeWidth="1" opacity="0.45" />

          {correr && Array.from({ length: folhas }).map((_, i) => {
            const fw = largura / folhas
            const fx = x + i * fw
            const cx = fx + fw / 2
            return (
              <g key={i}>
                {i > 0 && <line x1={fx} y1={y + 2} x2={fx} y2={y + altura - 2} strokeWidth="1.5" />}
                <rect x={fx + 4} y={y + 7} width={Math.max(5, fw - 8)} height={altura - 14} rx="1" strokeWidth="1" opacity="0.6" />
                <Seta cx={cx} cy={centroY} direcao={i % 2 === 0 ? 'dir' : 'esq'} />
              </g>
            )
          })}

          {!correr && maxim && (
            <g>
              <rect x={x + 10} y={y + 8} width={largura - 20} height={altura - 18} strokeWidth="1.5" />
              <path d={`M ${x + 10} ${y + 8} L ${x + largura / 2} ${y + altura - 10} L ${x + largura - 10} ${y + 8}`} strokeWidth="1.5" />
              <path d={`M ${x + largura / 2 - 7} ${y + 14} L ${x + largura / 2} ${y + 8} L ${x + largura / 2 + 7} ${y + 14}`} strokeWidth="1.5" />
            </g>
          )}

          {!correr && basculante && (
            <g>
              <rect x={x + 10} y={y + 8} width={largura - 20} height={altura - 16} strokeWidth="1.5" />
              <line x1={x + 10} y1={centroY} x2={x + largura - 10} y2={centroY} strokeWidth="1.3" />
              <path d={`M ${x + 18} ${centroY - 6} L ${x + largura / 2} ${centroY + 12} L ${x + largura - 18} ${centroY - 6}`} strokeWidth="1.5" />
            </g>
          )}

          {!correr && guilhotina && (
            <g>
              <line x1={x + 2} y1={centroY} x2={x + largura - 2} y2={centroY} strokeWidth="1.8" />
              <rect x={x + 7} y={y + 7} width={largura - 14} height={altura / 2 - 10} strokeWidth="1" opacity="0.6" />
              <rect x={x + 7} y={centroY + 3} width={largura - 14} height={altura / 2 - 10} strokeWidth="1" opacity="0.6" />
              <path d={`M ${x + largura / 2 - 5} ${centroY + 12} L ${x + largura / 2} ${centroY + 5} L ${x + largura / 2 + 5} ${centroY + 12}`} strokeWidth="1.5" />
            </g>
          )}

          {!correr && pivotante && (
            <g>
              <line x1={x + largura / 2} y1={y + 4} x2={x + largura / 2} y2={y + altura - 4} strokeWidth="1.4" strokeDasharray="4 3" />
              <path d={`M ${x + largura / 2} ${y + 8} L ${x + largura - 18} ${y + 18} L ${x + largura - 18} ${y + altura - 18} L ${x + largura / 2} ${y + altura - 8} Z`} strokeWidth="1.8" />
              <circle cx={x + largura / 2} cy={centroY} r="2.5" fill="currentColor" stroke="none" />
            </g>
          )}

          {!correr && giro && !pivotante && (
            <g>
              {Array.from({ length: Math.min(folhas, 2) }).map((_, i) => {
                const divisor = Math.min(folhas, 2)
                const fw = largura / divisor
                const fx = x + i * fw
                const dobrarDireita = i % 2 === 0
                return (
                  <g key={i}>
                    {i > 0 && <line x1={fx} y1={y + 2} x2={fx} y2={y + altura - 2} strokeWidth="1.4" />}
                    <line
                      x1={dobrarDireita ? fx + 4 : fx + fw - 4}
                      y1={y + 5}
                      x2={fx + fw / 2}
                      y2={centroY}
                      strokeWidth="1.6"
                    />
                    <line
                      x1={dobrarDireita ? fx + 4 : fx + fw - 4}
                      y1={y + altura - 5}
                      x2={fx + fw / 2}
                      y2={centroY}
                      strokeWidth="1.6"
                    />
                  </g>
                )
              })}
            </g>
          )}

          {!correr && camarao && !giro && (
            <polyline
              points={`${x + 8},${y + altura - 8} ${x + 32},${y + 12} ${x + 56},${y + altura - 8} ${x + 80},${y + 12} ${x + 104},${y + altura - 8} ${x + largura - 8},${y + 12}`}
              strokeWidth="1.7"
            />
          )}

          {!correr && fixo && !maxim && !basculante && !guilhotina && !pivotante && !giro && !camarao && (
            <g opacity="0.7">
              <line x1={x + 8} y1={y + 8} x2={x + largura - 8} y2={y + altura - 8} strokeWidth="1" />
              <line x1={x + largura - 8} y1={y + 8} x2={x + 8} y2={y + altura - 8} strokeWidth="1" />
            </g>
          )}

          {!correr && !maxim && !basculante && !guilhotina && !pivotante && !giro && !camarao && !fixo && (
            <g>
              {Array.from({ length: folhas }).map((_, i) => {
                if (i === 0) return null
                const fx = x + (largura / folhas) * i
                return <line key={i} x1={fx} y1={y + 2} x2={fx} y2={y + altura - 2} strokeWidth="1.3" />
              })}
            </g>
          )}
        </g>
      </svg>
      <span className="text-[9px] font-medium text-slate-400">Esquema Atlas automático</span>
    </div>
  )
}
