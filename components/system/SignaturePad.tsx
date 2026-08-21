'use client'

import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function SignaturePad({ label, value, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const desenhando = useRef(false)
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null)
  const [temAssinatura, setTemAssinatura] = useState(Boolean(value))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (!value) {
      setTemAssinatura(false)
      return
    }

    const imagem = new Image()
    imagem.onload = () => {
      ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height)
      setTemAssinatura(true)
    }
    imagem.src = value
  }, [value])

  function pontoDoEvento(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function iniciar(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    desenhando.current = true
    ultimoPonto.current = pontoDoEvento(event)
    canvas.setPointerCapture(event.pointerId)
  }

  function mover(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !ultimoPonto.current) return

    const atual = pontoDoEvento(event)
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(ultimoPonto.current.x, ultimoPonto.current.y)
    ctx.lineTo(atual.x, atual.y)
    ctx.stroke()
    ultimoPonto.current = atual
    setTemAssinatura(true)
  }

  function finalizar(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return
    desenhando.current = false
    ultimoPonto.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    try { canvas.releasePointerCapture(event.pointerId) } catch {}
    onChange(canvas.toDataURL('image/png'))
  }

  function limpar() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
    onChange('')
  }

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</p>
          <p className="text-[11px] text-slate-400">Assine com o dedo ou com o mouse dentro do quadro.</p>
        </div>
        <button type="button" onClick={limpar} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50">
          <Eraser size={13} /> Limpar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={240}
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={finalizar}
        onPointerCancel={finalizar}
        className="h-36 w-full touch-none rounded-xl border-2 border-slate-400 bg-white"
        aria-label={label}
      />
      <p className={`mt-2 text-[11px] font-medium ${temAssinatura ? 'text-emerald-600' : 'text-amber-600'}`}>
        {temAssinatura ? 'Assinatura registrada.' : 'Assinatura pendente.'}
      </p>
    </div>
  )
}
