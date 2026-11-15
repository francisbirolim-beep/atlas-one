'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

// Mostra apenas a imagem explicitamente vinculada/validada ao produto ou a foto
// que o usuário selecionou neste navegador. Nunca gera nem associa imagens sozinho.
// Prévia: nenhum arquivo é enviado para o servidor.
export default function FotoProdutoPreview({
  nome, fotoUrl, tamanho='card', imagemLocal, onSelecionarImagem
}:{
  nome:string; fotoUrl?:string|null; tamanho?:'card'|'pequeno'|'detalhe';
  imagemLocal?:string|null; onSelecionarImagem?:(file:File|null)=>void
}){
  const inputId=useId()
  const [temporaria,setTemporaria]=useState<string|null>(null)
  const [falhou,setFalhou]=useState(false)
  const [erro,setErro]=useState('')
  const localRef=useRef<string|null>(null)
  useEffect(()=>()=>{if(localRef.current)URL.revokeObjectURL(localRef.current)},[])
  const url=imagemLocal||temporaria||(!falhou&&fotoUrl&&/^https?:\/\//i.test(fotoUrl)?fotoUrl:null)
  const formato=tamanho==='detalhe'?'h-56 w-full':tamanho==='pequeno'?'h-16 w-16':'h-24 w-24 sm:h-28 sm:w-28'
  function escolher(arquivo?:File){
    if(!arquivo)return
    if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)){setErro('Selecione JPG, PNG ou WebP.');return}
    if(arquivo.size>8*1024*1024){setErro('Imagem de até 8 MB.');return}
    if(onSelecionarImagem){onSelecionarImagem(arquivo);setFalhou(false);setErro('');return}
    if(localRef.current)URL.revokeObjectURL(localRef.current)
    const proxima=URL.createObjectURL(arquivo)
    localRef.current=proxima
    setTemporaria(proxima);setFalhou(false);setErro('')
  }
  return <div className={'flex shrink-0 flex-col items-center justify-center gap-1.5 '+(tamanho==='detalhe'?'w-full':'')}>
    {url&&<div className={'grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white '+formato}>
      <img src={url} alt={'Imagem vinculada a '+nome} className="h-full w-full object-contain p-1" loading="lazy" onError={()=>{if(temporaria)setTemporaria(null);else setFalhou(true)}}/>
    </div>}
    <label htmlFor={inputId} className="flex max-w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-center text-[10px] font-bold leading-tight text-blue-700 hover:bg-blue-100">
      <Camera size={13} className="shrink-0"/>{url?'Trocar foto':'Adicionar imagem correta'}
    </label>
    <input id={inputId} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={e=>{escolher(e.target.files?.[0]);e.currentTarget.value=''}} aria-label={'Selecionar imagem correta de '+nome}/>
    {(imagemLocal||temporaria)&&<button type="button" onClick={()=>{if(onSelecionarImagem)onSelecionarImagem(null);if(localRef.current)URL.revokeObjectURL(localRef.current);localRef.current=null;setTemporaria(null)}} className="inline-flex items-center gap-1 text-[10px] text-slate-500"><X size={11}/> Desfazer escolha</button>}
    {(imagemLocal||temporaria)&&<span className="text-center text-[10px] font-semibold text-amber-700">Foto apenas nesta prévia</span>}
    {erro&&<span role="alert" className="text-center text-[10px] text-red-600">{erro}</span>}
  </div>
}
