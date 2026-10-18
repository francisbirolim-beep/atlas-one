'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, ListChecks, ShieldAlert } from 'lucide-react'

type Fonte = {id:string; titulo:string; tipo:string}
type CandidatoResumo = {entrada_id:string; tipo:string; status:string}
type ItemApto = {id:string; codigo:string; descricao:string; entrada_id:string}
type ItemBloqueado = {id:string; codigo:string; motivo:string}
type Plano = {entrada_id:string; entrada_nome:string; total:number; aptos:ItemApto[]; bloqueados:ItemBloqueado[]}
type Resultado = {id:string; status:'aplicado'|'ignorado'|'erro'; motivo?:string}
type Api = (url:string,init?:RequestInit)=>Promise<any>

export default function ValidacaoLoteCatalogo({
  entradas,candidatos,entradaAtivaId,somenteLeitura,api,onFinalizar,
}:{
  entradas:Fonte[]
  candidatos:CandidatoResumo[]
  entradaAtivaId:string|null
  somenteLeitura:boolean
  api:Api
  onFinalizar:(mensagem:string)=>Promise<void>
}){
  const [planos,setPlanos]=useState<Plano[]>([])
  const [selecionados,setSelecionados]=useState<string[]>([])
  const [preparando,setPreparando]=useState(false)
  const [executando,setExecutando]=useState(false)
  const [confirmacao,setConfirmacao]=useState<'todos'|'selecionados'|null>(null)
  const [progresso,setProgresso]=useState({feitos:0,total:0,aplicados:0,ignorados:0})
  const [aviso,setAviso]=useState('')
  const [mostrarBloqueados,setMostrarBloqueados]=useState(false)
  const fontes=entradas.filter(e=>['catalogo','tabela_preco'].includes(e.tipo)
    &&(!entradaAtivaId||e.id===entradaAtivaId)
    &&candidatos.some(c=>c.entrada_id===e.id&&c.tipo==='produto'&&c.status==='pendente'))

  const todosExtraidos=planos.flatMap(p=>p.aptos)
  const qtdCodigo=new Map<string,number>()
  for(const item of todosExtraidos){
    const k=item.codigo.toUpperCase().replace(/[^A-Z0-9]/g,'')
    qtdCodigo.set(k,(qtdCodigo.get(k)||0)+1)
  }
  // Não homologa duas ocorrências do mesmo código em PDFs diferentes na mesma ação.
  const aptos=todosExtraidos.filter(x=>(qtdCodigo.get(x.codigo.toUpperCase().replace(/[^A-Z0-9]/g,''))||0)===1)
  const cruzados=todosExtraidos.filter(x=>!aptos.includes(x))
  const bloqueados=planos.flatMap(p=>p.bloqueados)
  const idsAptos=new Set(aptos.map(x=>x.id))
  const escolha=selecionados.filter(id=>idsAptos.has(id))
  const ocupada=preparando||executando

  async function preparar(){
    if(ocupada)return
    setPreparando(true);setAviso('');setPlanos([]);setSelecionados([]);setConfirmacao(null)
    const encontrados:Plano[]=[], falhas:string[]=[]
    try{
      for(const fonte of fontes){
        try{
          const plano=await api('/api/ia/central-aprendizado?preverLote=1&entradaId='+encodeURIComponent(fonte.id))
          encontrados.push(plano)
          setPlanos([...encontrados])
        }catch(e:any){falhas.push(fonte.titulo+': '+String(e?.message||'PDF indisponível'))}
      }
      const total=encontrados.reduce((acc,p)=>acc+p.aptos.length,0)
      if(falhas.length)setAviso('Não foi possível conferir algumas fontes; elas foram excluídas da seleção: '+falhas.join(' | '))
      else if(!total)setAviso('Nenhum item está apto neste momento. Confira primeiro os desenhos individuais e as divergências.')
    }finally{setPreparando(false)}
  }

  async function executar(){
    if(ocupada||!confirmacao)return
    const itens=confirmacao==='todos'?aptos:aptos.filter(x=>escolha.includes(x.id))
    if(!itens.length)return
    const modo=confirmacao
    setConfirmacao(null)
    if(somenteLeitura){
      setAviso('SIMULAÇÃO: '+itens.length+' produto(s) poderiam ser enviados para homologação. Nenhum cadastro foi alterado. Na produção, o servidor confere novamente cada item antes de salvar.')
      return
    }
    setExecutando(true);setAviso('')
    setProgresso({feitos:0,total:itens.length,aplicados:0,ignorados:0})
    let feitos=0,aplicados=0,ignorados=0
    const problemas:string[]=[]
    try{
      for(const plano of planos){
        const doCatalogo=itens.filter(x=>x.entrada_id===plano.entrada_id)
        for(let i=0;i<doCatalogo.length;i+=5){
          const lote=doCatalogo.slice(i,i+5)
          try{
            const resposta=await api('/api/ia/central-aprendizado',{
              method:'PATCH',body:JSON.stringify({acao:'validar_lote_catalogo',
                entrada_id:plano.entrada_id,ids:lote.map(x=>x.id)}),
            })
            const resultados:Resultado[]=resposta.resultados||[]
            aplicados+=resultados.filter(r=>r.status==='aplicado').length
            ignorados+=resultados.filter(r=>r.status!=='aplicado').length
            problemas.push(...resultados.filter(r=>r.status!=='aplicado')
              .map(r=>(lote.find(x=>x.id===r.id)?.codigo||r.id)+': '+(r.motivo||'não homologado')))
          }catch(e:any){
            ignorados+=lote.length
            problemas.push(plano.entrada_nome+': '+String(e?.message||'falha no lote'))
          }
          feitos+=lote.length
          setProgresso({feitos,total:itens.length,aplicados,ignorados})
          // Requisições pequenas e sequenciais preservam a resposta do sistema.
        }
      }
      const resumo=aplicados+' produto(s) homologado(s); '+ignorados+' continuaram para revisão.'
      await onFinalizar(resumo)
      setAviso(resumo+(problemas.length?' Detalhes: '+problemas.slice(0,5).join(' | '):''))
      setPlanos([]);setSelecionados([])
    }catch(e:any){
      setAviso('O processamento foi interrompido após '+feitos+' item(ns). As aprovações concluídas permaneceram salvas. '+String(e?.message||''))
    }finally{setExecutando(false)}
  }

  return <section className="mb-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ListChecks size={18}/>Homologação de catálogo em lote</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">Confere código, tabela original, peso, medidas e desenho individual já confirmado. Produtos com divergência não são aprovados.</p>
      </div>
      <button type="button" onClick={()=>void preparar()} disabled={ocupada||!fontes.length} className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 disabled:opacity-50">
        {preparando?<><Loader2 className="mr-1 inline animate-spin" size={15}/>Conferindo PDFs...</>:'Preparar validação em lote'}
      </button>
    </div>
    {!fontes.length&&<p className="mt-3 text-xs text-slate-500">Não há produtos pendentes em catálogos PDF nesta seleção.</p>}
    {planos.length>0&&<div className="mt-4 space-y-3 border-t pt-4">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800"><b className="block text-lg">{aptos.length}</b>Aptos</div>
        <div className="rounded-lg bg-amber-50 p-3 text-amber-800"><b className="block text-lg">{bloqueados.length+cruzados.length}</b>Para revisão</div>
        <div className="rounded-lg bg-slate-100 p-3 text-slate-700"><b className="block text-lg">{planos.reduce((n,p)=>n+p.total,0)}</b>Analisados</div>
      </div>
      {aptos.length>0&&<>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-600">{escolha.length} de {aptos.length} selecionados</p>
          <button type="button" disabled={ocupada} onClick={()=>setSelecionados(escolha.length===aptos.length?[]:aptos.map(x=>x.id))} className="text-xs font-semibold text-blue-700 underline">{escolha.length===aptos.length?'Desmarcar todos':'Selecionar todos os aptos'}</button>
        </div>
        <div className="max-h-40 space-y-1 overflow-auto rounded-xl border p-2">
          {aptos.map(item=><label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
            <input type="checkbox" disabled={ocupada} checked={escolha.includes(item.id)} onChange={e=>setSelecionados(v=>e.target.checked?[...v,item.id]:v.filter(id=>id!==item.id))}/>
            <b>{item.codigo}</b><span className="truncate text-slate-500">{item.descricao}</span>
          </label>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={ocupada||!escolha.length} onClick={()=>setConfirmacao('selecionados')} className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40">{somenteLeitura?'Simular selecionados':'Validar selecionados'}</button>
          <button type="button" disabled={ocupada} onClick={()=>setConfirmacao('todos')} className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">{somenteLeitura?'Simular todos os aptos':'Validar todos os aptos'}</button>
        </div>
      </>}
      {(bloqueados.length+cruzados.length)>0&&<div className="text-xs text-amber-900">
        <button type="button" onClick={()=>setMostrarBloqueados(v=>!v)} className="inline-flex items-center gap-1 font-semibold">{mostrarBloqueados?<ChevronUp size={14}/>:<ChevronDown size={14}/>}Ver motivos das pendências ({bloqueados.length+cruzados.length})</button>
        {mostrarBloqueados&&<div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-lg bg-amber-50 p-3">
          {bloqueados.map((x,i)=><p key={x.id+i}><b>{x.codigo||'Sem código'}:</b> {x.motivo}</p>)}
          {cruzados.map(x=><p key={x.id}><b>{x.codigo}:</b> mesmo código em mais de um catálogo; confirme individualmente.</p>)}
        </div>}
      </div>}
    </div>}
    {confirmacao&&<div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
      <div className="font-semibold text-blue-900">Conferir antes de confirmar</div>
      <p className="mt-1 text-xs text-blue-900">{confirmacao==='todos'?aptos.length:escolha.length} produtos aptos serão {somenteLeitura?'simulados, sem alteração nos cadastros':'reenviados ao servidor para nova conferência e homologação'}. Os demais continuarão pendentes.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={()=>void executar()} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">{somenteLeitura?'Executar simulação':'Confirmar validação'}</button>
        <button type="button" onClick={()=>setConfirmacao(null)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cancelar</button>
      </div>
    </div>}
    {executando&&<div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
      <div className="flex items-center gap-2"><Loader2 className="animate-spin" size={15}/>Processando em grupos de até 5, sem interromper outros usuários</div>
      <p className="mt-1">Conferidos {progresso.feitos}/{progresso.total} · homologados {progresso.aplicados} · não aplicados {progresso.ignorados}</p>
      <p className="mt-1">Mantenha esta aba aberta até concluir; cada grupo confirmado já fica salvo.</p>
    </div>}
    {aviso&&<p role="status" className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">{aviso}</p>}
    {somenteLeitura&&<p className="mt-3 inline-flex items-center gap-1 text-xs text-blue-700"><ShieldAlert size={14}/>Prévia somente leitura: não aprova nem altera produtos reais.</p>}
  </section>
}
