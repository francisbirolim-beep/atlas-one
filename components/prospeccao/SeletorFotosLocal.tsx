'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Images, X } from 'lucide-react'
import { LIMITE_FOTOS_POR_ENVIO, validarFotoLocal } from '@/lib/prospeccaoFotos'

interface Props {
  arquivos: File[]
  onChange: (arquivos: File[]) => void
  onAviso: (texto: string) => void
  disabled?: boolean
}

export default function SeletorFotosLocal({ arquivos, onChange, onAviso, disabled = false }: Props) {
  const camera = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [miniaturas, setMiniaturas] = useState<string[]>([])

  useEffect(() => {
    const urls = arquivos.map(arquivo => URL.createObjectURL(arquivo))
    setMiniaturas(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [arquivos])

  function selecionar(evento: React.ChangeEvent<HTMLInputElement>) {
    const escolhidas = Array.from(evento.target.files || [])
    evento.target.value = ''
    if (!escolhidas.length) return

    const vagas = LIMITE_FOTOS_POR_ENVIO - arquivos.length
    if (vagas <= 0) {
      onAviso(`Envie até ${LIMITE_FOTOS_POR_ENVIO} fotos por vez. Depois poderá adicionar outras.`)
      return
    }

    const aceitas: File[] = []
    let aviso = ''
    for (const arquivo of escolhidas.slice(0, vagas)) {
      const erro = validarFotoLocal(arquivo)
      if (erro) aviso = `${arquivo.name}: ${erro}`
      else aceitas.push(arquivo)
    }
    if (escolhidas.length > vagas) aviso = `Limite de ${LIMITE_FOTOS_POR_ENVIO} fotos por envio. As demais não foram selecionadas.`
    if (aceitas.length) onChange([...arquivos, ...aceitas])
    onAviso(aviso)
  }

  function remover(indice: number) {
    onChange(arquivos.filter((_, i) => i !== indice))
    onAviso('')
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={disabled} onClick={() => camera.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        <Camera size={17}/> Tirar foto
      </button>
      <button type="button" disabled={disabled} onClick={() => galeria.current?.click()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">
        <Images size={17}/> Escolher da galeria
      </button>
    </div>
    <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={selecionar} aria-label="Tirar foto da obra"/>
    <input ref={galeria} type="file" accept="image/*" multiple className="hidden" onChange={selecionar} aria-label="Selecionar fotos da galeria"/>
    <p className="text-xs text-slate-500">Até {LIMITE_FOTOS_POR_ENVIO} fotos por envio, 10 MB cada. As imagens ficarão vinculadas à obra.</p>
    {arquivos.length > 0 && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {arquivos.map((arquivo, indice) => <div key={miniaturas[indice] || `${arquivo.name}-${indice}`} className="relative aspect-square overflow-hidden rounded-xl border bg-slate-100">
        {miniaturas[indice] ? <img src={miniaturas[indice]} alt={`Foto selecionada: ${arquivo.name}`} className="h-full w-full object-cover"/> : <div className="p-2 text-xs">{arquivo.name}</div>}
        <button type="button" disabled={disabled} onClick={() => remover(indice)} title="Remover foto" aria-label={`Remover ${arquivo.name}`} className="absolute right-1 top-1 rounded-full bg-slate-900/80 p-1.5 text-white disabled:opacity-50"><X size={13}/></button>
      </div>)}
    </div>}
  </div>
}
