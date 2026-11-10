'use client'

import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import Link from 'next/link'
import AlcaArrastarCard from '@/components/kanban/AlcaArrastarCard'
import {colunaNoFimDoArraste,type CoordenadaArraste} from '@/lib/kanbanArrastarDestino'
import {
 ArrowLeft,ArrowRight,ArrowUpRight,BarChart3,Building2,CalendarDays,CheckCircle2,
 ChevronLeft,ChevronRight,ClipboardCheck,Clock3,Columns3,Factory,Filter,
 Layers3,Maximize2,Package,Plus,RefreshCw,Settings2,ShieldCheck,
 ShoppingCart,Truck,Warehouse,X,AlertTriangle,History,ImageOff,Info,
 Users,Wallet,Search,Bell,GripVertical,
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
function CardProjeto({card,coluna,compacto,abrir,ativo}:{card:ProjetoGeralCard;coluna:ColunaVisualProjeto;compacto:boolean;abrir:()=>void;ativo:boolean}){
 const materias=Object.fromEntries(card.materiais.map(m=>[m.tipo,percentual(m.comprados,m.total)])) as Record<string,number|null>
 const status=(coluna.statusDisponiveis||[]).filter(s=>(card.statusEtapa||[]).includes(s.id))
 const atraso=card.prazoEtapaEstado==='vermelho'
 const concluido=card.prazoEtapaEstado==='verde'
 const andamento=card.prazoEtapaEstado==='amarelo'
 const corPrazo=atraso?'border-rose-500':concluido?'border-emerald-500':andamento?'border-amber-400':'border-[#d8e1f0]'
 const prazoTexto=atraso?'Atrasado '+Math.abs(card.horasEtapaRestantes||0)+'h'
   :concluido?'Concluído no prazo'
   :andamento?Math.max(0,card.horasEtapaRestantes||0)+'h restantes':null
 const mostrarProducao=['aguardando_producao','producao','aguardando_instalacao','instalacao','finalizado'].includes(card.etapaOperacional)
 const mostrarInstalacao=['aguardando_instalacao','instalacao','finalizado'].includes(card.etapaOperacional)
 const progressoProd=percentual(card.producao.concluidas,card.producao.total)
 const progressoInst=percentual(card.instalacao.concluidas,card.instalacao.total)
 return <button type="button" onClick={abrir} aria-pressed={ativo}
  className={'group w-full min-w-0 rounded-lg border-2 bg-white text-left shadow-[0_2px_9px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-[0_5px_18px_rgba(0,0,0,.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 '+
  (ativo?'border-blue-500 ring-1 ring-blue-400':corPrazo)+' '+(compacto?'p-2':'p-2.5')}>
  <p className="line-clamp-2 text-[11px] font-extrabold leading-[14px] text-[#092044]" title={card.cliente}>{card.cliente}</p>
  <p className="mt-0.5 truncate text-[10px] text-[#192c50]">Orçamento: <b>{card.numeroOrcamento||'Não vinculado'}</b></p>
  <p className="mt-1 line-clamp-2 text-[10px] text-slate-600">Obra: {card.projeto||'Não vinculada'}</p>
  <div className="mt-2 space-y-[5px]" aria-label="Percentuais de materiais">
   {tipos.map(tipo=><Progresso key={tipo} nome={nomes[tipo]} valor={materias[tipo]??null} compacto/>)}
  </div>
  {mostrarProducao&&<div className="mt-2 border-t border-slate-100 pt-2"><Progresso nome="Produção" valor={progressoProd} compacto/><p className="mt-1 text-[10px] text-slate-500">{card.producao.total?card.producao.concluidas+' de '+card.producao.total+' ordens concluídas':'Sem ordens de produção conciliadas'}</p></div>}
  {mostrarInstalacao&&<div className="mt-1"><Progresso nome="Instalação" valor={progressoInst} compacto/><p className="mt-1 text-[10px] text-slate-500">{card.instalacao.total?card.instalacao.concluidas+' de '+card.instalacao.total+' itens de instalação concluídos':'Sem itens de instalação conciliados'}</p></div>}
  {!!status.length&&<div className="mt-2 flex flex-wrap gap-1" aria-label="Status desta etapa">{status.map(s=><span key={s.id} className={'rounded px-1.5 py-1 text-[10px] font-semibold '+(s.conclusivo?'bg-emerald-100 text-emerald-900':'bg-blue-100 text-blue-900')}>{s.nome}</span>)}</div>}
  {(coluna.statusDisponiveis||[]).length>0&&<p className="mt-1 text-[10px] font-semibold text-blue-700">▾ Abrir para atualizar status</p>}
  {prazoTexto&&<p className={'mt-2 rounded px-1.5 py-1 text-[10px] font-bold '+(atraso?'bg-rose-100 text-rose-800':concluido?'bg-emerald-100 text-emerald-800':'bg-amber-100 text-amber-900')}><Clock3 size={11} className="mr-1 inline"/>{prazoTexto}</p>}
  {card.compras.total>0&&<p className="mt-2 border-t border-slate-100 pt-1 text-[10px] text-blue-700">
   <ShoppingCart size={11} className="mr-1 inline"/> {card.compras.comprados} de {card.compras.total} itens comprados
  </p>}
  {card.pendencias.length>0&&<p className="mt-1 line-clamp-2 rounded bg-amber-50 px-1.5 py-1 text-[10px] leading-3 text-amber-800">
   <AlertTriangle size={11} className="mr-1 inline"/> {card.pendencias[0]}
  </p>}
  <div className="mt-2 flex items-start gap-1.5 border-t border-slate-100 pt-2 text-[10px] leading-3 text-[#334d76]">
   <CalendarDays size={13} className="shrink-0 text-blue-600"/>
   <span>Instalação prevista <b>{card.dataInstalacao?dataBr(card.dataInstalacao):card.instalacaoMes||'A programar'}</b></span>
  </div>
 </button>
}
type AcompanhamentoGeral={
 id:string;vendaId:string;clienteId:string;cliente:string;numeroOrcamento:string|null;
 titulo:string;descricao:string;etapa:string;createdAt:string
}
function CardAcompanhamento({card}:{card:AcompanhamentoGeral}){
 return <Link href={`/clientes/${card.clienteId}/vendas/${card.vendaId}`}
  className="block w-full rounded-lg border-l-4 border-l-sky-500 bg-white p-2.5 text-left shadow-md hover:ring-2 hover:ring-sky-400">
  <p className="text-[11px] font-extrabold text-[#162b50]">{card.cliente}</p>
  <p className="text-[10px] text-slate-500">Orçamento: {card.numeroOrcamento||'Não identificado'}</p>
  <p className="mt-2 rounded bg-sky-50 px-1.5 py-1 text-[10px] font-bold text-sky-800">Acompanhamento manual da obra</p>
  <p className="mt-2 text-[11px] font-bold text-slate-800">{card.titulo}</p>
  {card.descricao&&<p className="mt-1 line-clamp-3 text-[10px] text-slate-600">{card.descricao}</p>}
  <p className="mt-2 text-[10px] font-semibold text-blue-700">Abrir Kanban desta obra →</p>
 </Link>
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
 const [acompanhamentos,setAcompanhamentos]=useState<AcompanhamentoGeral[]>([])
 const [usuarioMaster,setUsuarioMaster]=useState(false)
 const [podeMoverCards,setPodeMoverCards]=useState(false)
 const [ocultos,setOcultos]=useState<{vendaId:string;cliente:string;numeroOrcamento:string;motivoControle:string|null}[]>([])
 const [mostrarOcultos,setMostrarOcultos]=useState(false),[arrastando,setArrastando]=useState<string|null>(null),[arrastandoColuna,setArrastandoColuna]=useState<string|null>(null),[salvandoCard,setSalvandoCard]=useState(false)
 const [selecionado,setSelecionado]=useState<string|null>(null),[aba,setAba]=useState<Aba>('resumo')
 const [erro,setErro]=useState(''),[aviso,setAviso]=useState(''),[carregando,setCarregando]=useState(true),[atualizado,setAtualizado]=useState('')
 const [modoTv,setModoTv]=useState(false),[compacto,setCompacto]=useState(false),[editarColunaId,setEditarColunaId]=useState<string|null>(null),[novoNome,setNovoNome]=useState('')
 const [abaConfigColuna,setAbaConfigColuna]=useState<'coluna'|'status'|'prazo'>('coluna')
 const [colunasSalvas,setColunasSalvas]=useState<ColunaVisualProjeto[]>(COLUNAS_GERAIS_PADRAO)
 const [alterandoStatus,setAlterandoStatus]=useState(false)
 const [filtros,setFiltros]=useState(false),[busca,setBusca]=useState(''),[condicao,setCondicao]=useState<Condicao>('todos')
 const [novoCriterio,setNovoCriterio]=useState<EtapaOperacional>('compras_liberacao'),[nomeEditando,setNomeEditando]=useState<Record<string,string>>({})
 const [unidadePrazos,setUnidadePrazos]=useState<Record<string,'horas'|'dias'>>({})
 const [fechou,setFechou]=useState(false)
 const selecionadoInicial=useRef(false)
 const leituraAtual=useRef(0)
 const movimentoEmCurso=useRef(false)
 const arrasteCard=useRef<{id:string;ponto:CoordenadaArraste|null;tratado:boolean}|null>(null)
 const posicoesGravadas=useRef(new Map<string,string>())
 const edicaoColunasPendente=useRef(false)
 const novaColunaRef=useRef<HTMLElement>(null)
 const novoNomeRef=useRef<HTMLInputElement>(null)
 const carregar=useCallback(async()=>{
  if(demo===null)return
  if(demo){setCards(DEMO_PROJETOS);setPedidos(DEMO_PEDIDOS);setAcompanhamentos([]);setPodeMoverCards(false);setCarregando(false);setAtualizado(new Date().toISOString());return}
  if(movimentoEmCurso.current)return // ignorar polling enquanto valida o destino
  const geracao=++leituraAtual.current
  try{const token=await tokenAtual();if(!token)throw Error('Faça login para consultar a visão geral.')
   const r=await fetch('/api/visao-geral-projetos',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Falha na consulta da empresa')
   if(movimentoEmCurso.current||geracao!==leituraAtual.current)return
   if(Array.isArray(j.colunas)&&!edicaoColunasPendente.current)setColunas(j.colunas)
   setCards((j.cards||[]).map((c:ProjetoGeralCard)=>{
    const colBanco=j.posicoesPersistidas?.[c.vendaId]
    const colValida=typeof colBanco==='string'&&(j.colunas||COLUNAS_GERAIS_PADRAO)
     .some((col:ColunaVisualProjeto)=>col.id===colBanco)?colBanco:null
    const colLocal=posicoesGravadas.current.get(c.vendaId)
    if(colLocal&&colValida===colLocal)posicoesGravadas.current.delete(c.vendaId)
    const destino=colLocal||colValida||c.colunaId
    return {...c,colunaId:destino,materiais:c.materiais||[],pendencias:c.pendencias||[],detalhesCompra:c.detalhesCompra||[]}
   }))
   setPedidos(j.pedidos||[]);setAcompanhamentos(j.acompanhamentos||[]);setUsuarioMaster(j.usuarioMaster===true);setPodeMoverCards(j.podeMoverCards===true)
   setOcultos(j.usuarioMaster===true?j.ocultos||[]:[])
   setAtualizado(j.atualizadoEm||new Date().toISOString());setErro('')
  }catch(e){if(!movimentoEmCurso.current&&geracao===leituraAtual.current)setErro(e instanceof Error?e.message:'Falha ao consultar a empresa.')}
  finally{if(geracao===leituraAtual.current)setCarregando(false)}
 },[demo])
 useEffect(()=>{setDemo(new URLSearchParams(window.location.search).get('demo')==='1')},[])
 useEffect(()=>{
  if(demo===null||demo)return
  let ativo=true
  void(async()=>{try{
   const token=await tokenAtual();if(!token)return
   const r=await fetch('/api/visao-geral-colunas',{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   const j=await r.json().catch(()=>({}))
   if(ativo&&r.ok){
    const configuradas=j.colunas||COLUNAS_GERAIS_PADRAO
    setColunasSalvas(configuradas)
    if(!edicaoColunasPendente.current)setColunas(configuradas)
    setConfiguravel(j.configuravel===true);setAvisoConfiguracao(j.aviso||'')
   }
  }catch{}})()
  return()=>{ativo=false}
 },[demo])
 useEffect(()=>{if(demo===null)return;void carregar();const timer=window.setInterval(()=>void carregar(),15_000);return()=>clearInterval(timer)},[demo,carregar])
 useEffect(()=>{
  if(!cards.length||selecionadoInicial.current||fechou||typeof window==='undefined')return
  selecionadoInicial.current=true
  if(window.innerWidth>=1280)setSelecionado(cards[0].vendaId)
 },[cards,fechou])
 const podeEditarColunas=demo===true||configuravel||usuarioMaster
 function revelarAdicionarColuna(){
  novaColunaRef.current?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'end'})
  novoNomeRef.current?.focus({preventScroll:true})
 }
 async function operarMaster(vendaId:string,acao:'finalizar'|'ocultar'|'restaurar'){
  if(!usuarioMaster||demo||salvandoCard){setErro('Apenas o Master pode organizar estes cards reais.');return}
  const titulo=acao==='finalizar'
   ?'Mover para Finalizado somente na Visão Geral (não encerra operações do Cliente 360).'
   :acao==='ocultar'
   ?'Retirar este card do Kanban Geral, sem excluir venda, cliente, documentos ou histórico.'
   :'Restaurar o card para a posição calculada a partir do Cliente 360.'
  const sugestao=acao==='finalizar'
   ?'Projeto já encerrado; organização manual do Kanban pelo Master.'
   :acao==='restaurar'
   ?'Projeto restaurado na Visão Geral pelo Master.'
   :'Card antigo retirado da Visão Geral pelo Master.'
  const motivo=window.prompt(titulo+'\n\nConfirme registrando o motivo (mínimo 8 caracteres):',sugestao)
  if(!motivo)return
  if(motivo.trim().length<8){setErro('Motivo obrigatório com pelo menos 8 caracteres.');return}
  if(!window.confirm(titulo+'\n\nMotivo: '+motivo.trim()+'\n\nDeseja confirmar?'))return
  setSalvandoCard(true);setErro('')
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada. Entre novamente.')
   const r=await fetch('/api/visao-geral-projetos/controle',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,acao,motivo:motivo.trim()})})
   const json=await r.json().catch(()=>({}))
   if(!r.ok||!json.ok)throw Error(json.erro||'A ação não foi salva')
   if(acao==='ocultar')setSelecionado(null)
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao alterar o card.')}
  finally{setSalvandoCard(false);setArrastando(null)}
 }
 async function moverCardVisual(vendaId:string,colunaId:string){
  if(demo||movimentoEmCurso.current)return
  const atual=cards.find(c=>c.vendaId===vendaId)
  if(!atual)return
  const destino=colunasOrdenadas.find(c=>c.id===colunaId)
  if(!destino){setErro('A coluna de destino não existe.');return}
  const nome=destino.nome
  if(atual.colunaId===colunaId){setAviso('Este card já está na coluna '+nome+'.');return}
  movimentoEmCurso.current=true
  let gravouNoBanco=false
  ++leituraAtual.current
  posicoesGravadas.current.set(vendaId,colunaId)
  setSalvandoCard(true);setErro('');setAviso('Salvando card em '+nome+'...')
  setCards(p=>p.map(c=>c.vendaId===vendaId?{...c,colunaId}:c))
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const motivo='Reposicionamento manual do card para a coluna '+nome+'.'
   const r=await fetch('/api/visao-geral-projetos/mover',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,colunaId,motivo})
   })
   const j=await r.json().catch(()=>({}))
   if(!r.ok||!j.ok)throw Error(j.erro||'A posição não foi salva.')
   if(j.colunaId&&j.colunaId!==colunaId)throw Error('O banco respondeu uma coluna diferente.')
   gravouNoBanco=true
   // Consultar a fonte persistida, não reconstruir o Kanban inteiro para verificar um POST.
   const conferido=await fetch('/api/visao-geral-projetos/mover?vendaId='+encodeURIComponent(vendaId),{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   })
   const payload=await conferido.json().catch(()=>({}))
   if(!conferido.ok){
    setAviso('✓ Posição gravada em '+nome+'. A confirmação da leitura ficará pendente.')
    return
   }
   if(payload.estado!=='manual'||payload.colunaId!==colunaId){
    setAviso('')
    setErro('A coluna registrada no banco não corresponde ao destino '+nome+'. Verifique o card.')
    return
   }
   posicoesGravadas.current.delete(vendaId)
   setAviso('✓ Card salvo em '+nome+' e sincronizado com o Kanban da Obra.')
  }catch(e){
   if(gravouNoBanco){
    setAviso('✓ Posição gravada em '+nome+'. A consulta será atualizada automaticamente.')
   }else{
    posicoesGravadas.current.delete(vendaId)
    setCards(p=>p.map(c=>c.vendaId===vendaId?atual:c))
    setAviso('')
    setErro(e instanceof Error?e.message:'Falha ao salvar o card.')
   }
  }finally{
   movimentoEmCurso.current=false
   setSalvandoCard(false);setArrastando(null)
  }
 }
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
 const acompanhamentoVisivel=useMemo(()=>acompanhamentos.filter(c=>{
  if(condicao!=='todos')return false
  const q=busca.trim().toLocaleLowerCase('pt-BR')
  return !q||[c.cliente,c.numeroOrcamento||'',c.titulo,c.descricao].some(s=>s.toLocaleLowerCase('pt-BR').includes(q))
 }),[acompanhamentos,busca,condicao])
 const colunasOrdenadas=useMemo(()=>[...colunas].sort((a,b)=>a.ordem-b.ordem),[colunas])
 const agrupado=useMemo(()=>new Map(colunas.map(c=>[c.id,visiveis.filter(p=>p.colunaId===c.id)])),[colunas,visiveis])
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
 function criar(){try{
  if(!podeEditarColunas)throw Error('Somente Master configura etapas.')
  if(!novoNome.trim())return
  const id='manual_'+Date.now()
  edicaoColunasPendente.current=true
  setColunas(a=>criarColunaGeral(a,id,novoNome))
  setNovoNome('');setErro('');setEditarColunaId(id);setAbaConfigColuna('coluna')
 }catch(e){setErro(String(e))}}
 function renomear(id:string){try{
  edicaoColunasPendente.current=true
  setColunas(c=>renomearColunaGeral(c,id,nomeEditando[id]||''))
  setErro('')
 }catch(e){setErro(String(e))}}
 function alterarColuna(id:string,patch:Partial<ColunaVisualProjeto>){
  edicaoColunasPendente.current=true
  setColunas(antes=>antes.map(c=>c.id===id?{...c,...patch}:c))
 }
 function fecharEditorColuna(){
  edicaoColunasPendente.current=false
  setColunas(colunasSalvas)
  setEditarColunaId(null)
  setNomeEditando({})
 }
 function adicionarStatus(id:string){
  const nome=window.prompt('Nome do novo status desta coluna:')
  if(!nome?.trim())return
  const novo={id:'s_'+Date.now().toString(36),nome:nome.trim(),conclusivo:false}
  alterarColuna(id,{statusDisponiveis:[...(colunas.find(c=>c.id===id)?.statusDisponiveis||[]),novo]})
 }
 function alterarStatus(id:string,statusId:string){
  const col=colunas.find(c=>c.id===id)
  const atual=col?.statusDisponiveis?.find(s=>s.id===statusId)
  if(!col||!atual)return
  const nome=window.prompt('Nome do status:',atual.nome)
  if(!nome?.trim())return
  alterarColuna(id,{statusDisponiveis:col.statusDisponiveis?.map(s=>s.id===statusId?{...s,nome:nome.trim()}:s)})
 }
 function removerStatus(id:string,statusId:string){
  // Evitar remover status já associados a cards sem migração explícita.
  setErro('Exclusão de status será liberada com a auditoria e verificação de cards vinculados.')
 }
 function vincular(id:string){try{setColunas(c=>associarCriterioColuna(c,novoCriterio,id));setErro('')}catch(e){setErro(String(e))}}
 function excluir(id:string){const dest=colunas.find(c=>c.id!==id);if(!dest)return
  const resposta=window.prompt('ID da coluna de destino dos vínculos (nenhum projeto será excluído):',dest.id);if(!resposta)return
  try{edicaoColunasPendente.current=true;setColunas(c=>excluirColunaGeral(c,id,resposta));setEditarColunaId(null);setErro('')}catch(e){setErro(String(e))}
 }
 function ordem(id:string,d:number){const ids=colunasOrdenadas.map(c=>c.id),i=ids.indexOf(id),j=i+d;if(j<0||j>=ids.length)return
  ;[ids[i],ids[j]]=[ids[j],ids[i]];try{edicaoColunasPendente.current=true;setColunas(c=>reordenarColunasGerais(c,ids))}catch(e){setErro(String(e))}
 }
 function soltarColuna(destinoId:string){
  if(!arrastandoColuna||arrastandoColuna===destinoId)return
  const ids=colunasOrdenadas.map(c=>c.id)
  const origem=ids.indexOf(arrastandoColuna),destino=ids.indexOf(destinoId)
  if(origem<0||destino<0)return
  ids.splice(origem,1);ids.splice(destino,0,arrastandoColuna)
  try{edicaoColunasPendente.current=true;setColunas(c=>reordenarColunasGerais(c,ids));setErro('')}catch(e){setErro(String(e))}
 }
 async function salvarConfig(){
  const novas=colunas.map(x=>({...x,nome:nomeEditando[x.id]??x.nome}))
  const errosConfig=validarColunasGerais(novas)
  if(errosConfig.length){setErro(errosConfig.join('; '));return}
  if(demo){
   setColunas(novas);setColunasSalvas(novas);edicaoColunasPendente.current=false
   setEditarColunaId(null);setAvisoConfiguracao('Simulação: configuração não gravada.');return
  }
  if(!podeEditarColunas){setErro('Acesso reservado ao Master.');return}
  try{const token=await tokenAtual();if(!token)throw Error('Sessão expirada')
   const r=await fetch('/api/visao-geral-colunas',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({colunas:novas})})
   const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.erro||'Erro ao salvar')
   const gravadas=Array.isArray(j.colunas)?j.colunas:novas
   setColunas(gravadas);setColunasSalvas(gravadas);edicaoColunasPendente.current=false
   setEditarColunaId(null);setNomeEditando({})
   setErro('');setAviso('Configuração salva e auditada na empresa.')
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao salvar configuração.')}
 }
 async function atualizarStatusCard(vendaId:string,colunaId:string,ids:string[]){
  if(demo||!podeMoverCards||alterandoStatus)return
  setAlterandoStatus(true)
  try{
   const token=await tokenAtual();if(!token)throw Error('Sessão expirada.')
   const r=await fetch('/api/visao-geral-projetos/status',{
    method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({vendaId,colunaId,statusIds:ids}),
   })
   const j=await r.json().catch(()=>({}))
   if(!r.ok||!j.ok)throw Error(j.erro||'Não foi possível registrar o status.')
   setCards(anteriores=>anteriores.map(c=>c.vendaId===vendaId?{...c,statusEtapa:ids}:c))
   setErro('');setAviso('Status da etapa registrado no histórico.')
   await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao atualizar o status.')}
  finally{setAlterandoStatus(false)}
 }
 async function alternarTV(){
  if(!modoTv&&document.fullscreenEnabled)await document.documentElement.requestFullscreen().catch(()=>{})
  if(modoTv&&document.fullscreenElement)await document.exitFullscreen().catch(()=>{})
  setModoTv(v=>!v)
 }
 const etapaCard=cardAtual?colunasOrdenadas.find(c=>c.id===cardAtual.colunaId):null
 const editandoColuna=colunasOrdenadas.find(c=>c.id===editarColunaId)||null
 const percentuais=cardAtual?cardAtual.materiais.map(m=>percentual(m.comprados,m.total)).filter((n):n is number=>n!==null):[]
 const progressoGeral=percentuais.length?Math.round(percentuais.reduce((s,n)=>s+n,0)/percentuais.length):null

 return <main className="atlas-visual-geral relative min-h-screen overflow-hidden bg-[#07182b] text-slate-100">
  <style>{`
    @media(min-width:768px) {
      .atlas-app-shell:has(.atlas-visual-geral) .atlas-sidebar-shell,
      .atlas-app-shell:has(.atlas-visual-geral) .atlas-topbar,
      .atlas-app-shell:has(.atlas-visual-geral) .atlas-app-content > div:has(>button[aria-label="Voltar à tela anterior"]) {
        display:none!important;
      }
      .atlas-app-shell:has(.atlas-visual-geral) .atlas-app-content {max-width:100%!important;width:100%!important;}
    }
    .atlas-app-shell:has(.atlas-visual-geral) .atlas-app-main {background:#07182b!important;}
  `}</style>
  <nav aria-label="Navegação principal do Atlas One" className="relative z-[2] flex min-h-[52px] items-center gap-3 overflow-x-auto border-b border-[#243d5b] bg-[#0a1a30] px-3 py-2 text-white md:px-5">
    <Link href="/" className="flex shrink-0 items-center gap-1.5 text-[14px] font-bold tracking-tight text-white" title="Abrir início do Atlas One">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600"><Layers3 size={17}/></span>
      <span>ATLAS <small className="text-[9px]">ONE</small></span>
    </Link>
    <div className="flex shrink-0 items-center gap-1 text-[11px]">
      {([
        ['Visão Geral','/visao-geral-projetos',Layers3],
        ['Clientes','/clientes',Users],
        ['Vendas','/vendas/confirmar',ShoppingCart],
        ['Produção','/producao',Factory],
        ['Instalação','/relatorios/instalacoes',Truck],
        ['Financeiro','/financeiro/contas-receber',Wallet],
        ['Compras','/compras',Warehouse],
        ['Relatórios','/relatorios',BarChart3],
      ] as const).map(([rotulo,href,Icone])=>
        <Link key={href} href={href} className={'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-2 transition hover:bg-[#26405e] '+(href==='/visao-geral-projetos'?'bg-[#115cbe] font-bold':'text-[#cbdaed]')}>
         <Icone size={14}/>{rotulo}
        </Link>
      )}
    </div>
    <div className="hidden min-w-[120px] flex-1 items-center gap-1.5 rounded-md border border-[#34516f] bg-[#172a42] px-2 py-1.5 xl:flex">
      <Search size={14} className="shrink-0 text-slate-300"/>
      <input aria-label="Buscar cliente ou orçamento na Visão Geral" value={busca} onChange={e=>setBusca(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none placeholder:text-[#9aadc5]" placeholder="Buscar cliente ou orçamento..."/>
    </div>
    {configuravel&&<Link href="/configuracoes/usuarios" aria-label="Configurações de usuários" className="shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-[#274465]"><Settings2 size={17}/></Link>}
  </nav>
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
     {usuarioMaster&&!demo&&<button type="button" onClick={()=>setMostrarOcultos(v=>!v)} aria-expanded={mostrarOcultos} className="inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] bg-[#10253e] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#243c59]"><Package size={15}/> Cards retirados ({ocultos.length})</button>}
     <button onClick={()=>setFiltros(v=>!v)} aria-expanded={filtros} className={'inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#243c59] '+(filtros?'bg-[#284968]':'bg-[#10253e]')}><Filter size={15}/> Filtros</button>
     {podeEditarColunas&&<button type="button" onClick={revelarAdicionarColuna} className="inline-flex items-center gap-1.5 rounded-md border border-blue-400/60 bg-blue-700 px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-600" aria-label="Ir ao final do Kanban para adicionar coluna"><Plus size={15}/> Adicionar coluna</button>}
     {podeEditarColunas&&<button onClick={()=>{setEditarColunaId(colunasOrdenadas[0]?.id||null);setAbaConfigColuna('coluna')}} className="inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] bg-[#10253e] px-3 py-2 text-[11px] font-semibold text-white hover:bg-[#243c59]"><Settings2 size={15}/> Personalizar Kanban</button>}
     {podeEditarColunas&&edicaoColunasPendente.current&&<button onClick={()=>void salvarConfig()} className="rounded-md bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white">Salvar alterações</button>}
     <button onClick={()=>setCompacto(v=>!v)} className="inline-flex items-center gap-1.5 rounded-md border border-[#2a4769] bg-[#10253e] px-3 py-2 text-[11px] text-white"><Columns3 size={15}/>{compacto?'Cards maiores':'Cards menores'}</button>
     <button onClick={()=>void alternarTV()} className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-blue-600"><Maximize2 size={15}/>{modoTv?'Sair do modo TV':'Modo TV'}</button>
     <Link href="/clientes/identificar" title="Criar ou identificar cliente para abrir uma obra no fluxo oficial" className="inline-flex items-center gap-1.5 rounded-md bg-[#0061d5] px-3 py-2 text-[11px] font-bold text-white hover:bg-blue-600"><Plus size={15}/> Novo Projeto</Link>
    </div>
   </div>
   {mostrarOcultos&&usuarioMaster&&!demo&&<section className="mb-4 space-y-2 rounded-lg border border-[#29415d] bg-[#12283e] p-3">
    <h2 className="text-sm font-bold text-white">Cards retirados da Visão Geral</h2>
    <p className="text-xs text-[#b0c6df]">Nenhum registro foi excluído do Cliente 360. Somente o Master pode restaurar.</p>
    {ocultos.length===0?<p className="text-xs text-[#b0c6df]">Nenhum card retirado.</p>:
     ocultos.map(c=><div key={c.vendaId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#3a526d] bg-[#0d2138] px-3 py-2 text-xs">
      <div><b>{c.cliente}</b><p className="text-[11px] text-[#a7bfd9]">Orçamento {c.numeroOrcamento} · {c.motivoControle}</p></div>
      <button disabled={salvandoCard} onClick={()=>void operarMaster(c.vendaId,'restaurar')} className="rounded bg-blue-700 px-3 py-1.5 font-bold text-white disabled:opacity-40">Restaurar card</button>
     </div>)}
   </section>}
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
   {erro&&<div role="alert" className="fixed bottom-20 right-5 z-[120] max-w-[420px] rounded-xl border-2 border-rose-400 bg-rose-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">
    {erro}<button type="button" onClick={()=>setErro('')} className="ml-3 underline">Fechar</button>
   </div>}
   {!erro&&aviso&&<div role="status" aria-live="polite" className="fixed bottom-20 right-5 z-[120] max-w-[420px] rounded-xl border-2 border-emerald-400 bg-emerald-950 px-4 py-3 text-sm font-bold text-white shadow-2xl">
    {aviso}<button type="button" onClick={()=>setAviso('')} className="ml-3 underline">Fechar</button>
   </div>}
   <div className="mb-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">{montarKPIs.map(k=>{
    const Icone=k.icone
    return <div key={k.label} className="relative min-h-[80px] overflow-hidden rounded-lg border border-[#294461] bg-gradient-to-br from-[#152b46] to-[#0b1c32] px-3 py-3 shadow-[0_3px_18px_rgba(0,0,0,.13)]">
     <div className="pr-9 text-[11px] text-[#d0dbeb]">{k.label}</div>
     <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white" style={{background:k.cor+'25',boxShadow:'inset 0 0 0 1px '+k.cor+'55'}}><Icone size={20} style={{color:k.cor}}/></span>
     <div className="mt-1 flex flex-wrap items-baseline gap-2"><b className="text-[25px] font-bold leading-7 text-white">{k.numero}</b><span className="text-[10px] text-[#9bb7d8]">{k.detalhe}</span></div>
    </div>
   })}</div>
   {editandoColuna&&podeEditarColunas&&<div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-3" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)fecharEditorColuna()}}>
    <div role="dialog" aria-modal="true" aria-label={'Editar coluna '+editandoColuna.nome} className="flex w-full max-w-[560px] max-h-[90vh] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
     <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div><h2 className="text-lg font-extrabold">Editar coluna</h2><p className="text-xs text-slate-500">{editandoColuna.nome} · Somente Master</p></div>
      <button type="button" onClick={fecharEditorColuna} aria-label="Fechar sem salvar" className="rounded p-2 hover:bg-slate-100"><X size={20}/></button>
     </header>
     <div className="flex gap-1 border-b border-slate-200 px-4 py-2 text-xs font-bold">
      {([['coluna','Personalizar coluna'],['status','Status da coluna'],['prazo','Prazo da etapa']] as const).map(([id,nome])=>
       <button key={id} type="button" onClick={()=>setAbaConfigColuna(id)}
        className={'flex-1 rounded px-2 py-2 '+(abaConfigColuna===id?'bg-blue-600 text-white':'bg-slate-100 text-slate-700 hover:bg-slate-200')}>{nome}</button>)}
     </div>
     <div className="space-y-4 overflow-y-auto p-4 text-sm">
      {abaConfigColuna==='coluna'&&<>
       <label className="block space-y-1 text-xs font-bold">Nome da coluna
        <input value={nomeEditando[editandoColuna.id]??editandoColuna.nome} maxLength={70}
         onChange={e=>{edicaoColunasPendente.current=true;setNomeEditando(a=>({...a,[editandoColuna.id]:e.target.value}))}}
         className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Nome da coluna"/>
       </label>
       <label className="block space-y-1 text-xs font-bold">Descrição
        <textarea value={editandoColuna.descricao||''} maxLength={240} rows={3} onChange={e=>alterarColuna(editandoColuna.id,{descricao:e.target.value})}
         className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Descreva o objetivo desta etapa"/>
       </label>
       <label className="flex items-center gap-3 text-xs font-bold">Cor da coluna
        <input type="color" value={editandoColuna.cor||'#2679fb'} onChange={e=>alterarColuna(editandoColuna.id,{cor:e.target.value})}
         className="h-9 w-14 cursor-pointer rounded border border-slate-300" aria-label="Escolher cor da coluna"/>
       </label>
       <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs">
        <span className="font-semibold">Ordem:</span>
        <button type="button" onClick={()=>ordem(editandoColuna.id,-1)} className="rounded border px-3 py-1.5">← Mover para esquerda</button>
        <button type="button" onClick={()=>ordem(editandoColuna.id,1)} className="rounded border px-3 py-1.5">Mover para direita →</button>
       </div>
       <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
        <p className="font-semibold text-slate-600">Vínculo operacional (avançado)</p>
        <p className="text-slate-500">Altere apenas quando precisar associar uma etapa real. O movimento visual não altera os registros dos setores.</p>
        <div className="flex flex-wrap gap-2">
         <select value={novoCriterio} onChange={e=>setNovoCriterio(e.target.value as EtapaOperacional)} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-2">{ETAPAS_OPERACIONAIS.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select>
         <button type="button" onClick={()=>vincular(editandoColuna.id)} className="rounded border border-blue-400 px-3 py-2 font-semibold text-blue-800">Vincular</button>
        </div>
       </div>
      </>}
      {abaConfigColuna==='status'&&<>
       <p className="text-xs text-slate-600">O Master define os status disponíveis; funcionários autorizados podem marcar vários no mesmo card.</p>
       <div className="space-y-2">{(editandoColuna.statusDisponiveis||[]).map(s=>
        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
         <span className="min-w-0 flex-1 text-xs font-bold">{s.nome}</span>
         <label className="flex items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={s.conclusivo===true}
          onChange={e=>alterarColuna(editandoColuna.id,{statusDisponiveis:editandoColuna.statusDisponiveis?.map(x=>x.id===s.id?{...x,conclusivo:e.target.checked}:x)})}/> Conclui etapa</label>
         <button type="button" onClick={()=>alterarStatus(editandoColuna.id,s.id)} className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-blue-800">Editar</button>
        </div>)}</div>
       <button type="button" onClick={()=>adicionarStatus(editandoColuna.id)} className="rounded border border-blue-300 px-3 py-2 text-xs font-bold text-blue-800">+ Adicionar status</button>
       <p className="text-[11px] text-slate-500">A opção “Conclui etapa” marca o card como concluído no prazo, sem mover a obra para outra coluna.</p>
      </>}
      {abaConfigColuna==='prazo'&&<>
       <p className="text-xs text-slate-600">Defina o tempo máximo que o projeto pode permanecer nesta etapa, contado da entrada registrada do card.</p>
       <div className="flex flex-wrap gap-3">
        <label className="flex-1 space-y-1 text-xs font-bold">Prazo
         <input type="number" min="0" step="0.5" value={(()=>{const h=editandoColuna.prazoHoras??((editandoColuna.prazoDias??0)*24);return h>0?(unidadePrazos[editandoColuna.id]|| (editandoColuna.prazoHoras!=null?'horas':'dias'))==='horas'?h:h/24:''})()}
          onChange={e=>{const n=Number(e.target.value);const unidade=unidadePrazos[editandoColuna.id]|| (editandoColuna.prazoHoras!=null?'horas':'dias');alterarColuna(editandoColuna.id,{prazoDias:null,prazoHoras:e.target.value&&n>0?Math.round(n*(unidade==='horas'?1:24)):null})}}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Sem prazo"/>
        </label>
        <label className="space-y-1 text-xs font-bold">Unidade
         <select value={unidadePrazos[editandoColuna.id]||(editandoColuna.prazoHoras!=null?'horas':'dias')}
          onChange={e=>setUnidadePrazos(p=>({...p,[editandoColuna.id]:e.target.value as 'horas'|'dias'}))}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"><option value="horas">Horas</option><option value="dias">Dias</option></select>
        </label>
       </div>
       <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
        <p><b className="text-slate-600">Branco:</b> sem entrada confirmada ou sem prazo</p>
        <p><b className="text-slate-500">Branco:</b> aguardando início, dentro do prazo</p>
        <p><b className="text-amber-600">Amarelo:</b> em andamento e dentro do prazo</p>
        <p><b className="text-emerald-600">Verde:</b> etapa concluída dentro do prazo</p>
        <p><b className="text-rose-600">Vermelho:</b> prazo excedido</p>
       </div>
       <p className="text-[11px] text-slate-500">Cards antigos sem data confiável de entrada não serão marcados como atrasados automaticamente.</p>
      </>}
      {!!validade.length&&<p className="rounded bg-rose-50 p-2 text-xs text-rose-800">{validade.join('; ')}</p>}
      {!!avisoConfiguracao&&<p className="text-xs text-slate-500">{avisoConfiguracao}</p>}
     </div>
     <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white p-3">
      <button type="button" onClick={fecharEditorColuna} className="rounded border border-slate-300 px-4 py-2 text-xs font-bold">Cancelar</button>
      <button type="button" onClick={()=>void salvarConfig()} disabled={!!validade.length} className="rounded bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Salvar alterações</button>
     </footer>
    </div>
   </div>}
   <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
    <span className="inline-flex items-center gap-1"><ShieldCheck size={13}/> Etapas calculadas pelos setores; posições ajustadas manualmente não alteram os registros operacionais</span>
    <span>{carregando?'Consultando a empresa…':atualizado?'Atualizado: '+new Date(atualizado).toLocaleString('pt-BR'):'Aguardando dados'}</span>
   </div>
   <div data-kanban-scroll data-kanban-board className="w-full overflow-x-auto rounded-xl pb-3" aria-label="Kanban Geral de Projetos" style={{scrollbarColor:'#385578 #0e2139'}}
    onDragOver={e=>{
     const area=e.currentTarget.getBoundingClientRect()
     if(e.clientX<area.left+65)e.currentTarget.scrollLeft-=26
     else if(e.clientX>area.right-65)e.currentTarget.scrollLeft+=26
    }}>
    <div className="grid min-w-max items-stretch gap-2" style={{gridTemplateColumns:'repeat('+(colunasOrdenadas.length+(podeEditarColunas?1:0))+','+(compacto?'155px':'188px')+')'}}>
     {colunasOrdenadas.map((col,i)=>{
      const vis=agrupado.get(col.id)||[]
      const pedidosCol=pedidosVisiveis.filter(p=>col.criterios.includes(p.status==='aguardando'?'aguardando_materiais':'compras'))
      const manuaisCol=acompanhamentoVisivel.filter(c=>col.criterios.includes(c.etapa as EtapaOperacional))
      const paleta=COLUNA_CORES[(col.id==='validacao_projeto'?1:etapaIndice(col)>=1?etapaIndice(col)-1:etapaIndice(col))]||COLUNA_CORES[i%COLUNA_CORES.length]
      const Icon=paleta.icone
      const destinoFinalizado=col.criterios.includes('finalizado')
      const destinoVisual=col.id
      return <section data-kanban-coluna={col.id} key={col.id}
       onDragOver={e=>{if(!demo&&!salvandoCard){e.preventDefault();e.dataTransfer.dropEffect='move'}}}
       onDrop={e=>{
        if(demo||salvandoCard)return
        const origem=e.dataTransfer.getData('text/plain')
        if(origem.startsWith('atlas-coluna:')&&podeEditarColunas){soltarColuna(col.id);setArrastandoColuna(null);return}
        const id=origem.startsWith('atlas-principal:')?
         origem.slice('atlas-principal:'.length):(!origem?arrasteCard.current?.id:null)
        if(!id||!cards.some(c=>c.vendaId===id))return
        e.preventDefault()
        if(arrasteCard.current?.id===id)arrasteCard.current.tratado=true
        setArrastando(null);void moverCardVisual(id,destinoVisual)
       }}
       className={'flex min-h-[500px] min-w-0 flex-col overflow-hidden rounded-[9px] border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,.23)] '+(destinoVisual&&arrastando?'ring-2 ring-emerald-400':'')} style={{background:'linear-gradient(180deg,'+paleta.base+' 0%,#0b1c32 100%)'}}>
       <div className="min-h-[39px] px-2.5 py-2 text-white" style={{background:col.cor||paleta.cabecalho}}>
        <div className="flex items-center gap-1">
         <Icon size={15} className="shrink-0"/>
         <h2 className="min-w-0 flex-1 text-[11px] font-extrabold leading-tight">{col.nome}</h2>
         {podeEditarColunas&&<span draggable onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData('text/plain','atlas-coluna:'+col.id);e.dataTransfer.effectAllowed='move';setArrastandoColuna(col.id)}} onDragEnd={()=>setArrastandoColuna(null)} title="Arrastar para reorganizar coluna" className="cursor-grab" role="button" aria-label={'Arrastar coluna '+col.nome}><GripVertical size={14}/></span>}
         {podeEditarColunas&&<button type="button" title={'Editar coluna '+col.nome} aria-label={'Editar coluna '+col.nome} onClick={()=>{setEditarColunaId(col.id);setAbaConfigColuna('coluna')}} className="rounded px-1 text-lg font-bold leading-4 text-white hover:bg-white/20">⋮</button>}
         <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">{vis.length}{pedidosCol.length?' + '+pedidosCol.length:''}{manuaisCol.length?' + '+manuaisCol.length:''}</span>
        </div>
        {col.descricao&&<p title={col.descricao} className="mt-1 line-clamp-2 text-[10px] text-white/90">{col.descricao}</p>}
        {(col.prazoHoras||col.prazoDias)&&<p className="mt-1 flex items-center gap-1 text-[10px] text-white/90"><Clock3 size={11}/> Prazo: {col.prazoHoras?(col.prazoHoras+' h'):(col.prazoDias+' dias')}</p>}
       </div>
       <Link href="/clientes/identificar" title="Abrir o fluxo oficial de cliente e obra; a etapa será atualizada pelo Cliente 360" className="block border-t border-white/10 py-1.5 text-center text-[11px] font-semibold text-white hover:brightness-110" style={{background:paleta.botao}}>+ Adicionar</Link>
       <div className="flex flex-1 flex-col gap-2 p-[5px]">
        {!demo&&<p className="rounded border border-dashed border-white/30 px-1 py-2 text-center text-[10px] text-white/70">{destinoFinalizado?'Arraste um projeto para cá para finalizar no painel':'Arraste um card para reposicioná-lo aqui'}</p>}
        {vis.map(c=><div key={c.vendaId} data-kanban-card draggable={!demo&&!salvandoCard}
         onDragStart={e=>{
          if(demo||salvandoCard){e.preventDefault();return}
          e.dataTransfer.setData('text/plain','atlas-principal:'+c.vendaId)
          e.dataTransfer.effectAllowed='move'
          arrasteCard.current={id:c.vendaId,ponto:null,tratado:false}
          setArrastando(c.vendaId)
         }}
         onDrag={e=>{
          if(arrasteCard.current?.id===c.vendaId&&e.clientX>0&&e.clientY>0)
           arrasteCard.current.ponto={x:e.clientX,y:e.clientY}
         }}
         onDragEnd={e=>{
          const arraste=arrasteCard.current
          const foiTratado=!!(arraste?.id===c.vendaId&&arraste.tratado)
          const destino=foiTratado?null:colunaNoFimDoArraste(e.currentTarget,{x:e.clientX,y:e.clientY},arraste?.ponto||null)
          arrasteCard.current=null
          setArrastando(null)
          if(!foiTratado&&!demo&&!salvandoCard){
           if(destino)void moverCardVisual(c.vendaId,destino)
           else {setAviso('');setErro('Solte o card sobre uma coluna do Kanban para gravar. Nenhuma mudança foi salva.')}
          }
         }}
         className="cursor-grab active:cursor-grabbing">
          {!demo&&<AlcaArrastarCard desabilitado={salvandoCard}
            onSoltar={destino=>void moverCardVisual(c.vendaId,destino)}
            onSolturaInvalida={()=>{setAviso('');setErro('Solte dentro de uma coluna do Kanban para salvar. Nenhuma posição foi alterada.')}} label="Segure aqui e arraste" />}
          <CardProjeto card={c} coluna={col} abrir={()=>abrir(c.vendaId)} compacto={compacto} ativo={selecionado===c.vendaId}/>
         </div>)}
        {pedidosCol.map(p=><CardPedido key={p.id} pedido={p} abrir={()=>abrir(p.id)}/>)}
        {manuaisCol.map(c=><CardAcompanhamento key={c.id} card={c}/>)}
        {!vis.length&&!pedidosCol.length&&!manuaisCol.length&&<p className="rounded-lg border border-dashed border-white/15 bg-white/5 px-2 py-5 text-center text-[11px] text-slate-400">Nenhum card nesta etapa</p>}
       </div>
      </section>
     })}
     {podeEditarColunas&&<section ref={novaColunaRef} data-kanban-adicionar-coluna className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-blue-400/60 bg-[#102d4b] p-3 text-center">
      <Plus size={27} className="text-blue-300"/>
      <b className="text-xs text-white">Adicionar coluna</b>
      <input ref={novoNomeRef} value={novoNome} maxLength={70} onKeyDown={e=>{if(e.key==='Enter')criar()}} onChange={e=>setNovoNome(e.target.value)} placeholder="Nome da etapa" aria-label="Nome da nova coluna" className="w-full rounded border border-[#476382] bg-[#0b2037] px-2 py-2 text-xs text-white"/>
      <button type="button" onClick={criar} disabled={!novoNome.trim()} className="rounded bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">+ Adicionar</button>
      <span className="text-[10px] text-slate-300">Salvar na personalização para compartilhar com as obras.</span>
     </section>}
    </div>
   </div>
  </div>
  {(cardAtual||pedidoAtual)&&<div className="fixed inset-0 z-[70] bg-black/50 xl:pointer-events-none xl:bg-transparent" onClick={fechar}>
   <aside role="dialog" aria-modal="true" aria-label="Detalhes do projeto" onClick={e=>e.stopPropagation()} className="pointer-events-auto absolute inset-y-0 right-0 flex w-full max-w-[370px] flex-col overflow-y-auto bg-[#f7f9fd] text-slate-900 shadow-[-6px_0_24px_rgba(0,0,0,.24)] md:top-[52px]">
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
      {aba==='resumo'&&!!etapaCard?.statusDisponiveis?.length&&<section className="rounded-lg border border-slate-200 bg-white p-3">
       <h3 className="mb-2 text-xs font-extrabold text-[#1d335b]">Status de {etapaCard.nome}</h3>
       <p className="mb-2 text-[11px] text-slate-500">É possível selecionar vários status ao mesmo tempo, sem movimentar o projeto.</p>
       <div className="space-y-2">{(etapaCard.statusDisponiveis||[]).map(s=>{
        const selecionados=cardAtual.statusEtapa||[]
        const marcado=selecionados.includes(s.id)
        return <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-semibold">
         <input type="checkbox" checked={marcado} disabled={!podeMoverCards||alterandoStatus||demo===true}
          onChange={e=>void atualizarStatusCard(cardAtual.vendaId,etapaCard.id,e.target.checked?[...selecionados,s.id]:selecionados.filter(id=>id!==s.id))}/>
         <span className="flex-1">{s.nome}</span>
         {s.conclusivo&&<span className="text-[10px] font-medium text-emerald-700">Conclui etapa</span>}
        </label>
       })}</div>
       {!podeMoverCards&&<p className="mt-2 text-[10px] text-slate-500">Seu acesso é somente para visualização.</p>}
      </section>}
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
      {cardAtual.controleMaster==='manual'&&<div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900">
       <b>Posição visual definida manualmente</b>
       <p>Andamento operacional calculado: {cardAtual.etapaOrigem||'Não identificado'}. O movimento não atualiza os status dos setores.</p>
       {cardAtual.motivoControle&&<p className="mt-1">Motivo: {cardAtual.motivoControle}</p>}
      </div>}
      {cardAtual.controleMaster==='finalizado'&&<div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900">
       <b>Finalizado visualmente pelo Master</b>
       <p>Esta organização não altera a situação real no Cliente 360. Etapa operacional anterior: {cardAtual.etapaOrigem||'Não identificada'}.</p>
       {cardAtual.motivoControle&&<p className="mt-1">Motivo: {cardAtual.motivoControle}</p>}
      </div>}
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
      {podeMoverCards&&!demo&&<section className="space-y-2 rounded-lg border border-[#d5e1f2] bg-white p-3">
       <label className="block text-xs font-bold text-[#15294f]">Mover o card principal para a etapa
        <select aria-label="Mover card principal para etapa" value={cardAtual.colunaId} disabled={salvandoCard}
         onChange={e=>void moverCardVisual(cardAtual.vendaId,e.target.value)} className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900">
         {colunasOrdenadas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
       </label>
       <p className="text-[10px] text-slate-500">Arraste ou selecione uma coluna. Salva a posição nos dois Kanbans, sem mudar as operações.</p>
      </section>}
      {usuarioMaster&&!demo&&<section className="space-y-2 rounded-lg border border-[#d5e1f2] bg-white p-3">
       <h3 className="text-xs font-extrabold text-[#15294f]">Organização do Master</h3>
       <p className="text-[10px] leading-4 text-slate-500">Somente o Master pode finalizar ou retirar cards. Nenhuma ação aqui apaga venda, obra, materiais ou documentos.</p>
       <div className="flex flex-wrap gap-2">
        {cardAtual.controleMaster==='finalizado'?
         <button disabled={salvandoCard} onClick={()=>void operarMaster(cardAtual.vendaId,'restaurar')} className="rounded bg-blue-600 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-40">Voltar à etapa do Cliente 360</button>:
         <button disabled={salvandoCard} onClick={()=>void operarMaster(cardAtual.vendaId,'finalizar')} className="rounded bg-emerald-600 px-2 py-2 text-[11px] font-bold text-white disabled:opacity-40">Mover para Finalizado</button>}
        <button disabled={salvandoCard} onClick={()=>void operarMaster(cardAtual.vendaId,'ocultar')} className="rounded border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-bold text-rose-800 disabled:opacity-40">Excluir card do painel</button>
       </div>
      </section>}
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
