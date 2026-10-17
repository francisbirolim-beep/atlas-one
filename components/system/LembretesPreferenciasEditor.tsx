'use client'

import { useState } from 'react'
import { AVISOS_DISPONIVEIS, normalizarAntecedencias } from '@/lib/lembretesInteligentes'

type Props = {
  titulo: string
  descricao: string
  valores: number[]
  desabilitado?: boolean
  onAlterar: (minutos: number[]) => void
}

/** Edição de vários avisos com presets ou antecedência livre em minutos. */
export default function LembretesPreferenciasEditor({
  titulo, descricao, valores, desabilitado = false, onAlterar,
}: Props) {
  const [personalizado, setPersonalizado] = useState('')
  const atuais = normalizarAntecedencias(valores)

  function alternar(minutos: number) {
    onAlterar(normalizarAntecedencias(
      atuais.includes(minutos)
        ? atuais.filter(valor => valor !== minutos)
        : [...atuais, minutos],
    ))
  }

  function incluirPersonalizado() {
    const minutos = Number(personalizado)
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 43200) return
    onAlterar(normalizarAntecedencias([...atuais, minutos]))
    setPersonalizado('')
  }

  const conhecidos = new Set<number>(AVISOS_DISPONIVEIS.map(item => item.minutos))
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">{titulo}</h3>
      <p className="mt-1 text-xs text-slate-500">{descricao}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {AVISOS_DISPONIVEIS.map(item => {
          const ativo = atuais.includes(item.minutos)
          return (
            <button key={item.minutos} type="button" disabled={desabilitado}
              onClick={() => alternar(item.minutos)}
              aria-pressed={ativo}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${ativo
                ? 'border-blue-500 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'} disabled:opacity-50`}>
              {ativo ? '✓ ' : '+ '}{item.rotulo}
            </button>
          )
        })}
      </div>
      <label className="mt-4 block text-xs font-semibold text-slate-600">Outro intervalo (minutos antes)</label>
      <div className="mt-1 flex gap-2">
        <input type="number" min={1} max={43200} step={1} value={personalizado}
          onChange={evento => setPersonalizado(evento.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Ex.: 90" disabled={desabilitado}/>
        <button type="button" onClick={incluirPersonalizado} disabled={desabilitado || !personalizado}
          className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Adicionar</button>
      </div>
      {atuais.filter(minutos => !conhecidos.has(minutos)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {atuais.filter(minutos => !conhecidos.has(minutos)).map(minutos => (
            <button type="button" key={minutos} disabled={desabilitado} onClick={() => alternar(minutos)}
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
              {minutos} min antes ×
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">Até 10 avisos por compromisso. Desmarque para remover.</p>
    </section>
  )
}
