'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import {
 ArrowLeft,ArrowRight,ArrowUpRight,BarChart3,Building2,CalendarDays,CheckCircle2,
 ChevronLeft,ChevronRight,ClipboardCheck,Clock3,Columns3,Factory,Filter,
 Layers3,Maximize2,Package,Plus,RefreshCw,Settings2,ShieldCheck,
 ShoppingCart,Truck,Warehouse,X,AlertTriangle,History,ImageOff,Info,
} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {
 COLUNAS_GERAIS_PADRAO,criarColunaGeral,renomearColunaGeral,excluirColunaGeral,
 associarCriterioColuna,reordenarColunasGerais,validarColunasGerais,
 type ColunaVisualProjeto,type EtapaOperacional,ETAPAS_OPERACIONAIS,
} from '@/lib/visaoGeralProjetos'
import {
 DEMO_PEDIDOS,DEMO_PROJETOS,
 type PedidoGeralCard,type ProjetoGeralCard,type DetalheMaterialCompra,type MaterialResumo,
} from '@/lib/visaoGeralDemo'

type Aba='resumo'|'materiais'|'compras'|'producao'|'instalacao'|'historico'
type Condicao='todos'|'atrasados'|'atencao'|'sem_prazo'
const ABAS: {id:Aba;label:string}[]=[
 {id:'resumo',label:'Visão Geral'},{id:'materiais',label:'Materiais'},
 {id:'compras',label:'Compras'},{id:'producao',label:'Produção'},
 {id:'instalacao',label:'Instalação'},{id:'historico',label:'Histórico'},
]
const COLUNA_CORES=[
 {cabecalho:'#079c51',botao:'#11b866',base:'#082f28',icone:CheckCircle2},
 {cabecalho:'#0759e8',botao:'#2679fb',base:'#092345',icone:Warehouse},
 {cabecalho:'#6417e9',botao:'#8137fa',base:'#29154a',icone:ShoppingCart},
 {cabecalho:'#fa5208',botao:'#fc7224',base:'#45251b',icone:CalendarDays},
 {cabecalho:'#ed0c41',botao:'#fc315d',base:'#471b2c',icone:ClipboardCheck},
 {cabecalho:'#d99500',botao:'#f1b510',base:'#403014',icone:Factory},
 {cabecalho:'#e60d74',botao:'#f52d8a',base:'#401b36',icone:Truck},
 {cabecalho:'#077e85',botao:'#0caaae',base:'#113639',icone:CheckCircle2},
]
const tipos=['perfil','vidro','acessorio'] as const
const nomes:{[key in MaterialResumo['tipo']]:string}={perfil:'Perfis',vidro:'Vidros',acessorio:'Acessórios'}
const moeda=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const dataBr=(v:string|null|undefined)=>v&&/^\d{4}-\d\d-\d\d/.test(v)
 ? new Date(v.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR'):'Não informada'
const percentual=(parcial:number|null,total:number|null)=>total!==null&&total>0&&parcial!==null
 ?Math.max(0,Math.min(100,Math.round(parcial/total*100))):null
const porcento=(v:number|null)=>v===null?'Não apurado':v+'%'
const corPorValor=(v:number|null)=>v===null?'#94a3b8':v>=90?'#20c76b':v>=50?'#388dff':v>=25?'#edb616':'#f36b75'
const etapaIndice=(col:ColunaVisualProjeto)=>COLUNAS_GERAIS_PADRAO.findIndex(x=>x.id===col.id)
const fotoSegura=(v:unknown):v is string=>typeof v==='string'&&/^https?:\/\//i.test(v)&&!/\.(pdf|zip)(\?|$)/i.test(v)

function Progresso({nome,valor,compacto=false}:{nome:string;valor:number|null;compacto?:boolean}){
 return <div className="flex items-center gap-2 text-[11px] leading-4 text-slate-700">
   <span className={compacto?'w-[57px] shrink-0':'w-[68px] shrink-0'}>{nome}</span>
   <div className="h-[8px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#e5eaf3]">
     <div className="h-full rounded-full transition-all" style={{width:valor===null?'0%':valor+'%',backgroundColor:corPorValor(valor)}}/>
   </div>
   <b className="w-[69px] shrink-0 text-right text-[10px] font-semibold">{porcento(valor)}</b>
 </div>
}
function FotoReal({url,alt,classe}:{url?:string|null;alt:string;classe?:string}){
 const [falhou,setFalhou]=useState(false)
 useEffect(()=>{setFalhou(false)},[url])
 return <div className={'relative overflow-hidden rounded-md border border-slate-200 bg-gradient-to-br from-[#e1e8f3] via-[#f3f6fa] to-[#dae4f1] '+(classe||'')}>
  {fotoSegura(url)&&!falhou?
   // A imagem precisa ser a foto realmente vinculada ao orçamento; nunca gerar casa fictícia.
   <img src={url} alt={alt} loading="lazy" onError={()=>setFalhou(true)} className="h-full w-full object-cover"/>:
   <div className="flex h-full min-h-16 flex-col items-center justify-center gap-1 px-2 text-center text-slate-400">
    <ImageOff size={23} strokeWidth={1.5}/>
    <span className="text-[10px] font-semibold leading-tight">Imagem ainda não cadastrada</span>
   </div>
  }
 </div>
}
function CardProjeto({card,compacto,abrir,ativo}:{card:ProjetoGeralCard;compacto:boolean;abrir:()=>void;ativo:boolean}){
 const materias=Object.fromEntries(card.materiais.map(m=>[m.tipo,percentual(m.comprados,m.total)])) as Record<string,number|null>
 return <button type="button" onClick={abrir} aria-pressed={ativo}
  className={'group w-full min-w-0 rounded-lg border bg-white text-left shadow-[0_2px_9px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_5px_18px_rgba(0,0,0,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 '+
  (ativo?'border-[3px] border-blue-500':'border-[#d8e1f0]')+' '+(compacto?'p-2':'p-3')}>
  <p className="line-clamp-2 min-h-[28px] text-[11px] font-extrabold leading-[14px] text-[#092044]" title={card.cliente}>Cliente: {card.cliente}</p>
  <p className="mt-0.5 truncate text-[10px] text-[#192c50]">Orçamento: <b>{card.numeroOrcamento||'Não vinculado'}</b></p>
  <FotoReal url={card.fotoProjetoUrl} alt={'Foto vinculada ao orçamento de '+card.cliente} classe={(compacto?'h-[72px]':'h-[110px]')+' mt-2 w-full'}/>
  <div className="mt-2 space-y-[5px]">
   {tipos.map(tipo=><Progresso key={tipo} nome={nomes[tipo]} valor={materias[tipo]??null} compacto/>)}
  </div>
  {card.compras.total>0&&<p className="mt-2 line-clamp-2 border-t border-slate-100 pt-1 text-[10px] text-blue-700">
   <ShoppingCart size={11} className="mr-1 inline"/> {card.compras.comprados} de {card.compras.total} itens comprados
  </p>}
  {card.pendencias.length>0&&<p className="mt-1 line-clamp-2 rounded bg-amber-50 px-1.5 py-1 text-[10px] leading-3 text-amber-800">
   <AlertTriangle size={11} className="mr-1 inline"/> {card.pendencias[0]}
  </p>}
  <div className="mt-2 flex items-start gap-1.5 border-t border-slate-100 pt-2 text-[10px] leading-3 text-[#334d76]">
   <CalendarDays size={13} className="shrink-0 text-blue-600"/>
   <span>Instalação prevista<br/><b>{card.dataInstalacao?dataBr(card.dataInstalacao):card.instalacaoMes||'A programar'}</b></span>
  </div>
 </button>
}
function CardPedido({pedido,abrir}:{pedido:PedidoGeralCard;abrir:()=>void}){
 const foto=pedido.detalhesCompra?.find(i=>fotoSegura(i.fotoUrl))?.fotoUrl
 return <button onClick={abrir} type="button" className="w-full rounded-lg border-l-[3px] border-l-violet-500 bg-white p-2.5 text-left shadow-md hover:ring-2 hover:ring-violet-400">
  <p className="line-clamp-2 text-[11px] font-extrabold text-[#162b50]">Cliente: {pedido.cliente}</p>
  <p className="text-[10px] text-slate-600">Orçamento: {pedido.numeroOrcamento||'Sem vínculo confirmado'}</p>
  {foto&&<FotoReal url={foto} alt={'Produto do pedido '+pedido.descricao} classe="mt-2 h-20 w-full"/>}
  <div className="mt-2 flex items-center gap-1 font-bold text-violet-700"><ShoppingCart size={13}/><span className="text-[10px]">Pedido de compra</span></div>
  <p className="mt-1 line-clamp-2 text-[10px] text-slate-600">{pedido.descricao}</p>
  <p className="mt-1 text-[10px] text-slate-500">{pedido.recebidos} de {pedido.itens} itens recebidos</p>
 </button>
}
function ItensCompra({itens}:{itens:DetalheMaterialCompra[]}){
 if(!itens.length)return <p className="rounded-lg border border-dashed p-3 text-xs text-slate-500">Não há itens de compra vinculados com segurança a esta obra.</p>
 return <div className="space-y-2">{itens.map(i=><div key={i.id} className="flex gap-3 rounded-lg border border-slate-200 bg-white p-2">
   <FotoReal url={i.fotoUrl} alt={'Foto do produto '+i.descricao} classe="h-[77px] w-[82px] shrink-0"/>
   <div className="min-w-0 flex-1">
    <p className="line-clamp-2 text-[11px] font-bold text-slate-800">{i.descricao}</p>
    <p className="text-[10px] capitalize text-slate-500">{i.categoria}</p>
    <p className="text-[10px] text-slate-600">Necessário: {i.quantidade??'Não apurado'} {i.unidade}</p>
    <p className="text-[10px] text-slate-600">Comprado: {i.comprado??'—'} · Recebido: {i.recebido??'—'}</p>
    <p className="line-clamp-1 text-[10px] text-slate-500">Fornecedor: {i.fornecedor||'Não identificado'}</p>
   </div>
  </div>)}</div>
}
function Calendario({dia}:{dia?:string|null}){
 const base=dia&&/^\d{4}-\d\d-\d\d$/.test(dia)?new Date(dia+'T12:00:00'):new Date()
 const [mes,setMes]=useState(()=>new Date(base.getFullYear(),base.getMonth(),1))
 useEffect(()=>{setMes(new Date(base.getFullYear(),base.getMonth(),1))},[dia])
 const anos=mes.getFullYear(),m=mes.getMonth(),inicio=new Date(anos,m,1).getDay(),quantidade=new Date(anos,m+1,0).getDate()
 const label=mes.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})
 return <div>
  <div className="mb-2 flex items-center justify-between"><button type="button" aria-label="Mês anterior" onClick={()=>setMes(x=>new Date(x.getFullYear(),x.getMonth()-1,1))} className="rounded p-1 hover:bg-slate-100"><ChevronLeft size={16}/></button><b className="text-xs capitalize">{label}</b><button type="button" aria-label="Mês seguinte" onClick={()=>setMes(x=>new Date(x.getFullYear(),x.getMonth()+1,1))} className="rounded p-1 hover:bg-slate-100"><ChevronRight size={16}/></button></div>
  <div className="grid grid-cols-7 text-center text-[9px] text-slate-500">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(w=><div key={w} className="py-2">{w}</div>)}</div>
  <div className="grid grid-cols-7 text-center">{Array.from({length:inicio},(_,i)=><div key={'a'+i}/>)}{Array.from({length:quantidade},(_,i)=>{
    const atual=new Date(anos,m,i+1),marcado=!!dia&&atual.toISOString().slice(0,10)===dia
    return <div key={i} className="p-0.5"><span className={'mx-auto grid h-7 w-7 place-items-center rounded-lg text-[10px] '+(marcado?'bg-blue-600 font-bold text-white':'text-slate-700')}>{i+1}</span></div>
  })}</div>
  <p className="mt-2 rounded-lg bg-blue-50 px-2 py-2 text-[11px] text-blue-900"><CalendarDays size={13} className="mr-1 inline"/> {dia?'Previsão cadastrada: '+dataBr(dia):'Nenhuma data de instalação programada no Atlas.'}</p>
 </div>
}

export default function VisaoGeralProjetos(){
 const [demo,setDemo]=useState<boolean|null>(null),[colunas,setColunas]=useState<ColunaVisualProjeto[]>(COLUNAS_GERAIS_PADRAO)
 const [configuravel,setConfiguravel]=useState(false),[avisoConfiguracao,setAvisoConfiguracao]=useState('')
 const [cards,setCards]=useState<ProjetoGeralCard[]>([]),[pedidos,setPedidos]=useState<PedidoGeralCard[]>([])
 const [selecionado,setSelecionado]=useState<string|null>(null),[aba,setAba]=useState<Aba>('resumo')
 const [erro,setErro]=useState(''),[carregando,setCarregando]=useState(true),[atualizado,setAtualizado]=useState('')
 const [modoTv,setModoTv]=useState(false),[compacto,setCompacto]=useState(false),[config,setConfig]=useState(false),[novoNome,setNovoNome]=useState('')
 const [filtros,setFiltros]=useState(false),[busca,setBusca]=useState(''),[condicao,setCondicao]=useState<Condicao>('todos')
 const [novoCriterio,setNovoCriterio]=useState<EtapaOperacional>('compras_liberacao'),[nomeEditando,setNomeEditando]=useState<Record<string,string>>({})
 const [fechou,setFechou]=useState(false)
 const selecionadoInicial=useRef(false)
 const carregar=useCallback(async()=>{
  if(demo===null)return
  if(demo){setCards(DEMO_PROJETOS);setPedidos(DEMO_PEDIDOS);setCarregando(false);setAtualizado(new Date().toISOString());return}
  try{const token=await tokenAtual();if(!token)throw Error('Faça login para consultar a visão geral.')
   const r=await fetch('/api/visao-geral-projetos',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Falha na consulta da empresa')
   setCards((j.cards||[]).map((c:ProjetoGeralCard)=>({...c,materiais:c.materiais||[],pendencias:c.pendencias||[],detalhesCompra:c.detalhesCompra||[]})))
   setPedidos(j.pedidos||[]);setAtualizado(j.atualizadoEm||new Date().toISOString());setErro('')
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao consultar a empresa.')}
  finally{setCarregando(false)}
 },[demo])
 useEffect(()=>{setDemo(new URLSearchParams(window.location.search).get('demo')==='1')},[])
 useEffect(()=>{
  if(demo===null||demo)return
  let ativo=true
  void(async()=>{try{
   const token=await tokenAtual();if(!token)return
   const r=await fetch('/api/visao-geral-colunas',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json().catch(()=>({}))
   if(ativo&&r.ok){setColunas(j.colunas||COLUNAS_GERAIS_PADRAO);setConfiguravel(j.configuravel===true);setAvisoConfiguracao(j.aviso||'')}
  }catch{}})()
  return()=>{ativo=false}
 },[demo])
 useEffect(()=>{if(demo===null)return;void carregar();const timer=window.setInterval(()=>void carregar(),60_000);return()=>clearInterval(timer)},[demo,carregar])
 useEffect(()=>{
  if(!cards.length||selecionadoInicial.current||fechou||typeof window==='undefined')return
  selecionadoInicial.current=true
  if(window.innerWidth>=1280)setSelecionado(cards[0].vendaId)
 },[cards,fechou])
 const podeEditarColunas=demo===true||configuravel
 const cardAtual=useMemo(()=>cards.find(c=>c.vendaId===selecionado)||null,[cards,selecionado])
 const pedidoAtual=useMemo(()=>pedidos.find(p=>p.id===selecionado)||null,[pedidos,selecionado])
 const fechar=()=>{setSelecionado(null);setFechou(true)}
 const abrir=(id:string)=>{setSelecionado(id);setAba('resumo');setFechou(false)}
 const visiveis=useMemo(()=>cards.filter(c=>{
  const q=busca.trim().toLocaleLowerCase('pt-BR')
  if(q&&![c.cliente,c.projeto,c.numeroOrcamento].some(s=>s?.toLocaleLowerCase('pt-BR').includes(q)))return false
  if(condicao==='atrasados'&&c.cor!=='vermelho')return false
  if(condicao==='atencao'&&c.cor!=='amarelo')return false
  if(condicao==='sem_prazo'&&c.cor!=='sem_prazo')return false
  return true
 }),[cards,busca,condicao])
 const pedidosVisiveis=useMemo(()=>pedidos.filter(p=>{
  if(condicao!=='todos')return false
  const q=busca.trim().toLocaleLowerCase('pt-BR')
  return !q||[p.cliente,p.numeroOrcamento||'',p.descricao].some(s=>s.toLocaleLowerCase('pt-BR').includes(q))
 }),[pedidos,busca,condicao])
 const colunasOrdenadas=useMemo(()=>[...colunas].sort((a,b)=>a.ordem-b.ordem),[colunas])
 const agrupado=useMemo(()=>new Map(colunas.map(c=>[c.id,visiveis.filter(p=>c.criterios.includes(p.etapaOperacional as EtapaOperacional))])),[colunas,visiveis])
 const ativos=cards.filter(c=>c.etapaOperacional!=='finalizado')
 const totalEmAndamento=ativos.filter(c=>c.etapaOperacional!=='vendido'&&c.etapaOperacional!=='conferir_projeto').length
 const atrasados=ativos.filter(c=>c.cor==='vermelho').length
 const finalizados=cards.length-ativos.length
 const instalacaoMesAtual=new Date().toISOString().slice(0,7)
 const previstoInstalacao=ativos.filter(c=>c.instalacaoMes===instalacaoMesAtual).length
 const montarKPIs=[
  {label:'Projetos no total',numero:cards.length,detalhe:'Vendas vinculadas',cor:'#147dff',icone:Layers3},
  {label:'Em andamento',numero:totalEmAndamento,detalhe:cards.length?Math.round(totalEmAndamento/cards.length*100)+'% dos projetos':'Sem registros',cor:'#0bc985',icone:BarChart3},
  {label:'Atrasados',numero:atrasados,detalhe:'Com prazo vencido',cor:'#e9a10e',icone:AlertTriangle},
  {label:'Finalizados',numero:finalizados,detalhe:'Concluídos no fluxo',cor:'#147dff',icone:CheckCircle2},
  {label:'Previstos para instalação',numero:previstoInstalacao,detalhe:'Neste mês',cor:'#267efa',icone:CalendarDays},
 ]
 const validade=validarColunasGerais(colunas)
 function criar(){try{if(!podeEditarColunas)throw Error('Somente Master configura etapas.');if(!novoNome.trim())return
  setColunas(a=>criarColunaGeral(a,'manual_'+Date.now(),novoNome));setNovoNome('');setErro('')
 }catch(e){setErro(String(e))}}
 function renomear(id:string){try{setColunas(c=>renomearColunaGeral(c,id,nomeEditando[id]||''));setErro('')}catch(e){setErro(String(e))}}
 function vincular(id:string){try{setColunas(c=>associarCriterioColuna(c,novoCriterio,id));setErro('')}catch(e){setErro(String(e))}}
 function excluir(id:string){const dest=colunas.find(c=>c.id!==id);if(!dest)return
  const resposta=window.prompt('ID da coluna de destino dos vínculos (nenhum projeto será excluído):',dest.id);if(!resposta)return
  try{setColunas(c=>excluirColunaGeral(c,id,resposta));setErro('')}catch(e){setErro(String(e))}
 }
 function ordem(id:string,d:number){const ids=colunasOrdenadas.map(c=>c.id),i=ids.indexOf(id),j=i+d;if(j<0||j>=ids.length)return
  ;[ids[i],ids[j]]=[ids[j],ids[i]];try{setColunas(c=>reordenarColunasGerais(c,ids))}catch(e){setErro(String(e))}
 }
 async function salvarConfig(){
  if(demo){setAvisoConfiguracao('Prévia fictícia: configuração não foi gravada.');return}
  if(!configuravel){setErro('Acesso reservado ao Master.');return}
  try{const token=await tokenAtual();if(!token)throw Error('Sessão expirada')
   const r=await fetch('/api/visao-geral-colunas',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({colunas})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Erro ao salvar')
   setErro('');setAvisoConfiguracao('Configuração salva e auditada na empresa.')
  }catch(e){setErro(String(e))}
 }
 async function alternarTV(){
  if(!modoTv&&document.fullscreenEnabled)await document.documentElement.requestFullscreen().catch(()=>{})
  if(modoTv&&document.fullscreenElement)await document.exitFullscreen().catch(()=>{})
  setModoTv(v=>!v)
 }
 const etapaCard=cardAtual?colunasOrdenadas.find(c=>c.criterios.includes(cardAtual.etapaOperacional as EtapaOperacional)):null
 const percentuais=cardAtual?cardAtual.materiais.map(m=>percentual(m.comprados,m.total)).filter((n):n is number=>n!==null):[]
 const progressoGeral=percentuais.length?Math.round(percentuais.reduce((s,n)=>s+n,0)/percentuais.length):null

 return <main className="relative min-h-[calc(100vh-68px)] overflow-hidden bg-[#07182b] text-slate-100">
  {modoTv&&<style>{'.atlas-sidebar-shell,.atlas-topbar,.atlas-mobile-navigation,.atlas-app-content > header,.atlas-app-content > nav{display:none!important}.atlas-app-shell{display:block!important}.atlas-app-main{padding:0!important;min-height:100vh!important}.atlas-app-content{height:100vh!important;overflow:auto!important}'}</style>}
  <div className="pointer-events-none absolute inset-0 opacity-70" style={{background:'radial-gradient(ellipse at 25% 0%,#102e54 0%,transparent 35%),radial-gradient(ellipse at 90% 85%,#10223f 0%,transparent 38%)'}}/>
  <div className={'relative z-[1] min-w-0 p-3 pb-8 md:p-5 '+(selecionado&&!modoTv?'xl:pr-[370px]':'')}>
   <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
    <div className="min-w-0">
     <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-blue-200/70">
      <Link href="/" className="inline-flex items-center gap-1 hover:text-white"><ArrowLeft size={13}/> Atlas One</Link>
      <span>/</span><span>Visão Geral</span>
     </div>
     <h1 className="text-[22px] font-extrabold tracking-tight text-white md:text-[27px]">Visão Geral de Projetos</h1>
     <p className="text-xs text-slate-300 md:text-sm">Acompanhe o andamento de todos os projetos em tempo real</p>
     {demo&&<span className="mt-2 inline-flex rounded bg-amber-400 px-2 py-1 text-xs font-bold text-amber-950">PRÉVIA FICTÍCIA</span>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
     <button onClick={()=>setFiltros(v=>!v)} aria-expanded={filtros} className={'inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#243c59] '+(filtros?'bg-[#284968]':'bg-[#10253e]')}><Filter size={15}/> Filtros</button>
     {podeEditarColunas&&<button onClick={()=>setConfig(v=>!v)} aria-expanded={config} className="inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] bg-[#10253e] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#243c59]"><Settings2 size={15}/> Personalizar Kanban</button>}
     <button onClick={()=>setCompacto(v=>!v)} className="inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] bg-[#10253e] px-3 py-2 text-[11px] text-white"><Columns3 size={15}/>{compacto?'Cards maiores':'Cards menores'}</button>
     <button onClick={()=>void alternarTV()} className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-blue-600"><Maximize2 size={15}/>{modoTv?'Sair do modo TV':'Modo TV'}</button>
     <Link href="/clientes/identificar" title="Criar ou identificar cliente para abrir uma obra no fluxo oficial" className="inline-flex items-center gap-1.5 rounded-md bg-[#0061d5] px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-600"><Plus size={15}/> Novo Projeto</Link>
    </div>
   </div>
   {filtros&&<section className="mb-4 flex flex-wrap gap-3 rounded-lg border border-[#29415d] bg-[#12283e] p-3">
    <label className="min-w-[180px] flex-1 text-[11px] text-slate-300">Buscar projeto ou orçamento
     <input className="mt-1 block w-full rounded-md border border-[#395473] bg-[#091b30] px-3 py-2 text-sm text-white outline-none focus:border-blue-400" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Cliente, obra ou orçamento"/>
    </label>
    <label className="text-[11px] text-slate-300">Situação
     <select className="mt-1 block rounded-md border border-[#395473] bg-[#091b30] px-3 py-2 text-sm text-white" value={condicao} onChange={e=>setCondicao(e.target.value as Condicao)}>
      <option value="todos">Todas</option><option value="atrasados">Atrasados</option><option value="atencao">Precisam de atenção</option><option value="sem_prazo">Sem prazo definido</option>
     </select>
    </label>
    <button onClick={()=>{setBusca('');setCondicao('todos')}} className="self-end rounded-md border border-[#395473] px-3 py-2 text-xs">Limpar filtros</button>
   </section>}
   {erro&&<p role="alert" className="mb-3 rounded-lg border border-rose-500/50 bg-rose-950/50 p-3 text-sm text-rose-100">{erro}</p>}
   <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">{montarKPIs.map(k=>{
    const Icone=k.icone
    return <div key={k.label} className="relative min-h-[80px] overflow-hidden rounded-lg border border-[#294461] bg-gradient-to-br from-[#152b46] to-[#0b1c32] px-3 py-3 shadow-[0_3px_18px_rgba(0,0,0,.13)]">
     <div className="pr-9 text-[11px] text-[#d0dbeb]">{k.label}</div>
     <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white" style={{background:k.cor+'25',boxShadow:'inset 0 0 0 1px '+k.cor+'55'}}><Icone size={20} style={{color:k.cor}}/></span>
     <div className="mt-1 flex flex-wrap items-baseline gap-2"><b className="text-[25px] font-bold leading-7 text-white">{k.numero}</b><span className="text-[10px] text-[#9bb7d8]">{k.detalhe}</span></div>
    </div>
   })}</div>
   {config&&podeEditarColunas&&<section className="mb-4 space-y-3 rounded-xl border border-[#2b4665] bg-[#10233d] p-4">
    <div><h2 className="font-extrabold text-white">Personalizar Kanban</h2><p className="text-xs text-slate-300">Somente Master. As colunas são visuais: movimentação real e finalização seguem o Cliente 360. {avisoConfiguracao}</p></div>
    <div className="flex flex-wrap gap-2"><input value={novoNome} onChange={e=>setNovoNome(e.target.value)} placeholder="Nome da nova coluna" aria-label="Nome da nova coluna" className="rounded-md border border-[#375073] bg-[#0c2038] px-3 py-2 text-sm text-white"/><button onClick={criar} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold">+ Criar coluna</button></div>
    <div className="flex flex-wrap gap-2 text-xs"><label className="self-center">Etapa operacional:</label><select value={novoCriterio} onChange={e=>setNovoCriterio(e.target.value as EtapaOperacional)} className="rounded-md border border-[#375073] bg-[#0c2038] px-2 py-1.5">{ETAPAS_OPERACIONAIS.map(x=><option key={x} value={x}>{x}</option>)}</select></div>
    <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-4">{colunasOrdenadas.map(c=><div key={c.id} className="rounded-lg border border-[#39516b] p-2">
     <p className="mb-1 text-[10px] text-slate-300">Etapa {c.ordem+1} · {c.criterios.length} vínculos</p>
     <input value={nomeEditando[c.id]??c.nome} onChange={e=>setNomeEditando(a=>({...a,[c.id]:e.target.value}))} className="mb-2 w-full rounded border border-[#34506b] bg-[#102a45] px-2 py-1.5 text-sm"/>
     <div className="flex flex-wrap gap-1">{([['Salvar',()=>renomear(c.id)],['←',()=>ordem(c.id,-1)],['→',()=>ordem(c.id,1)],['Vincular',()=>vincular(c.id)],['Excluir',()=>excluir(c.id)]] as [string,()=>void][]).map(([l,acao])=><button key={l} onClick={acao} className="rounded border border-[#48627f] px-2 py-1 text-[10px] hover:bg-blue-950">{l}</button>)}</div>
    </div>)}</div>
    {!!validade.length&&<p className="text-xs text-rose-300">{validade.join('; ')}</p>}
    {configuravel&&!demo&&<button disabled={!!validade.length} onClick={()=>void salvarConfig()} className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold disabled:opacity-40">Salvar configuração da empresa</button>}
   </section>}
   <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
    <span className="inline-flex items-center gap-1"><ShieldCheck size={13}/> Etapas atualizadas pelos registros reais do Cliente 360, Compras, Produção e Instalação</span>
    <span>{carregando?'Consultando a empresa…':atualizado?'Atualizado: '+new Date(atualizado).toLocaleString('pt-BR'):'Aguardando dados'}</span>
   </div>
   <div className="w-full overflow-x-auto rounded-xl pb-3" aria-label="Kanban Geral de Projetos" style={{scrollbarColor:'#385578 #0e2139'}}>
    <div className="grid min-w-max items-stretch gap-2" style={{gridTemplateColumns:'repeat('+colunasOrdenadas.length+','+(compacto?'155px':'188px')+')'}}>
     {colunasOrdenadas.map((col,i)=>{
      const vis=agrupado.get(col.id)||[]
      const pedidosCol=pedidosVisiveis.filter(p=>col.criterios.includes(p.status==='aguardando'?'aguardando_materiais':'compras'))
      const paleta=COLUNA_CORES[etapaIndice(col)]||COLUNA_CORES[i%COLUNA_CORES.length]
      const Icon=paleta.icone
      return <section key={col.id} className="flex min-h-[500px] min-w-0 flex-col overflow-hidden rounded-[9px] border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,.23)]" style={{background:'linear-gradient(180deg,'+paleta.base+' 0%,#0b1c32 100%)'}}>
       <div className="min-h-[39px] px-2.5 py-2 text-white" style={{background:paleta.cabecalho}}>
        <div className="flex items-center gap-1">
         <Icon size={15} className="shrink-0"/>
         <h2 className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight">{col.nome}</h2>
         <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">{vis.length}{pedidosCol.length?' + '+pedidosCol.length:''}</span>
        </div>
       </div>
       <Link href="/clientes/identificar" title="Abrir o fluxo oficial de cliente e obra; a etapa será atualizada pelo Cliente 360" className="block border-t border-white/10 py-1.5 text-center text-[11px] font-semibold text-white hover:brightness-110" style={{background:paleta.botao}}>+ Adicionar</Link>
       <div className="flex flex-1 flex-col gap-2 p-[5px]">
        {vis.map(c=><CardProjeto key={c.vendaId} card={c} abrir={()=>abrir(c.vendaId)} compacto={compacto} ativo={selecionado===c.vendaId}/>)}
        {pedidosCol.map(p=><CardPedido key={p.id} pedido={p} abrir={()=>abrir(p.id)}/>)}
        {!vis.length&&!pedidosCol.length&&<p className="rounded-lg border border-dashed border-white/15 bg-white/5 px-2 py-5 text-center text-[11px] text-slate-400">Nenhum card nesta etapa</p>}
       </div>
      </section>
     })}
    </div>
   </div>
  </div>
  {(cardAtual||pedidoAtual)&&<div className="fixed inset-0 z-[70] bg-black/50 xl:pointer-events-none xl:bg-transparent" onClick={fechar}>
   <aside role="dialog" aria-modal="true" aria-label="Detalhes do projeto" onClick={e=>e.stopPropagation()} className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-[370px] flex-col overflow-y-auto bg-[#f7f9fd] text-slate-900 shadow-[-6px_0_24px_rgba(0,0,0,.24)]">
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
     <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
       <div className="flex flex-wrap items-center gap-2"><b className="line-clamp-2 text-[15px] leading-5 text-[#15274b]">{cardAtual?.cliente||pedidoAtual?.cliente}</b>
        {cardAtual&&<span className="rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">{etapaCard?.nome||'Em acompanhamento'}</span>}
       </div>
       <p className="mt-1 text-xs text-[#294a7c]">Orçamento: <b className="text-sm">{cardAtual?.numeroOrcamento||pedidoAtual?.numeroOrcamento||'Não vinculado'}</b></p>
      </div>
      <button onClick={fechar} aria-label="Fechar painel lateral" className="rounded-md p-1.5 hover:bg-slate-100"><X size={18}/></button>
     </div>
     <div className="mt-3 flex gap-1 overflow-x-auto pb-1" style={{scrollbarWidth:'thin'}}>{ABAS.map(x=><button key={x.id} onClick={()=>setAba(x.id)} className={'shrink-0 rounded-md px-2 py-2 text-[10px] font-bold '+(aba===x.id?'bg-blue-600 text-white':'bg-slate-100 text-[#23385e]')}>{x.label}</button>)}</div>
    </div>
    {pedidoAtual?<div className="space-y-3 p-3">
      <FotoReal url={pedidoAtual.detalhesCompra?.find(x=>fotoSegura(x.fotoUrl))?.fotoUrl} alt={'Imagem do produto do pedido de '+pedidoAtual.cliente} classe="h-40 w-full"/>
      <h3 className="text-sm font-bold">{pedidoAtual.descricao}</h3>
      <p className="text-xs text-slate-600">{pedidoAtual.recebidos} de {pedidoAtual.itens} itens recebidos</p>
      <ItensCompra itens={pedidoAtual.detalhesCompra||[]}/>
      {!demo&&<Link className="inline-flex items-center gap-2 text-xs font-bold text-blue-700" href="/compras/solicitacoes">Abrir pedido em Compras <ArrowUpRight size={13}/></Link>}
     </div>:cardAtual&&<div className="space-y-3 p-3">
      {(aba==='resumo'||aba==='materiais')&&<>
       <section className="grid grid-cols-[1fr_.95fr] items-start gap-2 rounded-lg border border-slate-200 bg-white p-2">
        <FotoReal url={cardAtual.fotoProjetoUrl} alt={'Foto real do orçamento '+cardAtual.numeroOrcamento} classe="h-[140px] w-full"/>
        <div className="space-y-2 pt-1 text-[11px]">
         <p className="text-[10px] text-slate-500">Cliente<br/><b className="text-[11px] text-[#132c5b]">{cardAtual.cliente}</b></p>
         <p className="text-[10px] text-slate-500">Orçamento<br/><b className="text-[#132c5b]">{cardAtual.numeroOrcamento}</b></p>
         <p className="text-[10px] text-slate-500">Data da venda<br/><b className="text-[#132c5b]">{dataBr(cardAtual.dataVenda)}</b></p>
         <p className="text-[10px] text-slate-500">Previsão de instalação<br/><b className="text-rose-600">{dataBr(cardAtual.dataInstalacao)}</b></p>
        </div>
       </section>
       <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between text-[12px] font-bold text-[#1e3660]"><span>Andamento geral dos materiais</span><span>{porcento(progressoGeral)}</span></div>
        <div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width:(progressoGeral??0)+'%'}}/></div>
        <div className="space-y-3 pt-1">{tipos.map(tipo=>{
         const m=cardAtual.materiais.find(x=>x.tipo===tipo)
         return <div key={tipo} className="grid grid-cols-[22px_1fr] gap-2 items-center">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef4ff]"><Package size={15} className="text-blue-700"/></span>
          <Progresso nome={nomes[tipo]} valor={m?percentual(m.comprados,m.total):null}/>
         </div>
        })}</div>
        <p className="text-[10px] text-slate-500">Barras calculadas a partir de quantidades conciliadas; sem dados, não estimamos percentuais.</p>
       </section>
      </>}
      {aba==='resumo'&&<section className="rounded-lg border border-slate-200 bg-white p-3">
       <h3 className="flex items-center gap-2 text-[12px] font-extrabold text-[#1a3057]"><Info size={15}/> Informações principais</h3>
       <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-md bg-slate-50 p-2"><span className="text-slate-500">Situação atual</span><b className="mt-1 block text-blue-700">{etapaCard?.nome||cardAtual.etapaOperacional}</b></div>
        <div className="rounded-md bg-slate-50 p-2"><span className="text-slate-500">Instalação</span><b className="mt-1 block">{dataBr(cardAtual.dataInstalacao)}</b></div>
        <div className="rounded-md bg-slate-50 p-2"><span className="text-slate-500">Prazo da obra</span><b className="mt-1 block">{dataBr(cardAtual.previsaoEntrega)}</b></div>
       </div>
      </section>}
      {(aba==='resumo'||aba==='instalacao')&&<section className="rounded-lg border border-slate-200 bg-white p-3">
       <div className="mb-3 flex items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-[12px] font-extrabold text-[#1c345d]"><CalendarDays size={15}/> Calendário de Instalação</h3><Link href={'/relatorios/instalacoes'+(demo?'?demo=1':'')} className="text-[10px] font-bold text-blue-700">Abrir calendário</Link></div>
       <Calendario dia={cardAtual.dataInstalacao}/>
       <p className="mt-2 text-[10px] text-slate-600">Itens instalados: {cardAtual.instalacao.concluidas} de {cardAtual.instalacao.total}</p>
       {cardAtual.valorInstalacao!==null&&cardAtual.valorInstalacao!==undefined&&<p className="text-[10px] font-medium text-slate-700">Valor planejado: {moeda(cardAtual.valorInstalacao)}</p>}
      </section>}
      {(aba==='resumo'||aba==='historico')&&<section className="rounded-lg border border-slate-200 bg-white p-3">
       <h3 className="flex items-center gap-1.5 text-xs font-extrabold text-[#1d335b]"><ClipboardCheck size={14}/> Observações e pendências</h3>
       {cardAtual.observacoes?<p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-4 text-slate-600">{cardAtual.observacoes}</p>:<p className="mt-2 text-[11px] text-slate-500">Nenhuma observação cadastrada.</p>}
       {cardAtual.pendencias.map(p=><p key={p} className="mt-2 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">⚠ {p}</p>)}
       {aba==='historico'&&<p className="mt-2 text-[10px] text-slate-500">Histórico de alterações e movimentos disponível no registro oficial do Cliente 360.</p>}
      </section>}
      {(aba==='materiais'||aba==='compras')&&<section className="rounded-lg border border-slate-200 bg-white p-3">
       <h3 className="mb-3 text-xs font-extrabold">{aba==='materiais'?'Materiais e imagens cadastradas':'Pedidos de compra vinculados'}</h3>
       {cardAtual.materiais.map(m=><div key={m.tipo} className="mb-3 space-y-1.5 border-b border-slate-100 pb-2">
        <p className="text-[11px] font-bold">{nomes[m.tipo]}</p>
        <Progresso nome="Comprados" valor={percentual(m.comprados,m.total)}/>
        <Progresso nome="Recebidos" valor={percentual(m.recebidos,m.total)}/>
       </div>)}
       <ItensCompra itens={cardAtual.detalhesCompra||[]}/>
      </section>}
      {aba==='producao'&&<section className="rounded-lg border border-slate-200 bg-white p-3"><h3 className="text-xs font-bold">Produção</h3><p className="my-2 text-[11px]">{cardAtual.producao.concluidas} de {cardAtual.producao.total} ordens concluídas</p><Progresso nome="Produção" valor={percentual(cardAtual.producao.concluidas,cardAtual.producao.total)}/></section>}
      {!demo&&<div className="flex gap-2">
       <Link href={'/clientes/'+cardAtual.clienteId+'/vendas/'+cardAtual.vendaId} className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-700 px-2 py-2 text-[11px] font-bold text-white">Abrir Cliente 360 <ArrowUpRight size={13}/></Link>
       <Link href="/compras/solicitacoes" className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold">Compras</Link>
      </div>}
      {demo&&<p className="rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800">Prévia fictícia: não representa clientes, porcentagens ou datas reais.</p>}
     </div>}
   </aside>
  </div>}
 </main>
}
