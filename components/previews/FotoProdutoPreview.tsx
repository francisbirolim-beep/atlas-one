'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, Eye, X } from 'lucide-react'

// Exibe imediatamente somente fotos vinculadas ao MESMO produto_id no cadastro.
// Fotos importadas não validadas recebem alerta, não são inventadas nem aprovadas no banco.
// Qualquer escolha ou confirmação nesta prévia é local, sem upload.
export default function FotoProdutoPreview({
  nome,fotoUrl,fotoCandidataUrl,tamanho='card',imagemLocal,onSelecionarImagem,
  candidataConfirmada=false,onConfirmarCandidata
}:{
  nome:string;fotoUrl?:string|null;fotoCandidataUrl?:string|null;
  tamanho?:'card'|'pequeno'|'detalhe';imagemLocal?:string|null;
  onSelecionarImagem?:(file:File|null)=>void;
  candidataConfirmada?:boolean;onConfirmarCandidata?:(confirmado:boolean)=>void
}){
  const id=useId()
  const [temporaria,setTemporaria]=useState<string|null>(null)
  const [falhou,setFalhou]=useState(false)
  const [erro,setErro]=useState('')
  const [conferindo,setConferindo]=useState(false)
  const [confirmadaLocal,setConfirmadaLocal]=useState(false)
  const [candidataFalhou,setCandidataFalhou]=useState(false)
  const localRef=useRef<string|null>(null)
  useEffect(()=>()=>{if(localRef.current)URL.revokeObjectURL(localRef.current)},[])
  const urlValida=(v?:string|null)=>!!v&&/^https:\/\//i.test(v)
  const confirmou=onConfirmarCandidata?candidataConfirmada:confirmadaLocal
  const candidata=urlValida(fotoCandidataUrl)&&!candidataFalhou?fotoCandidataUrl:null
  const fotoValidada=!falhou&&urlValida(fotoUrl)?fotoUrl:null
  const url=imagemLocal||temporaria||fotoValidada||candidata
  const imagemPendente=!!candidata&&!confirmou&&!imagemLocal&&!temporaria&&!fotoValidada
  const tamanhoClasse=tamanho==='detalhe'?'h-56 w-full':tamanho==='pequeno'?'h-16 w-16':'h-24 w-24 sm:h-28 sm:w-28'
  function escolher(arquivo?:File){
    if(!arquivo)return
    if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)){setErro('Escolha uma imagem JPG, PNG ou WebP.');return}
    if(arquivo.size>8*1024*1024){setErro('A imagem pode ter até 8 MB.');return}
    if(onSelecionarImagem){onSelecionarImagem(arquivo);setFalhou(false);setErro('');return}
    if(localRef.current)URL.revokeObjectURL(localRef.current)
    const url=URL.createObjectURL(arquivo);localRef.current=url
    setTemporaria(url);setFalhou(false);setErro('')
  }
  function confirmar(){
    if(onConfirmarCandidata)onConfirmarCandidata(true)
    else setConfirmadaLocal(true)
    setConferindo(false);setFalhou(false)
  }
  return <div className={'flex shrink-0 flex-col items-center justify-center gap-1.5 '+(tamanho==='detalhe'?'w-full':'')}>
    {url&&<div className={'grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white '+tamanhoClasse}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={'Imagem cadastrada para '+nome} className="h-full w-full object-contain p-1" loading="lazy" onError={()=>{if(url===candidata)setCandidataFalhou(true);else setFalhou(true)}}/>
    </div>}
    {imagemPendente&&<div className="flex max-w-full flex-col items-center gap-1">
      <span className="text-center text-[10px] font-semibold text-amber-800">Foto cadastrada · não validada</span>
      <button type="button" onClick={()=>setConferindo(true)} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-center text-[10px] font-bold text-amber-800 hover:bg-amber-100">
        <Eye size={13}/> Verificar correspondência
      </button>
    </div>}
    <label htmlFor={id} className="inline-flex max-w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-center text-[10px] font-bold text-blue-700 hover:bg-blue-100">
      <Camera size={13} className="shrink-0"/>{url?'Trocar foto':'Adicionar imagem correta'}
    </label>
    <input id={id} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
      aria-label={'Escolher foto correta de '+nome}
      onChange={e=>{escolher(e.target.files?.[0]);e.currentTarget.value=''}}/>
    {(imagemLocal||temporaria)&&<button type="button" className="text-[10px] text-slate-500" onClick={()=>{if(onSelecionarImagem)onSelecionarImagem(null);if(localRef.current)URL.revokeObjectURL(localRef.current);localRef.current=null;setTemporaria(null)}}>Desfazer escolha</button>}
    {(imagemLocal||temporaria||confirmou)&&<span className="text-center text-[10px] font-semibold text-amber-700">Confirmada só na prévia</span>}
    {erro&&<span role="alert" className="text-center text-[10px] text-red-600">{erro}</span>}
    {conferindo&&candidata&&<div role="dialog" aria-modal="true" aria-label={'Conferir a foto de '+nome} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onClick={()=>setConferindo(false)}>
      <div className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-black text-slate-900">Foto associada ao cadastro</h3><p className="mt-1 text-xs text-slate-600">{nome}</p></div><button type="button" className="rounded-lg p-2 hover:bg-slate-100" aria-label="Fechar" onClick={()=>setConferindo(false)}><X size={18}/></button></div>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Esta foto foi importada e ainda não foi validada. Confira visualmente se corresponde a este produto. Se estiver errada, não confirme.</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={candidata} alt={'Imagem importada a conferir: '+nome} className="mx-auto h-64 max-w-full object-contain" onError={()=>{setCandidataFalhou(true);setConferindo(false)}}/>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setConferindo(false)} className="rounded-xl border px-4 py-2.5 text-xs font-bold">Não corresponde / Voltar</button><button type="button" onClick={confirmar} className="rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-bold text-white">Esta é a foto correta</button></div>
        <p className="text-[11px] text-slate-500">Confirmação válida apenas nesta prévia; nenhuma foto será alterada no cadastro real.</p>
      </div>
    </div>}
  </div>
}
