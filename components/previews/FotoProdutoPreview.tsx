'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Camera, RotateCcw, Trash2 } from 'lucide-react'

// As fotos são lidas EXCLUSIVAMENTE do cadastro do próprio produto, jamais geradas.
// Nesta prévia, remover e substituir uma foto altera apenas a tela/sessão.
export default function FotoProdutoPreview({
  nome,fotoUrl,fotoCandidataUrl,tamanho='card',imagemLocal,onSelecionarImagem,
  oculta=false,onOcultarFoto,
}:{
  nome:string;fotoUrl?:string|null;fotoCandidataUrl?:string|null;
  tamanho?:'card'|'pequeno'|'detalhe';imagemLocal?:string|null;
  onSelecionarImagem?:(file:File|null)=>void;
  oculta?:boolean;onOcultarFoto?:(oculta:boolean)=>void;
  // Compatibilidade com outras prévias: não é mais preciso validar para exibir.
  candidataConfirmada?:boolean;onConfirmarCandidata?:(confirmado:boolean)=>void;
}){
  const id=useId()
  const [temporaria,setTemporaria]=useState<string|null>(null)
  const [ocultaLocal,setOcultaLocal]=useState(false)
  const [falhou,setFalhou]=useState(false)
  const [erro,setErro]=useState('')
  const localRef=useRef<string|null>(null)
  useEffect(()=>()=>{if(localRef.current)URL.revokeObjectURL(localRef.current)},[])
  useEffect(()=>{setFalhou(false)},[fotoUrl,fotoCandidataUrl,imagemLocal])
  const imagemRegistrada=(fotoUrl&&/^https:\/\//i.test(fotoUrl)?fotoUrl:null)||
    (fotoCandidataUrl&&/^https:\/\//i.test(fotoCandidataUrl)?fotoCandidataUrl:null)
  const imagemEscondida=onOcultarFoto?oculta:ocultaLocal
  const url=temporaria||imagemLocal||(!imagemEscondida&&!falhou?imagemRegistrada:null)
  const tamanhoClasse=tamanho==='detalhe'?'h-56 w-full':tamanho==='pequeno'?'h-16 w-16':'h-24 w-24 sm:h-28 sm:w-28'
  function mudarOcultacao(valor:boolean){
    if(onOcultarFoto)onOcultarFoto(valor);else setOcultaLocal(valor)
  }
  function escolher(arquivo?:File){
    if(!arquivo)return
    if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)){setErro('Selecione JPG, PNG ou WebP.');return}
    if(arquivo.size>8*1024*1024){setErro('A imagem deve ter até 8 MB.');return}
    if(onSelecionarImagem){
      onSelecionarImagem(arquivo)
    }else{
      if(localRef.current)URL.revokeObjectURL(localRef.current)
      const proxima=URL.createObjectURL(arquivo)
      localRef.current=proxima
      setTemporaria(proxima)
    }
    mudarOcultacao(false);setFalhou(false);setErro('')
  }
  function remover(){
    if(onSelecionarImagem)onSelecionarImagem(null)
    if(localRef.current)URL.revokeObjectURL(localRef.current)
    localRef.current=null
    setTemporaria(null)
    mudarOcultacao(true)
  }
  return <div className={'flex shrink-0 flex-col items-center justify-center gap-1.5 '+(tamanho==='detalhe'?'w-full':'')}>
    {url&&<div className={'grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white '+tamanhoClasse}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={'Imagem cadastrada: '+nome} className="h-full w-full object-contain p-1" loading="lazy" onError={()=>setFalhou(true)}/>
    </div>}
    <label htmlFor={id} className="inline-flex max-w-full cursor-pointer items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-center text-[10px] font-bold text-blue-700 hover:bg-blue-100">
      <Camera size={13} className="shrink-0"/>{url?'Trocar imagem':'Adicionar imagem correta'}
    </label>
    <input id={id} type="file" className="sr-only" accept="image/jpeg,image/png,image/webp"
      aria-label={'Escolher imagem correta de '+nome} onChange={e=>{escolher(e.target.files?.[0]);e.currentTarget.value=''}}/>
    {url&&<button type="button" onClick={remover} className="inline-flex max-w-full items-center gap-1 text-center text-[10px] font-semibold text-red-700 hover:underline"><Trash2 size={12}/> Remover imagem</button>}
    {imagemEscondida&&imagemRegistrada&&<button type="button" onClick={()=>mudarOcultacao(false)} className="inline-flex max-w-full items-center gap-1 text-center text-[10px] font-semibold text-slate-600 hover:underline"><RotateCcw size={12}/> Restaurar imagem</button>}
    {(imagemLocal||temporaria||imagemEscondida)&&<span className="text-center text-[9px] font-medium text-amber-700">Alteração só na prévia</span>}
    {erro&&<span role="alert" className="text-center text-[10px] text-red-600">{erro}</span>}
  </div>
}
