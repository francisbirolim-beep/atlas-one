'use client'

import { useEffect, useState } from 'react'

/** Exibe apenas a foto_url cadastrada na própria tipologia, sem imagens substitutas. */
export default function FotoTipologiaPreview({
  fotoUrl,nome,tamanho='card'
}:{
  fotoUrl?:string|null;nome:string;tamanho?:'card'|'detalhe'
}){
  const [erro,setErro]=useState(false)
  useEffect(()=>setErro(false),[fotoUrl])
  const url=fotoUrl&&/^https:\/\//i.test(fotoUrl.trim())?fotoUrl.trim():null
  const grande=tamanho==='detalhe'
  return <div className={'grid shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white '+(grande?'h-40 w-44 sm:h-48 sm:w-52':'h-24 w-28 sm:h-28 sm:w-32')}>
    {url&&!erro?
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={'Foto cadastrada da tipologia '+nome} className="h-full w-full object-contain p-2" loading="lazy" onError={()=>setErro(true)}/>:
      <span className="px-2 text-center text-[10px] text-slate-400">{url?'Foto indisponível':'Sem foto cadastrada'}</span>}
  </div>
}
