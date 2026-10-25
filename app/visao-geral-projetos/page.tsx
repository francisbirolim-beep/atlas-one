'use client'
import {useCallback,useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,CalendarDays,CheckCircle2,ChevronRight,ClipboardList,Clock3,Columns3,Maximize2,Package,Plus,RefreshCw,Settings2,ShoppingCart,Truck,Warehouse,X} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {COLUNAS_GERAIS_PADRAO,criarColunaGeral,renomearColunaGeral,excluirColunaGeral,associarCriterioColuna,reordenarColunasGerais,validarColunasGerais,type ColunaVisualProjeto,type EtapaOperacional,ETAPAS_OPERACIONAIS} from '@/lib/visaoGeralProjetos'
import {DEMO_PEDIDOS,DEMO_PROJETOS,type PedidoGeralCard,type ProjetoGeralCard,type DetalheMaterialCompra} from '@/lib/visaoGeralDemo'

type Aba='resumo'|'etapas'|'pecas'|'compras'|'producao'|'instalacao'
const abas:[Aba,string][]=[['resumo','Visão geral'],['etapas','Etapas'],['pecas','Peças'],['compras','Compras'],['producao','Produção'],['instalacao','Instalação']]
const cores={
 verde:{rotulo:'No prazo',texto:'text-emerald-700',fundo:'bg-emerald-50',borda:'border-l-emerald-500',barra:'bg-emerald-500'},
 amarelo:{rotulo:'Atenção',texto:'text-amber-700',fundo:'bg-amber-50',borda:'border-l-amber-500',barra:'bg-amber-500'},
 vermelho:{rotulo:'Atrasado',texto:'text-rose-700',fundo:'bg-rose-50',borda:'border-l-rose-500',barra:'bg-rose-500'},
 azul:{rotulo:'Concluído',texto:'text-blue-700',fundo:'bg-blue-50',borda:'border-l-blue-500',barra:'bg-blue-500'},
 sem_prazo:{rotulo:'Sem prazo',texto:'text-slate-600',fundo:'bg-slate-100',borda:'border-l-slate-400',barra:'bg-slate-400'},
}
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const data=(v:string|null|undefined)=>v?new Date(v+'T12:00:00').toLocaleDateString('pt-BR'):'Não informado'
const percentual=(parte:number|null,total:number|null)=>total!==null&&total>0&&parte!==null?Math.min(100,Math.round(parte/total*100)):null
const rotuloTipo={perfil:'Perfis',vidro:'Vidros',acessorio:'Acessórios'}
function Barra({nome,valor,tom='bg-blue-500'}:{nome:string;valor:number|null;tom?:string}){
 return <div className="space-y-1"><div className="flex justify-between gap-2 text-[11px] text-slate-600"><span>{nome}</span><b className="text-slate-700">{valor===null?'Não apurado':valor+'%'}</b></div><div className="h-1.5 rounded-full bg-slate-100"><div className={'h-full rounded-full '+tom} style={{width:(valor??0)+'%'}}/></div></div>
}
function Card({card,abrir,compacto}:{card:ProjetoGeralCard;abrir:()=>void;compacto:boolean}){
 const cor=cores[card.cor]||cores.sem_prazo
 return <button type="button" onClick={abrir} className={'w-full border border-slate-200 border-l-4 bg-white text-left shadow-sm transition hover:border-blue-400 hover:shadow-md '+(compacto?'space-y-1.5 rounded-lg p-2 ':'space-y-3 rounded-xl p-3.5 ')+cor.borda}>
  <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className={compacto?"line-clamp-2 break-words text-[11px] font-extrabold leading-tight text-slate-900":"truncate text-[14px] font-extrabold text-slate-900"}>{card.cliente}</p><p className={compacto?"mt-0.5 text-[9px] font-semibold text-slate-500":"mt-1 text-[11px] font-semibold text-slate-500"}>Orçamento {card.numeroOrcamento||'não vinculado'}</p></div><ChevronRight size={16} className={compacto?"hidden":"shrink-0 text-slate-400"}/></div>
  <span className={'inline-flex rounded-md font-bold '+(compacto?'px-1 py-0.5 text-[9px] ':'px-2 py-1 text-[10px] ')+cor.fundo+' '+cor.texto}>{cor.rotulo}{card.diasAtraso>0?' · '+card.diasAtraso+'d':''}</span>
  <div className={compacto?"space-y-1":"space-y-2"}>{card.materiais.map(m=><Barra key={m.tipo} nome={compacto?rotuloTipo[m.tipo]:rotuloTipo[m.tipo]+' comprados'} valor={percentual(m.comprados,m.total)} tom={cor.barra}/>)}</div>
  {card.pendencias.length>0&&<p className={compacto?"line-clamp-2 break-words text-[9px] leading-tight font-medium text-amber-700":"line-clamp-2 text-[11px] font-medium text-amber-700"}>⚠ {card.pendencias[0]}</p>}
  <p className={compacto?"border-t pt-1 text-[9px] text-slate-500":"border-t pt-2 text-[11px] text-slate-500"}>Instalação: {card.instalacaoMes?card.instalacaoMes.slice(5)+'/'+card.instalacaoMes.slice(0,4):'A programar'}</p>
 </button>
}
function CartaoPedido({pedido,abrir,compacto}:{pedido:PedidoGeralCard;abrir:()=>void;compacto:boolean}){
 return <button type="button" onClick={abrir} className={"w-full border border-indigo-200 border-l-4 border-l-indigo-500 bg-indigo-50/60 text-left hover:border-indigo-400 "+(compacto?"space-y-1 rounded-lg p-2":"space-y-1.5 rounded-xl p-3")}>
 <p className={compacto?"break-words text-[11px] font-extrabold leading-tight text-slate-900":"text-sm font-extrabold text-slate-900"}>{pedido.cliente}</p><p className={compacto?"text-[9px] text-slate-600":"text-[11px] text-slate-600"}>Orçamento {pedido.numeroOrcamento||'sem vínculo confirmado'}</p><p className={compacto?"text-[9px] font-bold text-indigo-700":"text-[11px] font-bold text-indigo-700"}>Pedido de compra</p><p className={compacto?"line-clamp-2 text-[9px] text-slate-700":"text-xs text-slate-700"}>{pedido.descricao}</p><p className={compacto?"text-[9px] text-slate-500":"text-[11px] text-slate-500"}>{pedido.recebidos} de {pedido.itens} itens recebidos</p>
 </button>
}
function ItensDeCompra({itens}:{itens:DetalheMaterialCompra[]}){
 if(!itens.length)return <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">Não há pedidos detalhados vinculados com segurança a esta venda/obra.</p>
 return <div className="space-y-2">{itens.map(i=><div key={i.id} className="flex gap-3 rounded-lg border p-3">
  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50">
  {i.fotoUrl?<img src={i.fotoUrl} alt={'Foto do produto '+i.descricao} className="h-full w-full object-contain"/>:
   <span className="px-1 text-center text-[10px] font-medium text-amber-700">Imagem pendente</span>}
  </div><div className="min-w-0 flex-1 space-y-1">
   <b className="block text-xs text-slate-800">{i.descricao}</b>
   <p className="text-[11px] capitalize text-slate-500">{i.categoria} · {i.unidade}</p>
   <p className="text-[11px]">Necessário: {i.quantidade??'Não apurado'} · Comprado: {i.comprado??'Não apurado'} · Recebido: {i.recebido??'Não apurado'}</p>
   <p className="text-[11px] text-slate-600">Fornecedor: {i.fornecedor||'Não confirmado'} · Responsável pelo registro: {i.responsavelRegistro||'Não identificado'}</p>
  </div></div>)}</div>
}
export default function VisaoGeralProjetos(){
 const [demo,setDemo]=useState<boolean|null>(null),[colunas,setColunas]=useState<ColunaVisualProjeto[]>(COLUNAS_GERAIS_PADRAO)
 const [configuravel,setConfiguravel]=useState(false),[avisoConfiguracao,setAvisoConfiguracao]=useState('')
 const [cards,setCards]=useState<ProjetoGeralCard[]>([]),[pedidos,setPedidos]=useState<PedidoGeralCard[]>([])
 const [selecionado,setSelecionado]=useState<string|null>(null),[aba,setAba]=useState<Aba>('resumo')
 const [erro,setErro]=useState(''),[carregando,setCarregando]=useState(true),[atualizado,setAtualizado]=useState('')
 const [modoTv,setModoTv]=useState(false),[compacto,setCompacto]=useState(true),[config,setConfig]=useState(false),[novoNome,setNovoNome]=useState('')
 const [novoCriterio,setNovoCriterio]=useState<EtapaOperacional>('compras_liberacao'),[nomeEditando,setNomeEditando]=useState<Record<string,string>>({})
 const carregar=useCallback(async()=>{
  if(demo===null)return
  if(demo){setCards(DEMO_PROJETOS);setPedidos(DEMO_PEDIDOS);setCarregando(false);setAtualizado(new Date().toISOString());return}
  try{
   const token=await tokenAtual();if(!token)throw new Error('Faça login para consultar a visão geral.')
   const r=await fetch('/api/visao-geral-projetos',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const json=await r.json().catch(()=>({}));if(!r.ok)throw new Error(json.erro||'Falha ao carregar projetos')
   setCards((json.cards||[]).map((c:any)=>({...c,numeroOrcamento:c.numeroOrcamento||'Não identificado',instalacaoMes:c.instalacaoMes||null,materiais:c.materiais||[],pendencias:c.pendencias||[]})))
   setPedidos(json.pedidos||[]);setAtualizado(json.atualizadoEm||new Date().toISOString());setErro('')
  }catch(e){setErro(e instanceof Error?e.message:'Falha de atualização; mantendo os últimos dados válidos.')}
  finally{setCarregando(false)}
 },[demo])
 useEffect(()=>{setDemo(new URLSearchParams(window.location.search).get('demo')==='1')},[])
 useEffect(()=>{
  if(demo===null||demo)return
  let ativo=true
  async function carregarConfig(){
   try{const token=await tokenAtual();if(!token)return
    const r=await fetch('/api/visao-geral-colunas',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
    const j=await r.json().catch(()=>({}))
    if(ativo&&r.ok){setColunas(j.colunas||COLUNAS_GERAIS_PADRAO);setConfiguravel(j.configuravel===true);setAvisoConfiguracao(j.aviso||'')}
   }catch{}
  }
  void carregarConfig()
  return ()=>{ativo=false}
 },[demo])
 const podeEditarColunas=demo||configuravel
 async function salvarConfiguracao(){
  if(demo){setErro('As alterações da prévia ficam apenas nesta sessão.');return}
  if(!configuravel){setErro('A migração de configuração ainda não está homologada.');return}
  try{const token=await tokenAtual();const r=await fetch('/api/visao-geral-colunas',{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({colunas})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Falha ao salvar')
   setErro('');setAvisoConfiguracao('Configuração salva e auditada para a empresa.')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao salvar a configuração')}
 }

 useEffect(()=>{if(demo===null)return;void carregar();const timer=window.setInterval(()=>void carregar(),60_000);return()=>window.clearInterval(timer)},[carregar,demo])
 const cardAtual=useMemo(()=>cards.find(c=>c.vendaId===selecionado)||null,[cards,selecionado])
 const pedidoAtual=useMemo(()=>pedidos.find(p=>p.id===selecionado)||null,[pedidos,selecionado])
 const corCard=cardAtual?cores[cardAtual.cor]:null
 const agrupado=useMemo(()=>new Map(colunas.map(c=>[c.id,cards.filter(p=>c.criterios.includes(p.etapaOperacional as EtapaOperacional))])),[colunas,cards])
 const totais={ativos:cards.filter(c=>c.cor!=='azul').length,atrasados:cards.filter(c=>c.cor==='vermelho').length,atencao:cards.filter(c=>c.cor==='amarelo').length,finalizados:cards.filter(c=>c.cor==='azul').length}
 const abrir=(id:string)=>{setSelecionado(id);setAba('resumo')}
 function criar(){
  if(!podeEditarColunas){setErro('Configuração ainda em homologação. Use a prévia demonstrativa.');return}
  const nome=novoNome.trim();if(!nome)return
  try{setColunas(antigas=>criarColunaGeral(antigas,'manual_'+Date.now(),nome));setNovoNome('');setErro('')}
  catch(e){setErro(e instanceof Error?e.message:'Não foi possível criar coluna.')}
 }
 function renomear(id:string){try{setColunas(c=>renomearColunaGeral(c,id,nomeEditando[id]||''));setErro('')}catch(e){setErro(e instanceof Error?e.message:'Nome inválido')}}
 function vincular(id:string){try{setColunas(c=>associarCriterioColuna(c,novoCriterio,id));setErro('')}catch(e){setErro(e instanceof Error?e.message:'Vínculo inválido')}}
 function excluir(id:string){const destino=colunas.find(c=>c.id!==id);if(!destino)return;const escolhido=window.prompt('ID da coluna que receberá os vínculos de '+id+':',destino.id);if(!escolhido)return;try{setColunas(c=>excluirColunaGeral(c,id,escolhido));setErro('')}catch(e){setErro(e instanceof Error?e.message:'Não foi possível excluir')}}
 function ordem(id:string,passo:number){const ids=colunas.map(c=>c.id),i=ids.indexOf(id),j=i+passo;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];try{setColunas(c=>reordenarColunasGerais(c,ids))}catch(e){setErro(String(e))}}
 async function alternarModoTv(){
  if(!modoTv&&document.fullscreenEnabled)await document.documentElement.requestFullscreen().catch(()=>{})
  if(modoTv&&document.fullscreenElement)await document.exitFullscreen().catch(()=>{})
  setModoTv(v=>!v)
 }
 const validados=validarColunasGerais(colunas)
 return <main className="min-h-screen bg-[#f3f6fb] text-slate-900">
  {modoTv&&<style>{`.atlas-sidebar-shell,.atlas-topbar,.atlas-app-content > header,.atlas-mobile-navigation,.atlas-app-content > nav,.atlas-app-main > a{display:none!important}.atlas-app-content{height:100vh!important;overflow:auto!important}.atlas-app-main{padding:0!important;min-height:100vh!important}.atlas-app-shell{display:block!important}.atlas-app-main>div{width:100%!important}`}</style>}

  {!modoTv&&<div className="flex items-center gap-2 border-b bg-white px-5 py-3 text-sm"><Link href="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-blue-700"><ArrowLeft size={15}/> Atlas One</Link><span className="text-slate-300">/</span><strong>Visão Geral de Projetos</strong>{demo&&<span className="rounded bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">PRÉVIA FICTÍCIA</span>}</div>}
  <div className="space-y-4 px-3 py-5 md:px-6">
   <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold tracking-tight">Visão Geral de Projetos</h1><p className="text-sm text-slate-500">Cliente 360 · andamento operacional · atualização automática a cada minuto</p></div><div className="flex flex-wrap gap-2">
    <button onClick={()=>setCompacto(v=>!v)} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Columns3 size={16}/>{compacto?'Cards maiores':'Cards compactos'}</button>
    {!modoTv&&<button onClick={()=>setConfig(!config)} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Settings2 size={16}/> Colunas</button>}
    <Link href={'/relatorios/instalacoes'+(demo?'?demo=1':'')} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><CalendarDays size={16}/> Calendário</Link>
    <button onClick={()=>void carregar()} className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={16}/> Atualizar</button>
    <button onClick={()=>void alternarModoTv()} className="flex items-center gap-2 rounded-lg bg-[#132b58] px-3 py-2 text-sm font-semibold text-white"><Maximize2 size={16}/>{modoTv?'Sair da TV':'Modo TV'}</button>
   </div></header>
   {erro&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{erro}</p>}
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([
    ['Projetos ativos',totais.ativos,'text-blue-700','bg-blue-50'],['Em atraso',totais.atrasados,'text-rose-700','bg-rose-50'],['Atenção',totais.atencao,'text-amber-700','bg-amber-50'],['Finalizados',totais.finalizados,'text-emerald-700','bg-emerald-50']
   ] as const).map(([rotulo,numero,texto,fundo])=><div key={rotulo} className={'rounded-xl border bg-white p-3.5 shadow-sm '+fundo}><p className="text-xs font-semibold text-slate-600">{rotulo}</p><b className={'mt-1 block text-2xl '+texto}>{numero}</b></div>)}</div>
   {config&&!modoTv&&<section className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-bold">Configurar etapas visuais {demo?'· prévia local':configuravel?'· configuração da empresa':'· aguardando migração'}</h2><p className="text-xs text-slate-500">Apenas Master edita. Nomes não alteram os setores reais. Colunas novas recebem vínculo de etapa quando configuradas. {demo?'Esta prévia não grava alterações.':'No modo real, clique em Salvar configuração para persistir.'} {avisoConfiguracao}</p><div className="flex flex-wrap gap-2"><input aria-label="Nova coluna" placeholder="Nome da nova coluna" value={novoNome} onChange={e=>setNovoNome(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"/><button disabled={!podeEditarColunas} onClick={criar} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">+ Criar coluna</button></div>
   <div className="flex flex-wrap items-center gap-2 text-xs"><span>Etapa operacional para associar:</span><select value={novoCriterio} onChange={e=>setNovoCriterio(e.target.value as EtapaOperacional)} className="rounded border px-2 py-1">{ETAPAS_OPERACIONAIS.map(x=><option key={x}>{x}</option>)}</select></div>
   <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{colunas.map(c=><div key={c.id} className="space-y-2 rounded-lg border p-3"><p className="text-xs text-slate-400">Etapa {c.ordem+1} · {c.criterios.length} vínculo(s)</p><input aria-label={'Nome da coluna '+c.nome} disabled={!podeEditarColunas} value={nomeEditando[c.id]??c.nome} onChange={e=>setNomeEditando(a=>({...a,[c.id]:e.target.value}))} className="w-full rounded border p-2 text-sm disabled:bg-slate-50"/><div className="flex flex-wrap gap-1">{[
    ['Salvar',()=>renomear(c.id)],['←',()=>ordem(c.id,-1)],['→',()=>ordem(c.id,1)],['Vincular',()=>vincular(c.id)],['Excluir',()=>excluir(c.id)]
   ].map(([titulo,acao])=><button key={titulo as string} disabled={!podeEditarColunas} onClick={acao as ()=>void} className="rounded border px-2 py-1 text-[11px] disabled:opacity-40">{titulo as string}</button>)}</div></div>)}</div>
   {!!validados.length&&<p className="text-xs text-rose-600">{validados.join(', ')}</p>}
   {!demo&&configuravel&&<button onClick={()=>void salvarConfiguracao()} disabled={!!validados.length} className="rounded-lg bg-[#132b58] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar configuração da empresa</button>}</section>}
   <p className="text-right text-[11px] text-slate-500">{carregando?'Carregando dados…':atualizado?'Última atualização: '+new Date(atualizado).toLocaleString('pt-BR'):'Aguardando atualização'}</p>
   <div className={compacto?"grid items-start gap-1.5 overflow-x-auto pb-5":"flex gap-3 overflow-x-auto pb-5"} style={compacto?{gridTemplateColumns:"repeat("+colunas.length+",minmax(110px,1fr))"}:undefined} aria-label="Kanban Geral de Projetos">{[...colunas].sort((a,b)=>a.ordem-b.ordem).map(col=>{
    const projetos=agrupado.get(col.id)||[],seusPedidos=pedidos.filter(p=>col.criterios.includes(p.status==='aguardando'?'aguardando_materiais':'compras'))
    return <section key={col.id} className={compacto?"min-h-[420px] min-w-0 rounded-lg border border-slate-200 bg-[#eaf0f8] p-1.5":"min-h-[420px] w-[265px] shrink-0 rounded-xl border border-slate-200 bg-[#eaf0f8] p-2.5"}><div className={compacto?"mb-2 flex items-start justify-between gap-1 px-0.5":"mb-3 flex items-center justify-between gap-2 px-1"}><h2 className={compacto?"break-words text-[10px] font-extrabold leading-tight text-slate-800":"text-[13px] font-extrabold text-slate-800"}>{col.nome}</h2><span className={compacto?"shrink-0 rounded-full bg-white px-1 py-0.5 text-[9px] font-bold":"rounded-full bg-white px-2 py-1 text-xs font-bold"}>{projetos.length}{seusPedidos.length?' + '+seusPedidos.length:''}</span></div><div className={compacto?"space-y-1.5":"space-y-2.5"}>{projetos.map(c=><Card key={c.vendaId} card={c} compacto={compacto} abrir={()=>abrir(c.vendaId)}/>)}{seusPedidos.map(p=><CartaoPedido key={p.id} pedido={p} compacto={compacto} abrir={()=>abrir(p.id)}/>)}{!projetos.length&&!seusPedidos.length&&<p className="rounded-lg border border-dashed bg-white/40 p-5 text-center text-xs text-slate-400">Nenhum card nesta etapa</p>}</div></section>
   })}</div>
  </div>
  {(cardAtual||pedidoAtual)&&<div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" onClick={()=>setSelecionado(null)}><aside role="dialog" aria-modal="true" aria-label="Detalhes do projeto" onClick={e=>e.stopPropagation()} className="flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-white shadow-2xl">
   <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">{pedidoAtual?'Pedido de compra':'Detalhes do projeto'}</p><h2 className="mt-1 text-xl font-extrabold">{cardAtual?.cliente||pedidoAtual?.cliente}</h2><p className="text-sm text-slate-500">Orçamento {cardAtual?.numeroOrcamento||pedidoAtual?.numeroOrcamento||'não vinculado'}</p></div><button aria-label="Fechar detalhes" onClick={()=>setSelecionado(null)} className="rounded-lg border p-2"><X size={19}/></button></header>
   {pedidoAtual?<section className="space-y-4 p-5"><p className="font-bold text-slate-700">{pedidoAtual.descricao}</p><p className="text-sm">Situação: {pedidoAtual.status==='aguardando'?'Comprado / aguardando recebimento':'Em compras'}</p><Barra nome="Itens recebidos" valor={percentual(pedidoAtual.recebidos,pedidoAtual.itens)}/><ItensDeCompra itens={pedidoAtual.detalhesCompra||[]}/>{demo?<p className="text-xs text-amber-800">Dados ilustrativos da prévia.</p>:<Link className="font-semibold text-blue-700 underline" href="/compras/solicitacoes">Abrir pedido no setor Compras</Link>}</section>:cardAtual&&<>
    <nav className="flex flex-wrap gap-1 border-b p-3">{abas.map(([id,rotulo])=><button key={id} onClick={()=>setAba(id)} className={'rounded-lg px-3 py-2 text-xs font-bold '+(aba===id?'bg-blue-700 text-white':'bg-slate-100 text-slate-600')}>{rotulo}</button>)}</nav>
    <div className="space-y-4 p-5">
     {corCard&&<div className={'rounded-xl p-3 '+corCard.fundo+' '+corCard.texto}><b>{corCard.rotulo}</b>{cardAtual.diasAtraso>0&&<span> · {cardAtual.diasAtraso} dias de atraso</span>}</div>}
     {(aba==='resumo'||aba==='etapas')&&<section className="space-y-3 rounded-xl border p-4"><h3 className="font-extrabold">Andamento do projeto</h3><p className="text-sm text-slate-600">Etapa principal: <b>{colunas.find(c=>c.criterios.includes(cardAtual.etapaOperacional as EtapaOperacional))?.nome||cardAtual.colunaId}</b></p><p className="text-sm text-slate-600">Previsão de entrega: <b>{data(cardAtual.previsaoEntrega)}</b></p>{aba==='etapas'&&colunas.map(c=><p key={c.id} className="border-b pb-2 text-sm text-slate-600">{c.nome}: <b>{c.criterios.includes(cardAtual.etapaOperacional as EtapaOperacional)?'Etapa atual':'Consultar histórico'}</b></p>)}</section>}
     {(aba==='resumo'||aba==='compras'||aba==='pecas')&&<section className="space-y-3 rounded-xl border p-4"><h3 className="font-extrabold">{aba==='pecas'?'Materiais e tipologias':'Compras por categoria'}</h3>{cardAtual.materiais.map(m=><div key={m.tipo} className="space-y-2 border-b pb-3 last:border-0"><b className="text-sm">{rotuloTipo[m.tipo]}</b><Barra nome="Comprado" valor={percentual(m.comprados,m.total)}/><Barra nome="Recebido" valor={percentual(m.recebidos,m.total)} tom="bg-emerald-500"/><p className="text-[11px] text-slate-500">{m.total===null?'Quantidade ainda não conciliada':m.total+' itens previstos · '+(m.comprados??'—')+' comprados · '+(m.recebidos??'—')+' recebidos'}</p></div>)}<p className="text-xs text-slate-500">Materiais por pedido vinculados à obra. Fotos são carregadas exclusivamente do produto cadastrado; se faltar, aparece Imagem pendente.</p>
   <ItensDeCompra itens={cardAtual.detalhesCompra||[]}/></section>}
     {(aba==='resumo'||aba==='producao')&&<section className="rounded-xl border p-4"><h3 className="font-extrabold">Produção</h3><p className="mt-2 text-sm">{cardAtual.producao.concluidas} de {cardAtual.producao.total} ordens concluídas</p><Barra nome="Conclusão de OPs" valor={percentual(cardAtual.producao.concluidas,cardAtual.producao.total)}/></section>}
     {(aba==='resumo'||aba==='instalacao')&&<section className="space-y-2 rounded-xl border p-4"><h3 className="font-extrabold">Planejamento de instalação</h3><p className="text-sm">Mês previsto: <b>{cardAtual.instalacaoMes||'Não programado'}</b></p><p className="text-sm">Instalações concluídas: <b>{cardAtual.instalacao.concluidas}/{cardAtual.instalacao.total}</b></p>{cardAtual.valorInstalacao!==null&&cardAtual.valorInstalacao!==undefined&&<p className="text-sm">Valor planejado: <b>{moeda(cardAtual.valorInstalacao)}</b></p>}<Link href={'/relatorios/instalacoes'+(demo?'?demo=1':'')} className="inline-flex items-center gap-2 text-sm font-bold text-blue-700"><CalendarDays size={15}/> Abrir calendário de instalação</Link></section>}
     {!!cardAtual.pendencias.length&&<section className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="mb-2 font-bold text-amber-900">O que falta resolver</h3>{cardAtual.pendencias.map(p=><p key={p} className="mb-1 text-sm text-amber-800">• {p}</p>)}</section>}
     {!demo&&<div className="flex flex-wrap gap-2"><Link href={'/clientes/'+cardAtual.clienteId+'/vendas/'+cardAtual.vendaId} className="rounded-lg bg-[#132b58] px-3 py-2 text-sm font-semibold text-white">Abrir Cliente 360</Link><Link href="/compras/solicitacoes" className="rounded-lg border px-3 py-2 text-sm font-semibold">Abrir Compras</Link></div>}
     {demo&&<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Prévia demonstrativa: clientes, percentuais, valores e prazos são fictícios. Nenhuma ação altera o Cliente 360.</p>}
    </div></>}
  </aside></div>}
 </main>
}
