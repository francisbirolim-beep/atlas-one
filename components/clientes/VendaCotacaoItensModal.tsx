'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, FileDown, ImageOff, Loader2, Square, X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { ETAPAS_COTACAO, etapaItemCotacao, urlPdfCardCotacao, type EtapaCotacao } from '@/lib/cotacaoEtapas'

export type CotacaoItemDetalhe={
 material_id:string;codigo:string|null;descricao:string;unidade:string;quantidade_cotar:number;
 comprimento_corte_mm?:number|null;cor?:string|null;imagem_url?:string|null;status_etapa?:string|null
}
export type CotacaoLoteDetalhe={
 id:string;status:string;versao:number;categoria:string;itens:CotacaoItemDetalhe[]
}
const nomes:Record<EtapaCotacao,string>={
 necessidade:'Falta comprar',cotacao:'Em cotação',comprado:'Comprado',
 entrega:'Aguardando chegar',recebido:'Recebido'
}
export default function VendaCotacaoItensModal({lote,etapa,grupoId,vendaId,onFechar,onMover,ocupado}:{
 lote:CotacaoLoteDetalhe;etapa:EtapaCotacao;grupoId:string;vendaId:string;ocupado:boolean;
 onFechar:()=>void;onMover:(ids:string[],origem:EtapaCotacao,destino:EtapaCotacao)=>Promise<boolean>
}){
 const [itensDesenho,setItensDesenho]=useState<Record<string,string|null>>({})
 const [selecionados,setSelecionados]=useState<string[]>([])
 const [destino,setDestino]=useState<EtapaCotacao>(etapa==='necessidade'?'cotacao':etapa==='cotacao'?'comprado':etapa==='comprado'?'entrega':etapa==='entrega'?'recebido':'comprado')
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 const itens=useMemo(()=>lote.itens.filter(i=>etapaItemCotacao(lote,i)===etapa),[lote,etapa])
 const ids=itens.map(i=>i.material_id)
 const todos=ids.length>0&&ids.every(id=>selecionados.includes(id))
 useEffect(()=>{
  let ativo=true
  setItensDesenho({});setSelecionados([]);setErro('')
  void (async()=>{
   setCarregando(true)
   try{
    const token=await tokenAtual()
    if(!token)throw Error('Sessão expirada.')
    const r=await fetch('/api/vendas/cotacoes-lotes?vendaId='+encodeURIComponent(vendaId)+'&loteId='+encodeURIComponent(lote.id),{
      headers:{Authorization:'Bearer '+token},cache:'no-store',
    })
    const json=await r.json().catch(()=>({}))
    if(!r.ok)throw Error(json.error||'Não foi possível carregar desenhos técnicos.')
    if(ativo){
      const mapa:Record<string,string|null>={}
      for(const item of json.lotes?.[0]?.itens||[])mapa[item.material_id]=item.imagem_url||null
      setItensDesenho(mapa)
    }
   }catch(e){if(ativo)setErro(e instanceof Error?e.message:'Desenhos indisponíveis.')}
   finally{if(ativo)setCarregando(false)}
  })()
  return ()=>{ativo=false}
 },[lote.id,vendaId])
 function alternar(id:string){setSelecionados(atual=>atual.includes(id)?atual.filter(x=>x!==id):[...atual,id])}
 async function mover(){
  if(!selecionados.length||ocupado||destino===etapa)return
  const ok=await onMover(selecionados,etapa,destino)
  if(ok)onFechar()
 }
 return <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-2 md:p-5" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-cotacao" onMouseDown={e=>{if(e.target===e.currentTarget&&!ocupado)onFechar()}}>
  <section className="flex max-h-[93dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
   <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
    <div><h2 id="titulo-modal-cotacao" className="text-lg font-bold text-slate-900">Itens da cotação · {lote.categoria==='perfil'?'Perfis':lote.categoria==='vidro'?'Vidros':lote.categoria==='acessorios'?'Acessórios':'Outros'}</h2>
     <p className="mt-1 text-xs text-slate-500">{nomes[etapa]} · {itens.length} item(ns) · Selecione alguns ou todos para mudar de etapa.</p></div>
    <button type="button" aria-label="Fechar detalhes" onClick={onFechar} disabled={ocupado} className="rounded-lg border p-2"><X size={18}/></button>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-slate-50 p-3">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={()=>setSelecionados(todos?[]:ids)} className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold">
       {todos?<CheckSquare size={16}/>:<Square size={16}/>} {todos?'Desmarcar todos':'Selecionar todos'}
      </button>
      <span className="text-xs text-slate-600">{selecionados.length} de {itens.length} selecionados</span>
      {carregando&&<Loader2 size={16} className="animate-spin text-blue-600"/>}
    </div>
    <a href={urlPdfCardCotacao(lote.id,vendaId,etapa,grupoId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-blue-700"><FileDown size={15}/>Abrir PDF deste card</a>
   </div>
   {erro&&<p role="alert" className="m-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{erro}</p>}
   <div className="min-h-0 flex-1 overflow-auto">
    <table className="w-full min-w-[750px] text-left text-xs">
     <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase text-slate-600"><tr><th className="w-10 p-3">✓</th><th className="p-3">Desenho</th><th className="p-3">Código e material</th><th className="p-3">Cor / corte</th><th className="p-3 text-right">A cotar</th></tr></thead>
     <tbody>{itens.map(item=><tr key={item.material_id} className="border-b align-middle hover:bg-blue-50">
       <td className="p-3"><input type="checkbox" aria-label={`Selecionar ${item.codigo||item.descricao}`} checked={selecionados.includes(item.material_id)} onChange={()=>alternar(item.material_id)} className="h-4 w-4"/></td>
       <td className="w-24 p-2">{itensDesenho[item.material_id]?<img src={itensDesenho[item.material_id]||''} alt={`Desenho do código ${item.codigo||'sem código'}`} loading="lazy" className="h-14 w-20 rounded-md border object-contain"/>:<span className="inline-flex items-center gap-1 text-amber-700"><ImageOff size={14}/> Sem desenho</span>}</td>
       <td className="p-3"><b className="font-mono">{item.codigo||'Sem código'}</b><p className="mt-1 text-slate-600">{item.descricao}</p></td>
       <td className="p-3 text-slate-700">{item.cor||'—'}{item.comprimento_corte_mm? <p className="mt-1">{Number(item.comprimento_corte_mm).toLocaleString('pt-BR')} mm</p>:null}</td>
       <td className="p-3 text-right font-bold">{Number(item.quantidade_cotar||0).toLocaleString('pt-BR')} {item.unidade}</td>
     </tr>)}{!itens.length&&<tr><td colSpan={5} className="p-6 text-center text-slate-500">Não há itens nesta etapa.</td></tr>}</tbody>
    </table>
   </div>
   <div className="space-y-3 border-t bg-white p-4">
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-semibold text-slate-700">Mover selecionados para
        <select value={destino} onChange={e=>setDestino(e.target.value as EtapaCotacao)} className="ml-2 rounded-lg border px-3 py-2 text-xs">{ETAPAS_COTACAO.filter(e=>e!==etapa).map(e=><option key={e} value={e}>{nomes[e]}</option>)}</select>
      </label>
      <button type="button" onClick={()=>void mover()} disabled={!selecionados.length||ocupado||destino===etapa} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{ocupado?'Movendo...':`Mover ${selecionados.length} item(ns)`}</button>
    </div>
    <p className="text-[11px] text-slate-500">Os itens não selecionados ficam na etapa atual. Esta é uma confirmação do acompanhamento do Kanban: não gera nota fiscal, baixa de estoque ou pagamento. O Atlas perguntará antes de confirmar.</p>
   </div>
  </section>
 </div>
}
