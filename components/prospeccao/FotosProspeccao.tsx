'use client'

import { useEffect, useState } from 'react'
import { Camera, RefreshCw } from 'lucide-react'
import { anexarFotosProspeccao, listarFotosProspeccao, type FotoProspeccao } from '@/lib/prospeccaoFotos'

export default function FotosProspeccao({ id }: { id: string }) {
  const [fotos, setFotos] = useState<FotoProspeccao[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    try { setFotos(await listarFotosProspeccao(id)); setErro('') }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar as fotos.') }
    finally { setCarregando(false) }
  }
  useEffect(() => { void carregar() }, [id])

  async function enviar() {
    if (!arquivos.length) return
    setSalvando(true)
    setErro('')
    try {
      await anexarFotosProspeccao(id, arquivos)
      setArquivos([])
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível anexar as fotos.')
    } finally { setSalvando(false) }
  }

  return <section className="rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Camera size={18} className="text-blue-600"/><h2 className="font-bold">Fotos da visita</h2></div>
      <button type="button" onClick={()=>void carregar()} disabled={carregando||salvando} className="flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-bold"><RefreshCw size={13}/>Atualizar</button>
    </div>
    <p className="mt-1 text-xs text-slate-500">Fotos privadas da obra, acessíveis apenas aos usuários autorizados. JPG, PNG ou WebP, até 6 MB por foto.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="cursor-pointer rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700">
        Selecionar fotos
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="sr-only" onChange={e=>setArquivos(Array.from(e.target.files||[]))}/>
      </label>
      {arquivos.length>0&&<span className="text-xs text-slate-600">{arquivos.length} foto(s) selecionada(s)</span>}
      <button type="button" onClick={()=>void enviar()} disabled={!arquivos.length||salvando} className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{salvando?'Enviando...':'Anexar fotos'}</button>
    </div>
    {erro&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700">{erro}</p>}
    {carregando?<p className="mt-4 text-xs text-slate-500">Carregando fotos...</p>:<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {fotos.map(foto=><a href={foto.url} target="_blank" rel="noreferrer" key={foto.nome} title="Abrir foto em tamanho maior" className="block overflow-hidden rounded-xl border"><img src={foto.url} alt="Foto da obra prospectada" className="aspect-square w-full object-cover" loading="lazy"/></a>)}
      {!fotos.length&&<p className="col-span-full rounded-xl border border-dashed p-5 text-center text-xs text-slate-500">Nenhuma foto adicionada.</p>}
    </div>}
  </section>
}
