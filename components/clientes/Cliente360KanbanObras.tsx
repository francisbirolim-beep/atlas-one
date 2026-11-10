'use client'
import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import AlcaArrastarCard from '@/components/kanban/AlcaArrastarCard'
import {colunaNoFimDoArraste,type CoordenadaArraste} from '@/lib/kanbanArrastarDestino'
import {ArrowUpRight,Building2,CalendarDays,CheckCircle2,Columns3,MapPin,RefreshCw,Search,SlidersHorizontal} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import type {ObraCardCliente} from '@/lib/cliente360KanbanObras'
import {COLUNAS_GERAIS_PADRAO} from '@/lib/visaoGeralProjetos'

type Resposta={cards:ObraCardCliente[];colunas?:typeof COLUNAS_GERAIS_PADRAO;podeMoverCards:boolean;posicoesPersistidas?:Record<string,string>;vendasSemObra:number;atualizadoEm:string}
type Filtro='todas'|'ativas'|'concluidas'
const cores:Record<string,string>={
 orcamento:'bg-slate-100 text-slate-800 border-slate-200',
 vendido:'bg-blue-100 text-blue-800 border-blue-200',
 validacao_projeto:'bg-sky-100 text-sky-800 border-sky-200',
 separacao:'bg-cyan-100 text-cyan-800 border-cyan-200',
 compras:'bg-amber-100 text-amber-800 border-amber-200',
 aguardando:'bg-orange-100 text-orange-800 border-orange-200',
 medicao:'bg-indigo-100 text-indigo-800 border-indigo-200',
 producao:'bg-violet-100 text-violet-800 border-violet-200',
 instalacao:'bg-emerald-100 text-emerald-800 border-emerald-200',
 finalizado:'bg-green-100 text-green-800 border-green-200',
}
const nomesEtapas:Record<string,string>={
 orcamento:'Pré-venda / Orçamento',vendido:'Vendido / Planejamento',conferir_projeto:'Conferência do projeto',
 separacao_materiais:'Separação de materiais',compras_liberacao:'Liberação de compras',compras:'Compras',
 aguardando_materiais:'Aguardando material',medicao_final:'Medição final',aguardando_producao:'Aguardando produção',
 producao:'Produção',aguardando_instalacao:'Aguardando instalação',instalacao:'Instalação',finalizado:'Finalizado',
}
const dataBR=(data:string|null)=>{
 if(!data)return 'Sem previsão cadastrada'
 const dia=new Date(data.slice(0,10)+'T12:00:00')
 return Number.isNaN(dia.getTime())?'Previsão indisponível':dia.toLocaleDateString('pt-BR')
}
export default function Cliente360KanbanObras({clienteId,podeVerVendas,onAbrirObras}:{
 clienteId:string;podeVerVendas:boolean;onAbrirObras:()=>void
}){
 const [dados,setDados]=useState<Resposta|null>(null)
 const [carregando,setCarregando]=useState(true)
 const [erro,setErro]=useState('')
 const [aviso,setAviso]=useState('')
 const [movendo,setMovendo]=useState(false)
 const [busca,setBusca]=useState('')
 const [filtro,setFiltro]=useState<Filtro>('todas')
 const leituraAtual=useRef(0)
 const movimentoEmCurso=useRef(false)
 const arrasteCard=useRef<{id:string;ponto:CoordenadaArraste|null;tratado:boolean}|null>(null)
 const posicoesGravadas=useRef(new Map<string,string>())
 const carregar=useCallback(async(silencioso=false)=>{
  if(movimentoEmCurso.current)return // rejeitar consulta periódica durante salvamento
  const geracao=++leituraAtual.current
  if(!silencioso)setCarregando(true)
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada. Faça login novamente.')
   const resposta=await fetch('/api/clientes/'+encodeURIComponent(clienteId)+'/kanban-obras',{
    headers:{Authorization:'Bearer '+token},cache:'no-store',
   })
   const json=await resposta.json().catch(()=>({}))
   if(!resposta.ok)throw new Error(json.erro||'Não foi possível carregar o Kanban do Cliente.')
   if(movimentoEmCurso.current||geracao!==leituraAtual.current)return
   const retorno=json as Resposta
   retorno.cards=(retorno.cards||[]).map(c=>{
    const vendaId=c.vendas.length===1?c.vendas[0].vendaId:null
    const gravada=vendaId?retorno.posicoesPersistidas?.[vendaId]:null
    const valida=typeof gravada==='string'&&(retorno.colunas||COLUNAS_GERAIS_PADRAO)
     .some(col=>col.id===gravada)?gravada:null
    const local=vendaId?posicoesGravadas.current.get(vendaId):null
    if(local&&local===valida)posicoesGravadas.current.delete(vendaId!)
    const destino=local||valida
    if(!destino||c.colunaId===destino)return c
    return {...c,colunaId:destino,vendas:c.vendas.map(v=>({...v,colunaId:destino}))}
   })
   setDados(retorno);setErro('')
  }catch(e){
   if(!movimentoEmCurso.current&&geracao===leituraAtual.current)
    setErro(e instanceof Error?e.message:'Não foi possível carregar as obras.')
  }
  finally{if(geracao===leituraAtual.current)setCarregando(false)}
 },[clienteId])
 useEffect(()=>{
  void carregar()
  const timer=window.setInterval(()=>{if(!document.hidden)void carregar(true)},60_000)
  const voltar=()=>{if(!document.hidden)void carregar(true)}
  document.addEventListener('visibilitychange',voltar)
  return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',voltar)}
 },[carregar])
 async function moverVenda(vendaId:string,colunaId:string){
  if(movimentoEmCurso.current||!dados?.podeMoverCards)return
  const destino=(dados.colunas||COLUNAS_GERAIS_PADRAO).find(c=>c.id===colunaId)
  const obra=dados.cards.find(c=>c.vendas.length===1&&c.vendas[0].vendaId===vendaId)
  if(!destino||!obra)return
  if(obra.colunaId===colunaId){setAviso('Esta obra já está em '+destino.nome+'.');return}
  const anterior=dados
  let gravouNoBanco=false
  movimentoEmCurso.current=true
  ++leituraAtual.current
  setMovendo(true);setErro('');setAviso('Salvando obra em '+destino.nome+'...')
  posicoesGravadas.current.set(vendaId,colunaId)
  setDados(p=>p?{...p,cards:p.cards.map(c=>c.id===obra.id?{
   ...c,colunaId,vendas:c.vendas.map(v=>({...v,colunaId}))
  }:c)}:p)
  try{
   const token=await tokenAtual()
   if(!token)throw Error('Sessão expirada. Entre novamente.')
   const res=await fetch('/api/visao-geral-projetos/mover',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,colunaId,motivo:'Reposicionamento manual no Kanban do Cliente para '+destino.nome+'.'}),
   })
   const json=await res.json().catch(()=>({}))
   if(!res.ok||!json.ok)throw Error(json.erro||'Não foi possível mover a obra.')
   if(json.colunaId&&json.colunaId!==colunaId)throw Error('O banco respondeu outra coluna.')
   gravouNoBanco=true
   const resposta=await fetch('/api/visao-geral-projetos/mover?vendaId='+encodeURIComponent(vendaId),{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   })
   const atualizado=await resposta.json().catch(()=>({}))
   if(!resposta.ok){
    setAviso('✓ Obra gravada em '+destino.nome+'. A confirmação da leitura ficará pendente.')
    return
   }
   if(atualizado.estado!=='manual'||atualizado.colunaId!==colunaId){
    setAviso('')
    setErro('A posição gravada no banco não corresponde à coluna '+destino.nome+'.')
    return
   }
   posicoesGravadas.current.delete(vendaId)
   setAviso('✓ Obra salva em '+destino.nome+' e sincronizada com o Kanban Geral.')
  }catch(e){
   if(gravouNoBanco){
    setAviso('✓ Obra gravada em '+destino.nome+'. Atualização do painel pendente.')
   }else{
    posicoesGravadas.current.delete(vendaId)
    setDados(anterior);setAviso('')
    setErro(e instanceof Error?e.message:'Falha ao salvar a posição da obra.')
   }
  }finally{
   movimentoEmCurso.current=false;setMovendo(false)
  }
 }
 const cards=dados?.cards||[]
 const colunas=[{id:'orcamento',nome:'Pré-venda / Orçamento',ordem:-1},...(dados?.colunas||COLUNAS_GERAIS_PADRAO)].sort((a,b)=>a.ordem-b.ordem)
 const ativos=cards.filter(c=>c.colunaId!=='finalizado')
 const visiveis=useMemo(()=>{
  const termo=busca.trim().toLocaleLowerCase('pt-BR')
  return cards.filter(c=>(!termo||[c.nome,String(c.numero),c.cidade||''].join(' ').toLocaleLowerCase('pt-BR').includes(termo))
   &&(filtro==='todas'||(filtro==='ativas'?c.colunaId!=='finalizado':c.colunaId==='finalizado')))
 },[cards,busca,filtro])
 const kpis=[
  {titulo:'Obras vinculadas',valor:cards.length},
  {titulo:'Em andamento',valor:ativos.length},
  {titulo:'Em produção',valor:cards.filter(c=>c.colunaId==='producao').length},
  {titulo:'Em instalação',valor:cards.filter(c=>c.colunaId==='instalacao').length},
  {titulo:'Concluídas',valor:cards.filter(c=>c.colunaId==='finalizado').length},
 ]
 return <section data-kanban-board className="space-y-4" aria-label="Kanban geral das obras deste cliente">
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
   {kpis.map(k=><div key={k.titulo} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
    <p className="text-[11px] font-semibold text-slate-500">{k.titulo}</p>
    <p className="mt-1 text-2xl font-extrabold text-slate-900">{carregando&&!dados?'—':k.valor}</p>
   </div>)}
  </div>
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
    <div className="flex items-center gap-3">
     <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><Columns3 size={19}/></div>
     <div><h2 className="font-bold text-slate-900">Kanban do Cliente (por Obra)</h2>
      <p className="text-xs text-slate-500">Um card por obra. Arraste as obras com uma venda para a coluna correta; somente a posição visual muda.</p>
     </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <label className="relative flex items-center"><Search size={15} className="pointer-events-none absolute left-3 text-slate-400"/>
      <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar obra, número ou cidade..."
       aria-label="Buscar obras do cliente" className="w-56 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-500 sm:w-64"/>
     </label>
     <label className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600">
      <SlidersHorizontal size={14}/><span className="sr-only">Filtrar obras</span>
      <select aria-label="Filtrar obras" value={filtro} onChange={e=>setFiltro(e.target.value as Filtro)} className="bg-transparent py-1 outline-none">
       <option value="todas">Todas</option><option value="ativas">Em andamento</option><option value="concluidas">Concluídas</option>
      </select>
     </label>
     <button type="button" onClick={()=>void carregar()} disabled={carregando} title="Atualizar andamento das obras"
      className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
      <RefreshCw size={16} className={carregando?'animate-spin':''}/><span className="sr-only">Atualizar Kanban</span>
     </button>
    </div>
   </div>
   {erro&&<div role="alert" className="fixed bottom-20 right-5 z-[120] max-w-[420px] rounded-xl border-2 border-rose-400 bg-rose-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">
    {erro}<button type="button" onClick={()=>setErro('')} className="ml-3 underline">Fechar</button>
   </div>}
   {!erro&&aviso&&<div role="status" aria-live="polite" className="fixed bottom-20 right-5 z-[120] max-w-[420px] rounded-xl border-2 border-emerald-400 bg-emerald-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">
    {aviso}<button type="button" onClick={()=>setAviso('')} className="ml-3 underline">Fechar</button>
   </div>}
   {carregando&&!dados&&<p className="p-5 text-sm text-slate-500">Consultando a evolução das obras...</p>}
   {dados&&<div data-kanban-scroll className="overflow-x-auto px-3 pb-3 pt-3" role="region" aria-label="Colunas do Kanban de obras" tabIndex={0}>
    <div className="flex w-max gap-2 sm:grid sm:w-full sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
     {colunas.map(col=>{
      const lista=visiveis.filter(c=>c.colunaId===col.id)
      return <div key={col.id} data-kanban-coluna={col.id}
       onDragOver={e=>{if(dados.podeMoverCards&&!movendo&&col.id!=='orcamento'){e.preventDefault();e.dataTransfer.dropEffect='move'}}}
       onDrop={e=>{
        if(!dados.podeMoverCards||movendo||col.id==='orcamento')return
        const origem=e.dataTransfer.getData('text/plain')
        const vendaId=origem.startsWith('atlas-principal:')?
         origem.slice('atlas-principal:'.length):(!origem?arrasteCard.current?.id:null)
        if(!vendaId||!dados.cards.some(c=>c.vendas.length===1&&c.vendas[0].vendaId===vendaId))return
        e.preventDefault()
        if(arrasteCard.current?.id===vendaId)arrasteCard.current.tratado=true
        void moverVenda(vendaId,col.id)
       }}
       className="w-[238px] shrink-0 rounded-xl border sm:w-auto sm:min-w-0 border-slate-100 bg-slate-50/75">
       <div className={'flex min-h-14 items-center justify-between gap-2 rounded-t-xl border-b px-3 py-3 '+(cores[col.id]||cores.orcamento)}>
        <h3 className="text-xs font-extrabold">{col.nome}</h3>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold">{lista.length}</span>
       </div>
       <div className="min-h-[140px] space-y-2 p-2">
        {lista.map(card=>{
         const atual=card.vendas[0]
         const abrirVenda=podeVerVendas&&atual
         return <article data-kanban-card key={card.id}
          draggable={!!(dados.podeMoverCards&&card.vendas.length===1&&atual?.vendaId)&&!movendo}
          onDragStart={e=>{
           if(!dados.podeMoverCards||card.vendas.length!==1||!atual?.vendaId||movendo){e.preventDefault();return}
           e.dataTransfer.setData('text/plain','atlas-principal:'+atual.vendaId)
           e.dataTransfer.effectAllowed='move'
           arrasteCard.current={id:atual.vendaId,ponto:null,tratado:false}
          }}
          onDrag={e=>{
           if(arrasteCard.current?.id===atual?.vendaId&&e.clientX>0&&e.clientY>0)
            arrasteCard.current.ponto={x:e.clientX,y:e.clientY}
          }}
          onDragEnd={e=>{
           const arraste=arrasteCard.current
           const foiTratado=!!(arraste?.id===atual?.vendaId&&arraste.tratado)
           const destino=foiTratado?null:colunaNoFimDoArraste(e.currentTarget,{x:e.clientX,y:e.clientY},arraste?.ponto||null)
           arrasteCard.current=null
           if(!foiTratado&&!movendo&&dados.podeMoverCards&&atual?.vendaId){
            if(destino&&destino!=='orcamento')void moverVenda(atual.vendaId,destino)
            else {setAviso('');setErro('Solte o card em uma coluna de andamento para salvar. Nenhuma posição foi alterada.')}
           }
          }}
          className={'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm '+(dados.podeMoverCards&&card.vendas.length===1?'cursor-grab active:cursor-grabbing':'')}>
          {card.fotoProjetoUrl?<img src={card.fotoProjetoUrl} alt={'Foto da obra '+card.nome}
           className="h-24 w-full object-cover" loading="lazy"/>:null}
          <div className="p-3">
           {dados.podeMoverCards&&card.vendas.length===1&&atual?.vendaId&&<AlcaArrastarCard
            desabilitado={movendo}
            onSoltar={destino=>{if(destino==='orcamento'){setAviso('');setErro('Não é possível mover uma venda confirmada para Pré-venda.')}else void moverVenda(atual.vendaId,destino)}}
            onSolturaInvalida={()=>{setAviso('');setErro('Solte dentro da coluna de destino para gravar a obra. Nenhuma posição foi alterada.')}}
            label="Segure aqui e arraste a obra" />}
           {dados.podeMoverCards&&card.vendas.length>1&&<p className="mb-2 rounded bg-amber-50 p-2 text-[10px] text-amber-800">Esta obra possui várias vendas. Abra a venda específica para reposicionar sem afetar as demais.</p>}
           <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2">
             {!card.fotoProjetoUrl&&<Building2 size={17} className="mt-0.5 shrink-0 text-blue-600"/>}
             <div className="min-w-0"><p className="break-words text-xs font-extrabold text-slate-900">Obra #{card.numero||'—'}</p>
              <p className="mt-0.5 break-words text-xs font-semibold text-slate-800">{card.nome}</p></div>
            </div>
            {card.vendas.length>1&&<span className="shrink-0 rounded bg-blue-50 px-1.5 py-1 text-[10px] text-blue-800">{card.vendas.length} vendas</span>}
           </div>
           {card.cidade&&<p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500"><MapPin size={12}/>{card.cidade}</p>}
           <p className="mt-2 text-[11px] font-medium text-slate-600">{nomesEtapas[card.etapaOperacional]||card.etapaOperacional}</p>
           {card.progresso!==null?<><div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>Etapa atual</span><strong>{card.progresso}%</strong></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:card.progresso+'%'}}/></div></>:null}
           <p className="mt-1 text-[10px] text-slate-500">{card.progressoDescricao}</p>
           <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500"><CalendarDays size={12}/>Entrega: {dataBR(card.previsaoEntrega)}</p>
           {card.orcamentos!==null&&<p className="mt-1 text-[10px] text-slate-500">{card.orcamentos} orçamento(s) atual(is) vinculado(s)</p>}
           {dados.podeMoverCards&&card.vendas.length===1&&atual?.vendaId&&<label className="mt-2 block text-[10px] font-semibold text-blue-900">
            Mover obra para a coluna
            <select aria-label={'Mover obra '+card.nome} disabled={movendo} value={card.colunaId}
             onChange={e=>void moverVenda(atual.vendaId,e.target.value)}
             className="mt-1 block w-full rounded border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-950">
             {colunas.filter(c=>c.id!=='orcamento').map(c=><option value={c.id} key={c.id}>{c.nome}</option>)}
            </select>
           </label>}
           {abrirVenda?<Link href={'/clientes/'+encodeURIComponent(clienteId)+'/vendas/'+encodeURIComponent(atual.vendaId)}
            className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">Abrir fluxo da obra <ArrowUpRight size={13}/></Link>
            :<button type="button" onClick={onAbrirObras} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
             Ver cadastro da obra <ArrowUpRight size={13}/></button>}
           {podeVerVendas&&card.vendas.length>1&&<details className="mt-2 border-t border-slate-100 pt-2 text-xs">
            <summary className="cursor-pointer text-slate-600">Outras vendas desta obra</summary>
            <div className="mt-2 space-y-1">{card.vendas.slice(1).map(v=><Link key={v.vendaId}
             className="block text-blue-700 hover:underline" href={'/clientes/'+encodeURIComponent(clienteId)+'/vendas/'+encodeURIComponent(v.vendaId)}>
             Venda #{v.numero||'—'} · {nomesEtapas[v.etapaOperacional]||v.etapaOperacional} ↗</Link>)}</div>
           </details>}
          </div>
         </article>
        })}
        {!lista.length&&<p className="px-2 py-8 text-center text-xs text-slate-400">Sem obras nesta etapa.</p>}
       </div>
      </div>
     })}
    </div>
   </div>}
   {dados&&!cards.length&&<p className="px-4 pb-3 text-sm text-slate-500">Nenhuma obra cadastrada para este cliente.</p>}
   {dados&&dados.vendasSemObra>0&&<p className="border-t px-4 py-3 text-xs text-amber-800">
    {dados.vendasSemObra} venda(s) sem obra vinculada não foram posicionadas automaticamente. Vincule-as à obra correta para acompanhar neste Kanban.
   </p>}
   <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
    <span>{dados?.podeMoverCards?'Arraste o card ou selecione a coluna: a posição aparece nos três Kanbans.':'Posição somente consulta; usuário sem permissão de movimentação.'}</span>
    {dados?.atualizadoEm&&<span>Atualizado: {new Date(dados.atualizadoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span>}
   </div>
  </div>
 </section>
}
