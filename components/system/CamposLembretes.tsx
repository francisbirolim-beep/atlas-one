'use client'

import { useState } from 'react'
import { BellRing, Plus, X } from 'lucide-react'

const OPCOES = [
  { minutos: 10, titulo: '10 min' },
  { minutos: 15, titulo: '15 min' },
  { minutos: 30, titulo: '30 min' },
  { minutos: 60, titulo: '1 hora' },
  { minutos: 120, titulo: '2 horas' },
  { minutos: 1440, titulo: '1 dia' },
  { minutos: 2880, titulo: '2 dias' },
  { minutos: 10080, titulo: '7 dias' },
]
const REPETICOES = [
  { minutos: 0, titulo: 'Não repetir' },
  { minutos: 15, titulo: '15 minutos' },
  { minutos: 30, titulo: '30 minutos' },
  { minutos: 60, titulo: '1 hora' },
  { minutos: 120, titulo: '2 horas' },
  { minutos: 360, titulo: '6 horas' },
  { minutos: 1440, titulo: '1 dia' },
]

export function formatarAntecedencia(minutos: number) {
  return minutos % 1440 === 0 && minutos >= 1440
    ? `${minutos / 1440} dia(s)`
    : minutos % 60 === 0 && minutos >= 60
      ? `${minutos / 60} hora(s)`
      : `${minutos} minuto(s)`
}
export function normalizarAvisos(valores: number[]): number[] {
  return [...new Set(valores.map(Number).filter(v => Number.isInteger(v) && v >= 0 && v <= 43200))]
    .sort((a, b) => b - a).slice(0, 10)
}

type Props = {
  titulo: string
  descricao?: string
  valores: number[]
  repeticao: number
  onChange: (avisos: number[]) => void
  onRepeticao: (minutos: number) => void
  disabled?: boolean
}
export default function CamposLembretes({
  titulo, descricao, valores, repeticao, onChange, onRepeticao, disabled = false,
}: Props) {
  const [personalizado, setPersonalizado] = useState('')
  const valoresSeguros = normalizarAvisos(valores)
  function alternar(minutos: number) {
    onChange(normalizarAvisos(valoresSeguros.includes(minutos)
      ? valoresSeguros.filter(v => v !== minutos)
      : [...valoresSeguros, minutos]))
  }
  function adicionarPersonalizado() {
    const minutos = Number(personalizado)
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 43200) return
    onChange(normalizarAvisos([...valoresSeguros, minutos]))
    setPersonalizado('')
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <BellRing size={15} className="text-blue-600"/>
        <div><p className="text-sm font-bold text-slate-800">{titulo}</p>
          {descricao && <p className="text-xs text-slate-500">{descricao}</p>}</div>
      </div>
      <p className="mb-2 text-xs font-semibold text-slate-600">Avisar antes do horário (permite vários)</p>
      <div className="flex flex-wrap gap-1.5">
        {OPCOES.map(op => (
          <button key={op.minutos} type="button" disabled={disabled}
            onClick={() => alternar(op.minutos)}
            aria-pressed={valoresSeguros.includes(op.minutos)}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold disabled:opacity-60 ${valoresSeguros.includes(op.minutos)
              ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
            {op.titulo}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="number" min={1} max={43200} value={personalizado}
          onChange={e=>setPersonalizado(e.target.value)} disabled={disabled}
          aria-label="Minutos personalizados" placeholder="Outros minutos"
          className="w-36 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"/>
        <button type="button" disabled={disabled || !personalizado} onClick={adicionarPersonalizado}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs text-blue-700">
          <Plus size={12}/> Adicionar aviso
        </button>
      </div>
      {valoresSeguros.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
        {valoresSeguros.filter(v => !OPCOES.some(op => op.minutos === v)).map(v =>
          <button type="button" key={v} disabled={disabled} onClick={()=>alternar(v)}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
            {formatarAntecedencia(v)} <X size={12}/>
          </button>)}
      </div>}
      {valoresSeguros.length === 0 && <p className="mt-2 text-xs text-amber-700">Sem aviso antecipado para este item.</p>}
      <label className="mt-3 block text-xs font-semibold text-slate-600">Enquanto estiver pendente, repetir a cada</label>
      <select value={repeticao} disabled={disabled} onChange={e=>onRepeticao(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700">
        {REPETICOES.map(op => <option key={op.minutos} value={op.minutos}>{op.titulo}</option>)}
      </select>
    </div>
  )
}
