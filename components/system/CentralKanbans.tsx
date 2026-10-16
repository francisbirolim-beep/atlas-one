'use client'
import { useCallback,useEffect,useMemo,useRef,useState } from 'react'
import Link from 'next/link'
import { ArrowLeft,ArrowUpRight,Check,ChevronRight,Columns3,Fullscreen,MessageSquare,Plus,RefreshCcw,Settings2,X } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { QUADROS,indiceConclusaoOperacional,ehColunaConclusaoOperacional,type QuadroId,type SetorBoard,type NivelBoard } from '@/lib/centralKanban'

type Coluna={id:string,setor:string,nome:string,ordem:number;nome_exibicao?:string|null;ordem_visual?:number|null}
type Percentuais={compras?:number;mercadoria?:number;producao?:number;instalacao?:number;financeiro?:number}
type Card={id:string;numero:number;clienteId:string;cliente:string;obra:string;cidade:string;previsao:string|null;
 percentualGeral:number;percentuais:Percentuais;conclusoes?:Record<string,boolean>;contagens:Record<string,number>;
 observacoes:Record<string,{comentarios:number;ultimoComentario:string|null}>}
type Posicao={setor:string;venda_obra_id:string;coluna_id:string;updated_at:string}
type Acesso={usuario_id:string;setor:string;nivel:NivelBoard;responsavel:boolean}
type Usuario={id:string;nome:string;role:string}
type Dados={usuarioMaster?:boolean;quadros:typeof QUADROS[number][];permissoes:Record<string,NivelBoard>;colunas:Coluna[];
 posicoes:Posicao[];cards:Card[];nativos?:Record<string,{colunas:Coluna[];cards:Array<{id:string;cliente:string;obra:string;numero:number;cidade:string;coluna_id:string|null;href:string}>}>;funcionarios:Usuario[];acessos:Acesso[];atualizadoEm:string}
type Comentario={id:string;setor:string;texto:string;usuario_nome:string;created_at:string}
type Movimento={id:string;setor:string;coluna_anterior_nome:string|null;coluna_nova_nome:string|null;motivo:string|null;usuario_nome:string;created_at:string}
const qTitulo=(id:string)=>QUADROS.find(q=>q.id===id)?.nome||id
const pct=(n:number|undefined)=>typeof n==='number'?n+'%':'—'
const horario=(v?:string|null)=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—'
const dataBR=(v?:string|null)=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'—'
const setoresMedidos:{id:keyof Percentuais;nome:string;quadro:QuadroId}[]=[
 {id:'compras',nome:'Compras',quadro:'compras'},{id:'mercadoria',nome:'Mercadoria recebida',quadro:'compras'},
 {id:'producao',nome:'Produção',quadro:'producao'},{id:'instalacao',nome:'Instalação',quadro:'instalacao'},
 {id:'financeiro',nome:'Financeiro',quadro:'financeiro'}]
const peso:Record<NivelBoard,number>={oculto:0,visualizar:1,movimentar:2,administrar:3}

export default function CentralKanbans(){
 const [dados,setDados]=useState<Dados|null>(null)
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(true)
 const [setor,setSetor]=useState<string>('')
 const [modo,setModo]=useState<'geral'|'setor'|'monitor'>('geral')
 const [monitor,setMonitor]=useState<string[]>([])
 const [filtro,setFiltro]=useState('')
 const [cidade,setCidade]=useState('')
 const [detalhe,setDetalhe]=useState<Card|null>(null)
 const [abaDetalhe,setAbaDetalhe]=useState<string>('compras')
 const [historico,setHistorico]=useState<Movimento[]>([])
 const [comentarios,setComentarios]=useState<Comentario[]>([])
 const [comentario,setComentario]=useState('')
 const [salvando,setSalvando]=useState(false)
 const [editando,setEditando]=useState(false)
 const [config,setConfig]=useState(false)
 const [funcionario,setFuncionario]=useState('')
 const [nivel,setNivel]=useState<NivelBoard>('visualizar')
 const [responsavel,setResponsavel]=useState(false)
 const [novaColuna,setNovaColuna]=useState('')
 const [arrastado,setArrastado]=useState<{id:string;origemId:string;setor:string}|null>(null)
 const [ultimoRefresh,setUltimoRefresh]=useState('')
 const [atrasados,setAtrasados]=useState(false)
 const tela=useRef<HTMLDivElement>(null)
 const tokenCache=useRef<string|null>(null)
 const pode=(id:string,min:NivelBoard='visualizar')=>peso[dados?.permissoes[id]||'oculto']>=peso[min]

 const requisicao=useCallback(async(body?:Record<string,unknown>,query='')=>{
  const token=await tokenAtual()
  tokenCache.current=token
  if(!token)throw Error('Sua sessão expirou. Entre novamente no Atlas.')
  const resp=await fetch('/api/kanban-central'+query,{method:body?'POST':'GET',
   headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined,cache:'no-store'})
  const json=await resp.json().catch(()=>({}))
  if(!resp.ok)throw Error(json.erro||'Não foi possível consultar o Kanban.')
  return json
 },[])
 const carregar=useCallback(async(silencioso=false)=>{
  if(!silencioso)setCarregando(true)
  try{
   const json=await requisicao() as Dados
   setDados(json);setErro('');setUltimoRefresh(json.atualizadoEm)
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao carregar dados.')}
  finally{setCarregando(false)}
 },[requisicao])
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search),sel=p.get('setor')
  const orc=p.get('orcamento')
  if(orc){window.location.replace('/kanban/comercial?orcamento='+encodeURIComponent(orc));return}
  if(sel&&['engenharia','compras','producao','instalacao','financeiro'].includes(sel)){setSetor(sel);setModo('setor')}
  void carregar()
  const timer=window.setInterval(()=>{if(!document.hidden)void carregar(true)},60000)
  return ()=>window.clearInterval(timer)
 },[carregar])
 useEffect(()=>{
  if(dados&&!monitor.length)setMonitor(dados.quadros.map(q=>q.id))
 },[dados,monitor.length])
 const colunas=(s:string)=>dados?.colunas.filter(c=>c.setor===s).sort((a,b)=>a.ordem-b.ordem)||[]
 const origCard=(card:Card,s:string)=>{
  const cols=colunas(s),p=dados?.posicoes.find(p=>p.venda_obra_id===card.id&&p.setor===s)
  if(!cols.length)return ''
  const indiceFinal=indiceConclusaoOperacional(s)
  const etapaFinal=indiceFinal!==null?cols.find(c=>c.ordem===indiceFinal):undefined
  const concluida=card.conclusoes?.[s]===true
  // O estado operacional prevalece sobre deslocamentos administrativos anteriores.
  if(etapaFinal&&concluida)return etapaFinal.id
  if(p&&cols.some(c=>c.id===p.coluna_id)&&(!etapaFinal||p.coluna_id!==etapaFinal.id))return p.coluna_id
  const x=card.percentuais
  if(s==='compras'){
   if(x.mercadoria===100&&card.contagens.compras>0&&concluida)return etapaFinal?.id||cols[cols.length-1].id
   if(x.mercadoria&&x.mercadoria>0)return cols.find(c=>c.nome==='Recebimento parcial')?.id||cols[0].id
   if(x.compras===100&&card.contagens.compras>0)return cols.find(c=>c.nome==='Aguardando mercadoria')?.id||cols[0].id
   if(x.compras&&x.compras>0)return cols.find(c=>c.nome==='Pedido realizado')?.id||cols[0].id
  }
  if(s==='producao'&&card.contagens.producao>0){
   if(x.producao===100&&concluida)return etapaFinal?.id||cols[cols.length-1].id
   if((x.producao||0)>0)return cols[Math.min(2,cols.length-1)].id
  }
  if(s==='instalacao'&&card.contagens.instalacao>0){
   if(x.instalacao===100&&concluida)return etapaFinal?.id||cols[cols.length-1].id
   if((x.instalacao||0)>0)return cols[Math.min(2,cols.length-1)].id
  }
  if(s==='financeiro'&&card.contagens.financeiro>0){
   if(x.financeiro===100&&concluida)return etapaFinal?.id||cols[cols.length-1].id
   if((x.financeiro||0)>0)return cols[Math.min(1,cols.length-1)].id
  }
  return cols[0].id
 }
 const cardsVisiveis=useMemo(()=>{
  const term=filtro.toLocaleLowerCase('pt-BR').trim()
  return (dados?.cards||[]).filter(c=>(!term||[c.cliente,c.obra,c.cidade,String(c.numero)].join(' ').toLocaleLowerCase('pt-BR').includes(term))
   &&(!cidade||c.cidade===cidade)&&(!atrasados||(!!c.previsao&&new Date(c.previsao+'T23:59:59').getTime()<Date.now()&&c.percentualGeral<100)))
 },[dados,filtro,cidade,atrasados])
 const cidades=[...new Set((dados?.cards||[]).map(c=>c.cidade).filter(Boolean))].sort()
 // Detalhe do card acompanha a atualização periódica, sem conservar números antigos.
 const detalheAtual=detalhe?(dados?.cards.find(c=>c.id===detalhe.id)||detalhe):null

 async function detalheCard(card:Card,etapa?:string){
  setDetalhe(card);setAbaDetalhe(etapa||((dados?.quadros.some(q=>q.id==='compras')?'compras':dados?.quadros[0]?.id)||'comercial'))
  setComentario('');setHistorico([]);setComentarios([])
  try{
   const j=await requisicao(undefined,'?venda='+encodeURIComponent(card.id))
   setComentarios(j.comentarios||[]);setHistorico(j.historico||[])
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar histórico.')}
 }
 async function executar(body:Record<string,unknown>,atualizar=true){
  setSalvando(true)
  try{await requisicao(body);if(atualizar)await carregar(true);setErro('');return true}
  catch(e){setErro(e instanceof Error?e.message:'Não foi possível salvar.');return false}
  finally{setSalvando(false)}
 }
 async function comentar(){
  if(!detalhe||!comentario.trim()||!pode(abaDetalhe,'movimentar'))return
  if(await executar({acao:'comentario',vendaId:detalhe.id,setor:abaDetalhe,texto:comentario.trim()})){
   setComentario('');await detalheCard(detalhe,abaDetalhe)
  }
 }
 async function mover(id:string,s:string,destino:string){
  const card=dados?.cards.find(c=>c.id===id),cols=colunas(s)
  if(!card||!cols.length||!pode(s,'movimentar'))return
  const atual=origCard(card,s),a=cols.find(c=>c.id===atual),b=cols.find(c=>c.id===destino)
  if(!a||!b||atual===destino)return
  if(ehColunaConclusaoOperacional(s,b.ordem)&&!card.conclusoes?.[s]){
   setErro('Este card só pode entrar na última etapa após a conclusão confirmada no painel da venda.');return
  }
  if(!window.confirm('Mover '+card.cliente+' — '+card.obra+' de "'+a.nome+'" para "'+b.nome+'"?'))return
  let motivo=''
  if(b.ordem<a.ordem){
   const resposta=window.prompt('Motivo para voltar à etapa anterior (obrigatório):')
   if(!resposta?.trim())return
   motivo=resposta.trim()
  }
  await executar({acao:'mover',setor:s,vendaId:id,colunaId:destino,origemId:atual,motivo})
 }
 function selecionarQuadro(id:string){
  if(id==='comercial'||id==='assistencia'){window.location.href=QUADROS.find(q=>q.id===id)?.rota||'/kanban';return}
  setSetor(id);setModo('setor');setConfig(false)
  window.history.replaceState(null,'','/kanban?setor='+encodeURIComponent(id))
 }
 function irGeral(){setModo('geral');setSetor('');setConfig(false);window.history.replaceState(null,'','/kanban')}
 function cardVisual(card:Card,s:string,compacto=false){
  const obs=card.observacoes[s]
  const percent= s==='compras'?card.percentuais.compras:s==='producao'?card.percentuais.producao:
   s==='instalacao'?card.percentuais.instalacao:s==='financeiro'?card.percentuais.financeiro:undefined
  const atraso=!!card.previsao&&new Date(card.previsao+'T23:59:59').getTime()<Date.now()&&card.percentualGeral<100
  return <div key={s+card.id} draggable={pode(s,'movimentar')} onDragStart={e=>{
    e.dataTransfer.setData('text/plain',card.id);setArrastado({id:card.id,setor:s,origemId:origCard(card,s)})
   }} onDragEnd={()=>setArrastado(null)} role="button" tabIndex={0}
   onClick={()=>void detalheCard(card,s)}
   onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')void detalheCard(card,s)}}
   className={'rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md cursor-pointer '+(compacto?'min-w-[210px]':'')}>
   <div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-slate-900">{card.cliente}</p><span className="shrink-0 text-[10px] text-slate-500">#{card.numero}</span></div>
   <p className="mt-1 truncate text-xs text-slate-600">{card.obra}</p>
   {card.cidade&&<p className="mt-1 text-[11px] text-slate-500">{card.cidade}</p>}
   <div className="mt-3 flex justify-between text-xs"><span>Obra</span><b>{card.percentualGeral}%</b></div>
   <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{width:card.percentualGeral+'%'}}/></div>
   <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span>Setor: {pct(percent)}</span>
    {s==='compras'&&<span>Recebido: {pct(card.percentuais.mercadoria)}</span>}
    {!!obs?.comentarios&&<span className="inline-flex items-center gap-1 text-amber-700"><MessageSquare size={12}/>{obs.comentarios}</span>}
    {atraso&&<span className="font-bold text-red-700">Atrasada</span>}
   </div>
  </div>
 }
 function quadroOperacional(s:string,mini=false){
  if(s==='comercial'||s==='assistencia'){
   const n=dados?.nativos?.[s]
   if(!n)return <div className="rounded-xl bg-white p-4 text-sm text-slate-500">Resumo nativo indisponível.</div>
   return <section key={s} className="min-w-[320px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3">
    <div className="mb-3 flex justify-between gap-3"><h2 className="font-bold">{qTitulo(s)} — {n.cards.length} cards</h2>
     <Link href={QUADROS.find(q=>q.id===s)?.rota||'/kanban'} className="text-xs font-semibold text-blue-700">Abrir Kanban original ↗</Link></div>
    <div className="flex gap-3 overflow-x-auto pb-3">{n.colunas.map(col=><div key={col.id} className="w-[250px] shrink-0 rounded-xl bg-slate-100 p-2">
     <div className="mb-2 flex justify-between rounded-lg bg-white p-2 text-xs font-semibold"><span>{col.nome}</span><span>{n.cards.filter(x=>x.coluna_id===col.id).length}</span></div>
     <div className="space-y-2">{n.cards.filter(x=>x.coluna_id===col.id||(!x.coluna_id&&col.id===n.colunas[0]?.id)).map(x=><Link key={x.id} href={x.href}
      className="block rounded-lg border bg-white p-3 text-left shadow-sm hover:border-blue-500">
      <p className="font-bold text-slate-900">{x.cliente}</p><p className="mt-1 text-xs text-slate-600">{x.obra} · # {x.numero}</p><p className="mt-1 text-xs text-slate-500">{x.cidade}</p>
      <p className="mt-2 text-xs text-blue-700">Abrir e movimentar ↗</p>
     </Link>)}</div>
    </div>)}</div>
    <p className="text-xs text-slate-500">Os cards deste quadro continuam sendo movimentados no Kanban original para preservar as automações.</p>
   </section>
  }
  const cols=colunas(s)
  const colsVisuais=[...cols].sort((a,b)=>(a.ordem_visual??a.ordem)-(b.ordem_visual??b.ordem))
  if(!cols.length)return <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">Sem colunas configuradas para {qTitulo(s)}.</div>
  return <section key={s} className={'rounded-2xl border border-slate-200 bg-slate-50 p-3 '+(mini?'min-w-[320px] flex-1':'')}>
   <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h2 className="text-base font-bold text-slate-900">{qTitulo(s)} <span className="text-xs font-normal text-slate-500">({cardsVisiveis.length} obras)</span></h2>
    <div className="flex gap-2">
     {mini&&<button onClick={()=>selecionarQuadro(s)} className="text-xs font-semibold text-blue-700">Abrir quadro ↗</button>}
     {!mini&&pode(s,'administrar')&&<button className="rounded-lg border bg-white px-2 py-1.5 text-xs" onClick={()=>setConfig(!config)}><Settings2 size={14} className="inline"/> Configurar</button>}
     {!mini&&dados?.usuarioMaster&&<Link href="/kanban/configuracao-colunas" className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-800">Personalizar colunas</Link>}
    </div>
   </div>
   <div className={'flex gap-3 overflow-x-auto pb-4 '+(mini?'max-h-[70vh]':'min-h-[370px]')}>
    {colsVisuais.map(col=>{
     const itens=cardsVisiveis.filter(c=>origCard(c,s)===col.id)
     return <div key={col.id} onDragOver={e=>{if(pode(s,'movimentar'))e.preventDefault()}}
      onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(id&&arrastado?.setor===s)void mover(id,s,col.id);setArrastado(null)}}
      className="min-h-32 w-[245px] shrink-0 rounded-xl border border-slate-200 bg-slate-100/80 p-2 md:w-[280px]">
      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-800">
       <span>{col.nome_exibicao||col.nome}</span><span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-800">{itens.length}</span>
      </div>
      <div className="space-y-2">{itens.map(c=>cardVisual(c,s,mini))}</div>
     </div>
    })}
    {!mini&&pode(s,'administrar')&&<button onClick={()=>{setConfig(true);setNovaColuna('')}} className="flex w-40 shrink-0 items-start gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-600"><Plus size={16}/> Coluna</button>}
   </div>
  </section>
 }
 return <div ref={tela} className="mx-auto w-full max-w-[1800px] px-3 py-5 md:px-6 md:py-7">
  <div className="flex flex-wrap items-start justify-between gap-4">
   <div><h1 className="flex items-center gap-2 text-2xl font-black text-slate-950"><Columns3 className="text-blue-700"/>Central de Kanbans</h1>
    <p className="mt-1 text-sm text-slate-600">Acompanhe clientes e obras por setor. Cada card representa uma venda/obra.</p></div>
   <div className="flex flex-wrap gap-2">
    <button onClick={()=>void carregar()} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><RefreshCcw size={14} className="mr-1 inline"/> Atualizar</button>
    <button onClick={()=>void(tela.current?.requestFullscreen?.())} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><Fullscreen size={14} className="mr-1 inline"/> Tela cheia</button>
   </div>
  </div>
  {erro&&<div role="alert" className="my-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}
  {carregando&&!dados?<p className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-600">Carregando os Kanbans autorizados...</p>:null}
  {dados&&<>
   <div className="mt-5 flex flex-wrap gap-2">
    <button onClick={irGeral} className={'rounded-xl px-4 py-3 text-sm font-bold '+(modo==='geral'?'bg-slate-950 text-white':'border bg-white text-slate-800')}>Visão Geral</button>
    {dados.quadros.map(q=><button key={q.id} onClick={()=>selecionarQuadro(q.id)} className={'rounded-xl px-4 py-3 text-sm font-bold '+(setor===q.id&&modo==='setor'?'bg-blue-700 text-white':'border bg-white text-slate-700')}>{q.nome} {(q.id==='comercial'||q.id==='assistencia')?'↗':''}</button>)}
   </div>
   <div className="mt-4 flex flex-wrap gap-2">
    <input aria-label="Buscar cliente ou obra" value={filtro} onChange={e=>setFiltro(e.target.value)} placeholder="Buscar cliente, obra, cidade ou nº" className="min-w-[220px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"/>
    <select aria-label="Filtrar cidade" value={cidade} onChange={e=>setCidade(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Todas as cidades</option>{cidades.map(c=><option key={c}>{c}</option>)}</select>
    <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm"><input type="checkbox" checked={atrasados} onChange={e=>setAtrasados(e.target.checked)}/> Atrasadas</label>
    <button onClick={()=>setModo(modo==='monitor'?'geral':'monitor')} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">Monitorar selecionados</button>
   </div>
   <p className="mt-2 text-xs text-slate-500">Atualização automática a cada 60 segundos · Última atualização: {horario(ultimoRefresh)} · Percentuais usam dados operacionais; mover um card altera apenas a etapa de acompanhamento.</p>
   {modo==='geral'&&<section className="mt-5">
    <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Visão Geral da Empresa — {cardsVisiveis.length} obras</h2><span className="text-xs text-slate-500">Vendas e obras vinculadas</span></div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{cardsVisiveis.map(card=><button key={card.id} onClick={()=>void detalheCard(card)} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400">
     <div className="flex justify-between gap-2"><strong className="text-sm">{card.cliente}</strong><span className="text-xs text-slate-500">Venda #{card.numero}</span></div>
     <p className="my-1 text-xs text-slate-600">{card.obra}</p>
     <p className="text-xs font-bold text-blue-700">Andamento operacional: {card.percentualGeral}%</p>
     <div className="my-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:card.percentualGeral+'%'}}/></div>
     <div className="grid grid-cols-2 gap-1 text-xs text-slate-600">
      {setoresMedidos.filter(x=>pode(x.quadro)).map(x=><span key={x.id}>{x.nome}: <b>{pct(card.percentuais[x.id])}</b></span>)}
     </div><p className="mt-3 text-xs font-medium text-blue-700">Ver obra, histórico e comentários <ChevronRight size={13} className="inline"/></p>
    </button>)}</div>
    {!cardsVisiveis.length&&<p className="rounded-xl bg-white p-6 text-sm">Nenhuma obra com esses filtros.</p>}
   </section>}
   {modo==='setor'&&setor&&quadroOperacional(setor)}
   {modo==='monitor'&&<section className="mt-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Monitoramento de múltiplos Kanbans</h2>
     <div className="flex flex-wrap gap-3">{dados.quadros.map(q=><label key={q.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={monitor.includes(q.id)} onChange={e=>setMonitor(m=>e.target.checked?[...m,q.id]:m.filter(x=>x!==q.id))}/>{q.nome}</label>)}</div>
    </div>
    <div className="flex gap-3 overflow-x-auto pb-4">{monitor.filter(s=>pode(s)).map(s=>quadroOperacional(s,true))}</div>
   </section>}
   {modo==='setor'&&setor&&config&&pode(setor,'administrar')&&<section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-bold">Configurar o Kanban de {qTitulo(setor)}</h3>
    <p className="mt-1 text-xs text-slate-500">Colunas personalizadas e acessos por funcionário. Alterações de coluna não modificam pedidos, produção ou pagamentos.</p>
    <div className="mt-4 flex flex-wrap gap-2"><input value={novaColuna} onChange={e=>setNovaColuna(e.target.value)} placeholder="Nome da nova coluna" className="min-w-[200px] flex-1 rounded-lg border p-2 text-sm"/>
     <button disabled={salvando||novaColuna.trim().length<2} onClick={()=>void executar({acao:'coluna',setor,nome:novaColuna}).then(ok=>{if(ok)setNovaColuna('')})} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Adicionar coluna</button></div>
    <div className="mt-3 flex flex-wrap gap-2">{colunas(setor).map(c=><div key={c.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2 text-xs">
     <span>{c.nome}</span>
     <button onClick={()=>{const nome=prompt('Novo nome da coluna:',c.nome);if(nome&&nome!==c.nome)void executar({acao:'coluna',setor,id:c.id,nome})}} className="text-blue-700">Renomear</button>
     <button onClick={()=>{if(confirm('Excluir a coluna vazia '+c.nome+'?'))void executar({acao:'excluirColuna',setor,id:c.id})}} className="text-red-700">Excluir</button>
    </div>)}</div>
    {dados.funcionarios.length>0&&<div className="mt-5 border-t pt-4">
     <h4 className="text-sm font-bold">Permissões e responsável</h4><div className="mt-2 flex flex-wrap gap-2">
      <select value={funcionario} onChange={e=>{setFuncionario(e.target.value);const ac=dados.acessos.find(x=>x.setor===setor&&x.usuario_id===e.target.value);setNivel(ac?.nivel||'visualizar');setResponsavel(!!ac?.responsavel)}} className="rounded-lg border px-3 py-2 text-sm">
       <option value="">Escolha o funcionário</option>{dados.funcionarios.filter(u=>u.role!=='master').map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
      </select>
      <select value={nivel} onChange={e=>setNivel(e.target.value as NivelBoard)} className="rounded-lg border px-3 py-2 text-sm">
       <option value="oculto">Sem acesso</option><option value="visualizar">Visualizar</option><option value="movimentar">Visualizar e movimentar</option><option value="administrar">Administrar</option>
      </select><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={responsavel} onChange={e=>setResponsavel(e.target.checked)}/> Responsável pelo quadro</label>
      <button disabled={!funcionario||salvando} onClick={()=>void executar({acao:'permissao',setor,usuarioId:funcionario,nivel,responsavel})} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Salvar acesso</button>
     </div></div>}
   </section>}
  </>}
  {detalhe&&dados&&<div role="dialog" aria-modal="true" aria-label="Acompanhamento da obra" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-2 md:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setDetalhe(null)}}>
   <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl md:p-6">
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{detalhe.cliente}</h2><p className="text-sm text-slate-600">{detalhe.obra} · Venda #{detalhe.numero}</p>
     <p className="mt-1 text-sm font-bold text-blue-700">Progresso operacional {detalheAtual?.percentualGeral}%</p></div>
     <button aria-label="Fechar" onClick={()=>setDetalhe(null)} className="rounded-lg border p-2"><X size={19}/></button>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">{setoresMedidos.filter(x=>pode(x.quadro)).map(x=><button key={x.id} onClick={()=>setAbaDetalhe(x.quadro)} className={'rounded-xl border p-3 text-left '+(abaDetalhe===x.quadro?'border-blue-500 bg-blue-50':'border-slate-200')}>
     <div className="flex items-center justify-between text-xs"><b>{x.nome}</b><span>{pct(detalheAtual?.percentuais[x.id])}</span></div>
     <div className="mt-2 h-1.5 rounded-full bg-white"><div className="h-full rounded-full bg-blue-600" style={{width:(detalheAtual?.percentuais[x.id]||0)+'%'}}/></div>
    </button>)}</div>
    <div className="mt-3 flex flex-wrap gap-2">{dados.quadros.filter(q=>!setoresMedidos.some(x=>x.quadro===q.id)).map(q=><button key={q.id} onClick={()=>setAbaDetalhe(q.id)} className={'rounded-lg border px-2 py-1 text-xs '+(abaDetalhe===q.id?'bg-slate-900 text-white':'')}>{q.nome}</button>)}</div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Histórico e comentários — {qTitulo(abaDetalhe)}</h3>
     <Link href={'/clientes/'+detalhe.clienteId+'/vendas/'+detalhe.id} className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Abrir painel da venda <ArrowUpRight size={14}/></Link>
    </div>
    {pode(abaDetalhe,'movimentar')&&<div className="mt-3 space-y-2">
     <textarea value={comentario} onChange={e=>setComentario(e.target.value)} maxLength={2000} rows={2} placeholder="Ex.: Aguardando o cliente liberar a instalação..." className="w-full rounded-xl border border-slate-300 p-3 text-sm"/>
     <button disabled={salvando||!comentario.trim()} onClick={()=>void comentar()} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Registrar comentário</button>
    </div>}
    {['engenharia','compras','producao','instalacao','financeiro'].includes(abaDetalhe)&&pode(abaDetalhe,'movimentar')&&
     <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><label className="font-semibold">Mover acompanhamento para:</label>
      <select value={origCard(detalhe,abaDetalhe)} onChange={e=>void mover(detalhe.id,abaDetalhe,e.target.value)} className="max-w-full rounded-lg border px-2 py-2">
       {colunas(abaDetalhe).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
     </div>}
    <div className="mt-4 space-y-2">{comentarios.filter(c=>c.setor===abaDetalhe).map(c=><div key={c.id} className="rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex justify-between gap-2 text-xs text-slate-500"><b>{c.usuario_nome}</b><span>{horario(c.created_at)}</span></div><p className="mt-1 whitespace-pre-wrap">{c.texto}</p>
     </div>)}
     {historico.filter(h=>h.setor===abaDetalhe).map(h=><div key={h.id} className="rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
      <b>{h.usuario_nome}</b> · {horario(h.created_at)} · {h.coluna_anterior_nome||'Inicial'} → {h.coluna_nova_nome||'Etapa'}{h.motivo&&<p className="mt-1">Motivo: {h.motivo}</p>}
     </div>)}
     {!comentarios.some(c=>c.setor===abaDetalhe)&&!historico.some(h=>h.setor===abaDetalhe)&&<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Ainda não há registros nesta etapa.</p>}
    </div>
   </div>
  </div>}
 </div>
}
