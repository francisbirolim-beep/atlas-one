'use client'

import VendaBarrasWVetro from '@/components/clientes/VendaBarrasWVetro'
import ObraEntradasManuais from '@/components/clientes/ObraEntradasManuais'
import VendaListaCompraWVetro from '@/components/clientes/VendaListaCompraWVetro'
import VendaListaCorteWVetro from '@/components/clientes/VendaListaCorteWVetro'
import VendaCotacoesIA from '@/components/clientes/VendaCotacoesIA'
import VendaCotacaoItensModal from '@/components/clientes/VendaCotacaoItensModal'
import VendaTipologiasMateriais from '@/components/clientes/VendaTipologiasMateriais'
import VendaMedidaFinal from '@/components/clientes/VendaMedidaFinal'
import VendaMedidaStatus from '@/components/clientes/VendaMedidaStatus'
import {gruposItensEmEtapa, urlPdfCardCotacao, progressoLotesCotacao, ETAPAS_COTACAO, type EtapaCotacao} from '@/lib/cotacaoEtapas'
import { confirmarMovimentoKanban } from '@/lib/kanbanConfirmacao'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Building2, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Factory,
  Boxes, FileDown, FileText, ImageIcon, Loader2, PackageCheck, Pencil, Plus, Receipt, RefreshCw, Replace, ShoppingCart, Trash2, Wallet, Wrench, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarRecebimentoVendaComDesconto } from '@/lib/cliente360Recebimentos'
import { adicionarDocumentoCliente } from '@/lib/cliente360'
import { tokenAtual, usuarioAtual } from '@/lib/auth'
import { adicionarMaterialManual, ajustarMaterial, excluirMaterialDoPacote, gerarPacoteTecnico, recalcularAproveitamentoPacote } from '@/lib/materialPlanejamento'
import VendaProducaoDetalhada from '@/components/clientes/VendaProducaoDetalhada'
import VendaProducaoKanbanPreview from '@/components/clientes/VendaProducaoKanbanPreview'
import VendaLiberacaoOrdens from '@/components/clientes/VendaLiberacaoOrdens'
import VendaVincularObra from '@/components/clientes/VendaVincularObra'
import VendaKanbanObra from '@/components/clientes/VendaKanbanObra'
import VendaInstalacaoDetalhada from '@/components/clientes/VendaInstalacaoDetalhada'
import VendaFinanceiroHaver from '@/components/clientes/VendaFinanceiroHaver'
import VendaNotasRecibos from '@/components/clientes/VendaNotasRecibos'
import VendaCmvPainel from '@/components/clientes/VendaCmvPainel'
import { avaliarFluxoVenda, type InstalacaoResumo } from '@/lib/vendaFluxoResumo'
import { refItemProducaoInstalacao } from '@/lib/vendaInstalacaoProducao'
import { custoRealCompraConfirmada } from '@/lib/vendaCmvRegras'
import { custoRevisado } from '@/lib/vendaCmvRevisao'

type Venda = {
  id:string
  numero?:number|null
  orcamento_id:string
  cliente_id:string
  obra_id?:string|null
  valor_venda?:number|null
  custo_previsto?:number|null
  status?:string|null
  confirmado_em?:string|null
  confirmado_por_nome?:string|null
  itens_snapshot?:any[]|null
}
type Cliente = { id:string; nome:string; cidade?:string|null }
type Obra = { id:string; numero?:number|null; nome:string; status?:string|null; previsao_entrega?:string|null }
type Orcamento = {
  id:string; numero?:number|null; valor_estimado?:number|null; custo_estimado?:number|null;
  status?:string|null; itens?:any[]|null; wvetro_fluxo?:{numero?:string|null;origem?:string|null}|null
}
type Conta = { id:string; venda_obra_id?:string|null; valor?:number|null; valor_pago?:number|null; valor_desconto?:number|null; status?:string|null; vencimento?:string|null; documento?:string|null; parcela?:number|null; total_parcelas?:number|null }
type Compra = { id:string; produto_id?:string|null; descricao?:string|null; categoria?:string|null; quantidade?:number|null; unidade?:string|null; status?:string|null; recebido_em?:string|null; observacoes?:string|null; created_at:string }
type ProdutoCompra = { id:string; codigo?:string|null; nome?:string|null; foto_url?:string|null; categoria?:string|null }
type CotacaoCompra = { id:string; necessidade_id:string; fornecedor_id?:string|null; preco_unitario?:number|null; frete?:number|null; prazo_dias?:number|null; previsao_entrega?:string|null; selecionada?:boolean|null }
type FornecedorCompra = { id:string; nome:string }
type Ordem = { id:string; numero?:number|null; titulo?:string|null; item_ref?:string|null; quantidade?:number|null; status?:string|null; created_at:string; tipo_producao?:string|null; item_snapshot?:Record<string,any>|null; largura_mm?:number|null; altura_mm?:number|null; bloqueada?:boolean|null; bloqueio_motivo?:string|null }
type SetorItem = { id:string; coluna_id:string; titulo?:string|null; atualizado_em?:string|null }
type SetorColuna = { id:string; setor_id:string; nome:string; ordem:number }
type Documento = { id:string; obra_id?:string|null; titulo:string; nome_arquivo?:string|null; url:string; created_at:string; tipo?:string|null }
type RecebimentoVenda = { id:string; data_recebimento?:string|null; valor?:number|null; valor_desconto?:number|null; desconto?:number|null; forma?:string|null; referencia?:string|null; observacoes?:string|null; status?:string|null; criado_por_nome?:string|null; created_at?:string|null }
type MaterialTecnico = { id:string; produto_id?:string|null; categoria:string; codigo?:string|null; descricao:string; unidade:string; quantidade_tecnica?:number|null; quantidade_ajustada?:number|null; comprimento_corte_mm?:number|null; comprimento_barra_mm?:number|null; cor_ref?:string|null; item_ref?:string|null; origem_calculo?:string|null; status_calculo?:string|null; status_compra?:string|null; status_compra_atualizado_em?:string|null; incluido_manual?:boolean|null; justificativa_ajuste?:string|null; custo_wvetro?:number|null; venda_wvetro?:number|null; wvetro_dados?:Record<string,any>|null }
type SeparacaoMaterial = { id:string; material_id?:string|null; produto_id?:string|null; tipo_origem?:string|null; quantidade?:number|null; comprimento_disponivel_mm?:number|null; comprimento_utilizado_mm?:number|null; status?:string|null; observacoes?:string|null }
type ProdutoMaterial = { id:string; codigo?:string|null; nome?:string|null; unidade?:string|null; tamanho_barra_mm?:number|null; foto_url?:string|null; categoria?:string|null }
type ItemPdfCompra = { material_id:string; necessidade_id:string; codigo?:string; descricao:string; quantidade_necessaria?:number; quantidade_documento?:number|null; unidade?:string; unidade_documento?:string; valor_unitario?:number|null; confianca:number; observacao?:string; origem?:string; validacao:'sugerido_comprado'|'pendente_validacao' }
type DadosPedidoCompra = { numero?:string|null; valor_total?:number|null; prazo_entrega?:string|null; previsao_entrega?:string|null; observacoes?:string|null }
type AnalisePdfCompra = {
  arquivo:{nome:string;tamanho:number;paginas?:number|null}
  fornecedor?:{id?:string|null;nome:string;cnpj?:string|null;origem?:string}|null
  pedido?:DadosPedidoCompra|null
  itens:ItemPdfCompra[]
  sugeridos:ItemPdfCompra[]
  pendencias:Array<{texto?:string;motivo?:string}>
  faltando:Array<{material_id:string;necessidade_id:string;codigo?:string;descricao:string;quantidade_necessaria?:number;unidade?:string}>
  resumo:{materiaisCategoria:number;identificados:number;sugeridosComprados:number;pendentesValidacao:number;aindaNaoIdentificados:number}
  ia?:{utilizada:boolean;erro?:string|null}
  documentoUrl?:string|null
  documentoId?:string|null
}

type LoteCotacao = {
  id:string;venda_obra_id:string;pacote_id:string;categoria:'perfil'|'acessorios'|'vidro'|'outros'
  status:string;quantidade_itens:number;versao:number;itens:Array<{material_id:string;codigo:string|null;descricao:string;unidade:string;quantidade_cotar:number;cor?:string|null;comprimento_corte_mm?:number|null;status_etapa?:string|null;grupo_card_id?:string|null}>
  gerado_por_nome?:string|null;created_at:string;updated_at:string
}
type Aba='visao'|'financeiro'|'custos'|'compras'|'materiais'|'tipologias'|'medida-final'|'producao'|'instalacao'|'notas'|'documentos'|'historico'
interface Props{clienteId:string;vendaId:string}

function moeda(v?:number|null){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function numeroEntrada(v:string){
  let s=String(v||'').trim().replace(/[^0-9,.-]/g,'')
  if(!s)return 0
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')
  else if(s.includes(','))s=s.replace(/\./g,'').replace(',','.')
  const n=Number(s)
  return Number.isFinite(n)?n:0
}
function dataBR(v?:string|null){if(!v)return '—';const d=new Date(v.length===10?`${v}T12:00:00`:v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}
function dataHoraBR(v?:string|null){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}
function dataInputLocal(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function status(v?:string|null){return v?v.replace(/_/g,' ').replace(/^./,s=>s.toUpperCase()):'—'}
function pct(parte:number,total:number){return total>0?Math.min(100,Math.max(0,(parte/total)*100)):0}
function numeroOrcamento(o?:Orcamento|null){return o?.wvetro_fluxo?.numero||o?.numero||'—'}
function finalizada(v?:string|null){return ['concluido','concluida','concluído','concluída','finalizado','finalizada','produzido','pronto','recebido'].includes(String(v||'').toLowerCase())}
function compraEfetivada(v?:string|null){return ['aprovado','pedido_emitido','aguardando_entrega','recebido'].includes(String(v||'').toLowerCase())}
function categoriaMaterial(v?:string|null):'perfil'|'vidro'|'acessorios'|'outros'{
  const s=String(v||'').toLocaleLowerCase('pt-BR')
  if(s.includes('perfil'))return 'perfil'
  if(s.includes('vidro'))return 'vidro'
  if(s.includes('acess'))return 'acessorios'
  return 'outros'
}
function progressoItens(lista:Compra[], predicado:(item:Compra)=>boolean){
  return lista.length ? (lista.filter(predicado).length/lista.length)*100 : 0
}
function rotuloCategoria(cat:'perfil'|'vidro'|'acessorios'|'outros'){
  return cat==='perfil'?'Perfil':cat==='vidro'?'Vidro':cat==='acessorios'?'Acessórios':'Outros'
}
function categoriaMaterialTecnico(v?:string|null):'perfil'|'vidro'|'acessorios'|'outros'{
  const s=String(v||'').toLowerCase()
  if(s==='perfil'||s==='contramarco')return 'perfil'
  if(s==='acessorio')return 'acessorios'
  if(s==='vidro')return 'vidro'
  return 'outros'
}
function temaCategoria(cat:'perfil'|'vidro'|'acessorios'|'outros'){
  if(cat==='perfil')return {borda:'border-blue-300',fundo:'bg-blue-50/50',texto:'text-blue-700',barra:'bg-blue-600'}
  if(cat==='acessorios')return {borda:'border-violet-300',fundo:'bg-violet-50/50',texto:'text-violet-700',barra:'bg-violet-600'}
  if(cat==='vidro')return {borda:'border-cyan-300',fundo:'bg-cyan-50/50',texto:'text-cyan-700',barra:'bg-cyan-600'}
  return {borda:'border-amber-300',fundo:'bg-amber-50/50',texto:'text-amber-700',barra:'bg-amber-500'}
}
function imagemWvetroMaterial(material?:MaterialTecnico|null){
  const d=material?.wvetro_dados||{}
  const candidatos=[d.imagem_atlas_url,d.imagemAtlasUrl,d.imagem_url,d.image_url,d.foto_url,d.fotoUrl]
  return candidatos.find((v:any)=>typeof v==='string'&&v.trim())||null
}
function dadosCompra(item:Compra){
  const obs=String(item.observacoes||'')
  const pegar=(rotulo:string)=>{
    const re=new RegExp(rotulo+'\\s*:\\s*([^\\n]+)','gi')
    const matches=[...obs.matchAll(re)]
    return matches.length?matches[matches.length-1][1].trim():null
  }
  const valorTexto=pegar('Valor(?: total)?')
  return {
    fornecedor:pegar('Fornecedor'),
    pedido:pegar('Pedido|N(?:ú|u)mero do pedido|Pedido fornecedor'),
    prazo:pegar('Prazo|Prazo de entrega'),
    documento:pegar('Documento'),
    documentoUrl:pegar('Documento URL'),
    valor:valorTexto?numeroEntrada(valorTexto):null,
    previsaoEntrega:pegar('Previsão|Previsao'),
  }
}

function ItemCompraVisual({codigo,descricao,imagem,imagemObrigatoria}:{codigo?:string|null;descricao:string;imagem?:string|null;imagemObrigatoria:boolean}){
  return <div className="flex min-w-[250px] items-center gap-3">
    <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border bg-white ${!imagem&&imagemObrigatoria?'border-amber-300':'border-slate-200'}`}>
      {imagem?<img src={imagem} alt={descricao} className="h-full w-full object-contain p-1"/>:<ImageIcon size={18} className={imagemObrigatoria?'text-amber-400':'text-slate-300'}/>}
    </div>
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600">{codigo||'Sem código'}</span>
        {!imagem&&imagemObrigatoria&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Imagem pendente</span>}
      </div>
      <b className="mt-1 block text-sm text-slate-800">{descricao}</b>
      {!imagem&&imagemObrigatoria&&<p className="mt-0.5 text-[10px] text-amber-700">Cadastrar imagem no produto técnico.</p>}
    </div>
  </div>
}

function Kpi({titulo,valor,detalhe,destaque}:{titulo:string;valor:string;detalhe?:string;destaque?:boolean}){
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p>
    <p className={`mt-1 text-xl font-bold ${destaque?'text-brand-teal':'text-slate-900'}`}>{valor}</p>
    {detalhe&&<p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
  </div>
}
function Progresso({titulo,valor,detalhe,ativo,onClick}:{titulo:string;valor:number;detalhe:string;ativo?:boolean;onClick:()=>void}){
  return <button type="button" onClick={onClick} className={`rounded-xl border bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-sm ${ativo?'border-blue-500 ring-2 ring-blue-100':'border-slate-200'}`}>
    <div className="flex items-center justify-between gap-2"><b className="text-sm text-slate-800">{titulo}</b><span className="flex items-center gap-1 text-xs font-bold text-slate-500">{Math.round(valor)}% <ChevronRight size={13}/></span></div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-brand-teal" style={{width:`${valor}%`}}/></div>
    <p className="mt-2 text-[11px] text-slate-500">{detalhe}</p>
  </button>
}
function Box({titulo,children}:{titulo:string;children:React.ReactNode}){
  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold text-slate-800">{titulo}</h2></div><div className="p-5">{children}</div></section>
}

export default function VendaObraCentral({clienteId,vendaId}:Props){
  const [venda,setVenda]=useState<Venda|null>(null)
  const [cliente,setCliente]=useState<Cliente|null>(null)
  const [obra,setObra]=useState<Obra|null>(null)
  const [orcamento,setOrcamento]=useState<Orcamento|null>(null)
  const [contas,setContas]=useState<Conta[]>([])
  const [realizadoCmvManual,setRealizadoCmvManual]=useState(0)
  const [previsaoCmvRevisada,setPrevisaoCmvRevisada]=useState<{vendaId:string;valor:number|null}|null>(null)
  const [compras,setCompras]=useState<Compra[]>([])
  const [lotesCotacao,setLotesCotacao]=useState<LoteCotacao[]>([])
  const [movendoLoteId,setMovendoLoteId]=useState<string|null>(null)
  const [cardCotacaoAberto,setCardCotacaoAberto]=useState<{loteId:string;etapa:EtapaCotacao;grupoId:string}|null>(null)
  const [emitindoCotacao,setEmitindoCotacao]=useState(false)
  const [produtosCompras,setProdutosCompras]=useState<Record<string,ProdutoCompra>>({})
  const [cotacoesCompras,setCotacoesCompras]=useState<CotacaoCompra[]>([])
  const [fornecedoresCompras,setFornecedoresCompras]=useState<Record<string,FornecedorCompra>>({})
  const [ordens,setOrdens]=useState<Ordem[]>([])
  const [instalacoes,setInstalacoes]=useState<InstalacaoResumo[]>([])
  const [setorItens,setSetorItens]=useState<SetorItem[]>([])
  const [setorColunas,setSetorColunas]=useState<Record<string,SetorColuna>>({})
  const [documentos,setDocumentos]=useState<Documento[]>([])
  const [recebimentosVenda,setRecebimentosVenda]=useState<RecebimentoVenda[]>([])
  const [materiaisTecnicos,setMateriaisTecnicos]=useState<MaterialTecnico[]>([])
  const [sincronizacaoListaCompraKey,setSincronizacaoListaCompraKey]=useState(0)
  const [separacoesMateriais,setSeparacoesMateriais]=useState<SeparacaoMaterial[]>([])
  const [produtosMateriais,setProdutosMateriais]=useState<Record<string,ProdutoMaterial>>({})
  const [categoriaMaterialAberta,setCategoriaMaterialAberta]=useState<'perfil'|'acessorios'|'vidro'|'outros'>('perfil')
  const [ocupadoMateriais,setOcupadoMateriais]=useState(false)
  const [pacoteTecnicoId,setPacoteTecnicoId]=useState<string|null>(null)
  const [sincronizandoMateriais,setSincronizandoMateriais]=useState(false)
  const [mensagemMateriais,setMensagemMateriais]=useState('')
  const [selecionadosMateriais,setSelecionadosMateriais]=useState<string[]>([])
  const [materialArrastandoId,setMaterialArrastandoId]=useState<string|null>(null)
  const [colunaArrasteSobre,setColunaArrasteSobre]=useState<'faltas'|'cotacao'|'comprado'|'entrega'|'recebido'|null>(null)
  const [filtroSituacaoMaterial,setFiltroSituacaoMaterial]=useState<'todos'|'faltas'|'cotacao'|'comprado'|'entrega'|'recebido'>('todos')
  const [analisandoPdfCompra,setAnalisandoPdfCompra]=useState(false)
  const [analisePdfCompra,setAnalisePdfCompra]=useState<AnalisePdfCompra|null>(null)
  const [selecionadosPdfCompra,setSelecionadosPdfCompra]=useState<string[]>([])
  const inputPdfCompraRef=useRef<HTMLInputElement>(null)
  const listaMateriaisRef=useRef<HTMLDivElement>(null)
  const tentouMaterializarVenda=useRef<string|null>(null)
  const [aba,setAba]=useState<Aba>('visao')
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get('aba')==='medida-final')setAba('medida-final')
  },[vendaId])
  const [editorCortesAberto,setEditorCortesAberto]=useState(false)
  const [painelEtapa,setPainelEtapa]=useState<'financeiro'|'compras'|'mercadoria'|'producao'|'instalacao'|'venda'|null>(null)
  const [categoriaAberta,setCategoriaAberta]=useState<'perfil'|'vidro'|'acessorios'|'outros'>('perfil')
  const [comprasColunasExpandidas,setComprasColunasExpandidas]=useState<string[]>([])
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [modalRecebimento,setModalRecebimento]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const salvandoRecebimentoRef=useRef(false)
  const [preparandoFluxo,setPreparandoFluxo]=useState(false)
  const [mensagemFluxo,setMensagemFluxo]=useState('')
  const [recebimento,setRecebimento]=useState({valor:'',desconto:'',forma:'pix',data:dataInputLocal(new Date()),referencia:'',observacoes:''})

  useEffect(()=>{
    tentouMaterializarVenda.current=null
    void carregar()
  },[vendaId,clienteId])

  useEffect(()=>{
    let ativo=true
    setRealizadoCmvManual(0)
    void (async()=>{
      try{
        const token=await tokenAtual()
        if(!token)return
        const resposta=await fetch('/api/vendas/cmv?vendaId='+encodeURIComponent(vendaId),{headers:{Authorization:'Bearer '+token},cache:'no-store'})
        if(!resposta.ok)return
        const dados=await resposta.json()
        if(ativo){
          setRealizadoCmvManual(((dados.lancamentos||[]) as {valor:number;etapa_cmv?:string}[])
            .filter(l=>l.etapa_cmv!=='recebido').reduce((s,l)=>s+Number(l.valor||0),0))
          // Uma única fonte para o cartão superior e a aba Custos: aplica as correções humanas auditadas.
          setPrevisaoCmvRevisada({vendaId,valor:dados.previsto?custoRevisado(dados.previsto,dados.revisoes||{},'total'):null})
        }
      }catch{}
    })()
    return ()=>{ativo=false}
  },[vendaId])

  useEffect(()=>{
    if(carregando||!venda||pacoteTecnicoId||sincronizandoMateriais)return
    if(tentouMaterializarVenda.current===venda.id)return
    tentouMaterializarVenda.current=venda.id
    void sincronizarMateriaisWVetro(true)
  },[carregando,venda?.id,pacoteTecnicoId])

  async function atualizarComposicaoTipologia(){
    if(!pacoteTecnicoId)return
    const mt=await supabase.from('pacote_tecnico_materiais')
      .select('id,produto_id,categoria,codigo,descricao,unidade,quantidade_tecnica,quantidade_ajustada,comprimento_corte_mm,comprimento_barra_mm,cor_ref,item_ref,origem_calculo,status_calculo,status_compra,status_compra_atualizado_em,incluido_manual,justificativa_ajuste,custo_wvetro,venda_wvetro,wvetro_dados')
      .eq('pacote_id',pacoteTecnicoId).eq('excluido',false).order('categoria').order('ordem')
    if(mt.error)throw Error('Não foi possível atualizar os materiais: '+mt.error.message)
    const atuais=(mt.data||[]) as MaterialTecnico[]
    const ids=[...new Set(atuais.map(m=>m.produto_id).filter(Boolean))] as string[]
    if(ids.length){
      const pr=await supabase.from('produtos').select('id,codigo,nome,unidade,tamanho_barra_mm,foto_url,categoria').in('id',ids)
      if(pr.error)throw Error('Não foi possível atualizar as imagens: '+pr.error.message)
      setProdutosMateriais(Object.fromEntries(((pr.data||[]) as ProdutoMaterial[]).map(x=>[x.id,x])))
    }else setProdutosMateriais({})
    setMateriaisTecnicos(atuais)
  }

  async function carregar(){
    setCarregando(true);setErro('')
    const vr=await supabase.from('vendas_obras').select('id,numero,orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,status,confirmado_em,confirmado_por_nome,itens_snapshot').eq('id',vendaId).eq('cliente_id',clienteId).maybeSingle()
    if(vr.error||!vr.data){setErro('Venda não encontrada para este cliente.');setCarregando(false);return}
    const v=vr.data as Venda; setVenda(v)
    // Cada lote é uma solicitação de cotação por categoria, independente de compra aprovada.
    try{
      const token=await tokenAtual()
      if(token){
        const resp=await fetch('/api/vendas/cotacoes-lotes?vendaId='+encodeURIComponent(v.id),
          {headers:{Authorization:'Bearer '+token},cache:'no-store'})
        if(resp.ok){
          const json=await resp.json()
          setLotesCotacao((json.lotes||[]) as LoteCotacao[])
        }
      }
    }catch{/* Mantém a venda acessível quando a consulta de cotação estiver indisponível. */}

    const [cr,or,co,op,si,ii]=await Promise.all([
      supabase.from('clientes').select('id,nome,cidade').eq('id',v.cliente_id).maybeSingle(),
      supabase.from('orcamentos').select('id,numero,valor_estimado,custo_estimado,status,itens,wvetro_fluxo').eq('id',v.orcamento_id).maybeSingle(),
      supabase.from('financeiro_contas_receber').select('id,venda_obra_id,valor,valor_pago,valor_desconto,status,vencimento,documento,parcela,total_parcelas').eq('venda_obra_id',v.id).order('vencimento',{ascending:true}),
      supabase.from('ordens_producao').select('id,numero,titulo,item_ref,quantidade,quantidade_produzida,status,created_at,tipo_producao,item_snapshot,largura_mm,altura_mm,bloqueada,bloqueio_motivo').eq('venda_obra_id',v.id).order('created_at',{ascending:true}),
      supabase.from('setor_kanban_itens').select('id,coluna_id,titulo,atualizado_em').eq('orcamento_id',v.orcamento_id),
      supabase.from('venda_instalacao_itens').select('id,item_ref,status,quantidade,quantidade_instalada,pendencia,checklist').eq('venda_obra_id',v.id),
    ])

    if(cr.data)setCliente(cr.data as Cliente)
    if(or.data)setOrcamento(or.data as Orcamento)
    setContas((co.data||[]) as Conta[])
    setOrdens((op.data||[]) as Ordem[])
    setInstalacoes((ii.data||[]) as InstalacaoResumo[])
    setSetorItens((si.data||[]) as SetorItem[])

    const pacoteResp=await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id',v.orcamento_id).neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(pacoteResp.data?.id){
      setPacoteTecnicoId(pacoteResp.data.id)
      const [mt,sep]=await Promise.all([
        supabase.from('pacote_tecnico_materiais').select('id,produto_id,categoria,codigo,descricao,unidade,quantidade_tecnica,quantidade_ajustada,comprimento_corte_mm,comprimento_barra_mm,cor_ref,item_ref,origem_calculo,status_calculo,status_compra,status_compra_atualizado_em,incluido_manual,justificativa_ajuste,custo_wvetro,venda_wvetro,wvetro_dados').eq('pacote_id',pacoteResp.data.id).eq('excluido',false).order('categoria').order('ordem'),
        supabase.from('pacote_tecnico_separacoes').select('id,material_id,produto_id,tipo_origem,quantidade,comprimento_disponivel_mm,comprimento_utilizado_mm,status,observacoes').eq('pacote_id',pacoteResp.data.id).neq('status','cancelado'),
      ])
      const materiais=(mt.data||[]) as MaterialTecnico[]
      setMateriaisTecnicos(materiais)
      setSeparacoesMateriais((sep.data||[]) as SeparacaoMaterial[])
      const materialProdutoIds=[...new Set(materiais.map(m=>m.produto_id).filter(Boolean))] as string[]
      if(materialProdutoIds.length){
        const pr=await supabase.from('produtos').select('id,codigo,nome,unidade,tamanho_barra_mm,foto_url,categoria').in('id',materialProdutoIds)
        setProdutosMateriais(Object.fromEntries(((pr.data||[]) as ProdutoMaterial[]).map(p=>[p.id,p])))
      }else setProdutosMateriais({})
    }else{
      setPacoteTecnicoId(null)
      setMateriaisTecnicos([])
      setSeparacoesMateriais([])
      setProdutosMateriais({})
    }

    const contasBase=((co.data||[]) as Conta[])
    const contaIds=contasBase.map(x=>x.id)
    if(contaIds.length){
      const aloc=await supabase.from('financeiro_recebimento_alocacoes').select('recebimento_id,conta_receber_id,tipo,valor').in('conta_receber_id',contaIds)
      const descontosConta:Record<string,number>={}
      ;(aloc.data||[]).filter((x:any)=>x.tipo==='desconto'&&x.conta_receber_id).forEach((x:any)=>{descontosConta[x.conta_receber_id]=(descontosConta[x.conta_receber_id]||0)+Number(x.valor||0)})
      setContas(contasBase.map(c=>({...c,valor_desconto:Math.max(Number(c.valor_desconto||0),descontosConta[c.id]||0)})))
      const recebimentoIds=[...new Set((aloc.data||[]).map((x:any)=>x.recebimento_id).filter(Boolean))]
      if(recebimentoIds.length){
        const rr=await supabase.from('financeiro_recebimentos').select('id,data_recebimento,valor,valor_desconto,forma,referencia,observacoes,status,criado_por_nome,created_at').in('id',recebimentoIds).order('data_recebimento',{ascending:false}).order('created_at',{ascending:false})
        const descontos:Record<string,number>={}
        ;(aloc.data||[]).filter((x:any)=>x.tipo==='desconto').forEach((x:any)=>{descontos[x.recebimento_id]=(descontos[x.recebimento_id]||0)+Number(x.valor||0)})
        setRecebimentosVenda(((rr.data||[]) as RecebimentoVenda[]).map(r=>({...r,desconto:Math.max(Number((r as any).valor_desconto||0),descontos[r.id]||0)})))
      }else setRecebimentosVenda([])
    }else setRecebimentosVenda([])

    if(v.obra_id){
      const [ob,cp,dc]=await Promise.all([
        supabase.from('obras').select('id,numero,nome,status,previsao_entrega').eq('id',v.obra_id).maybeSingle(),
        supabase.from('compras_necessidades').select('id,produto_id,descricao,categoria,quantidade,unidade,status,recebido_em,observacoes,created_at').eq('obra_id',v.obra_id).order('created_at',{ascending:true}),
        supabase.from('cliente_documentos').select('id,obra_id,titulo,nome_arquivo,url,created_at,tipo').eq('cliente_id',v.cliente_id).eq('obra_id',v.obra_id).order('created_at',{ascending:false}),
      ])
      if(ob.data)setObra(ob.data as Obra)
      const comprasObra=(cp.data||[]) as Compra[]
      setCompras(comprasObra)
      setDocumentos((dc.data||[]) as Documento[])

      const produtoIds=[...new Set(comprasObra.map(item=>item.produto_id).filter(Boolean))] as string[]
      if(produtoIds.length){
        const produtos=await supabase.from('produtos').select('id,codigo,nome,foto_url,categoria').in('id',produtoIds)
        setProdutosCompras(Object.fromEntries(((produtos.data||[]) as ProdutoCompra[]).map(item=>[item.id,item])))
      }else setProdutosCompras({})

      const necessidadeIds=comprasObra.map(item=>item.id)
      if(necessidadeIds.length){
        const cot=await supabase.from('compras_cotacoes').select('id,necessidade_id,fornecedor_id,preco_unitario,frete,prazo_dias,previsao_entrega,selecionada').in('necessidade_id',necessidadeIds).eq('selecionada',true)
        const cotacoes=(cot.data||[]) as CotacaoCompra[]
        setCotacoesCompras(cotacoes)
        const fornecedorIds=[...new Set(cotacoes.map(item=>item.fornecedor_id).filter(Boolean))] as string[]
        if(fornecedorIds.length){
          const fr=await supabase.from('fornecedores').select('id,nome').in('id',fornecedorIds)
          setFornecedoresCompras(Object.fromEntries(((fr.data||[]) as FornecedorCompra[]).map(item=>[item.id,item])))
        }else setFornecedoresCompras({})
      }else{
        setCotacoesCompras([])
        setFornecedoresCompras({})
      }
    }else{
      setObra(null)
      setCompras([])
      setProdutosCompras({})
      setCotacoesCompras([])
      setFornecedoresCompras({})
      setDocumentos([])
    }

    const colunaIds=[...new Set(((si.data||[]) as SetorItem[]).map(x=>x.coluna_id).filter(Boolean))]
    if(colunaIds.length){
      const cols=await supabase.from('setor_kanban_colunas').select('id,setor_id,nome,ordem').in('id',colunaIds)
      setSetorColunas(Object.fromEntries(((cols.data||[]) as SetorColuna[]).map(c=>[c.id,c])))
    }else setSetorColunas({})

    const falha=cr.error||or.error||co.error||op.error||si.error||ii.error
    if(falha)setErro(falha.message)
    setCarregando(false)
  }

  async function atualizarStatusInstalacao(){
    if(!vendaId)return
    const rr=await supabase.from('venda_instalacao_itens')
      .select('id,item_ref,status,quantidade,quantidade_instalada,pendencia,checklist')
      .eq('venda_obra_id',vendaId)
    if(rr.error){setErro('Não foi possível atualizar a instalação: '+rr.error.message);return}
    setInstalacoes((rr.data||[]) as InstalacaoResumo[])
  }

  async function sincronizarMateriaisWVetro(silencioso=false){
    if(!venda||sincronizandoMateriais)return
    setSincronizandoMateriais(true)
    if(!silencioso)setMensagemMateriais('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const resp=await fetch('/api/integracoes/wvetro/vendas/materializar',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId:venda.id}),
      })
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok){
        const mensagem=json?.error||'Não foi possível carregar os materiais do W.Vetro.'
        if(!silencioso||resp.status!==409)setMensagemMateriais(mensagem)
        return
      }
      setMensagemMateriais(json?.mensagem||`Materiais W.Vetro #${json?.numeroWvetro||''} carregados.`)
      await carregar()
    }catch(e){
      const mensagem=e instanceof Error?e.message:'Falha ao sincronizar materiais do W.Vetro.'
      if(!silencioso)setMensagemMateriais(mensagem)
    }finally{
      setSincronizandoMateriais(false)
    }
  }

  const valorVenda=Number(venda?.valor_venda||orcamento?.valor_estimado||0)
  const custoWvetro=(orcamento?.wvetro_fluxo||{}) as Record<string,unknown>
  const resumoWVetro=[Number(custoWvetro.custo_sem_sobra||0),Number(custoWvetro.custo_com_sobra||0)].filter(v=>Number.isFinite(v)&&v>0)
  const custoPrevisto=resumoWVetro.length?Math.max(...resumoWVetro):Number(venda?.custo_previsto||orcamento?.custo_estimado||0)
  const cotacaoPorNecessidade=useMemo(()=>Object.fromEntries(cotacoesCompras.map(item=>[item.necessidade_id,item])),[cotacoesCompras])
  function custoCompraReal(item:Compra){
    // Uma cotação, por si só, não é custo realizado; valor confirmado é obrigatório.
    return custoRealCompraConfirmada(item.status,dadosCompra(item).valor)
  }
  const custosPorCategoria=useMemo(()=>{
    const base:{perfil:{previsto:number;realizado:number;itens:number};vidro:{previsto:number;realizado:number;itens:number};acessorios:{previsto:number;realizado:number;itens:number};outros:{previsto:number;realizado:number;itens:number}}={
      perfil:{previsto:0,realizado:0,itens:0},vidro:{previsto:0,realizado:0,itens:0},acessorios:{previsto:0,realizado:0,itens:0},outros:{previsto:0,realizado:0,itens:0}
    }
    materiaisTecnicos.forEach(m=>{
      const cat=categoriaMaterialTecnico(m.categoria)
      const qtd=Number(m.quantidade_ajustada??m.quantidade_tecnica??0)
      base[cat].previsto+=Number(m.custo_wvetro||0)*Math.max(qtd,1)
      base[cat].itens+=1
    })
    compras.forEach(item=>{
      const cat=categoriaMaterial(item.categoria)
      const valor=custoCompraReal(item)
      if(valor>0&&compraEfetivada(item.status))base[cat].realizado+=valor
    })
    return base
  },[materiaisTecnicos,compras,cotacoesCompras])
  const custoPrevistoTecnico=Object.values(custosPorCategoria).reduce((s,c)=>s+c.previsto,0)
  const custoPrevistoBase=previsaoCmvRevisada?.vendaId===vendaId&&previsaoCmvRevisada.valor!==null
    ?previsaoCmvRevisada.valor:(custoPrevisto>0?custoPrevisto:custoPrevistoTecnico)
  const custoRealizado=Object.values(custosPorCategoria).reduce((s,c)=>s+c.realizado,0)+realizadoCmvManual
  const margemReal=valorVenda>0&&custoRealizado>0?((valorVenda-custoRealizado)/valorVenda)*100:0
  const cmvReal=valorVenda>0&&custoRealizado>0?(custoRealizado/valorVenda)*100:0
  const recebido=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor_pago||0),0)
  const saldoContas=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
  const aReceber=contas.length?saldoContas:Math.max(0,valorVenda-recebido)
  const totalTitulosAtivos=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor||0),0)
  const valorVendaDifereFinanceiro=contas.some(c=>c.status!=='cancelado')&&Math.abs(totalTitulosAtivos-valorVenda)>0.01
  const margemPrevista=valorVenda>0&&custoPrevistoBase>0?((valorVenda-custoPrevistoBase)/valorVenda)*100:0
  const markup=valorVenda>0&&custoPrevistoBase>0?(valorVenda/custoPrevistoBase):0

  // Etapas por material do card; não são entrada física nem baixa fiscal.
  const cotacoesAtuais=lotesCotacao.filter(l=>l.pacote_id===pacoteTecnicoId&&l.status!=='cancelado')
  const resumoCotacoes=progressoLotesCotacao(cotacoesAtuais)
  const totalAcompanhar=resumoCotacoes.total||compras.length
  const comprasEfetivadas=resumoCotacoes.total?resumoCotacoes.comprados:compras.filter(c=>compraEfetivada(c.status)).length
  const comprasRecebidas=resumoCotacoes.total?resumoCotacoes.recebidos:compras.filter(c=>c.recebido_em||String(c.status||'').toLowerCase()==='recebido').length
  const progressoCompras=pct(comprasEfetivadas,totalAcompanhar)
  const progressoMercadoria=pct(comprasRecebidas,totalAcompanhar)
  const ordensConcluidas=ordens.filter(o=>finalizada(o.status)).length
  const progressoProducao=pct(ordensConcluidas,ordens.length)

  const comprasPorCategoria=useMemo(()=>{
    const base:{perfil:Compra[];vidro:Compra[];acessorios:Compra[];outros:Compra[]}={perfil:[],vidro:[],acessorios:[],outros:[]}
    compras.forEach(item=>base[categoriaMaterial(item.categoria)].push(item))
    return base
  },[compras])
  const listaCategoria=comprasPorCategoria[categoriaAberta]
  const loteCategoria=lotesCotacao.find(l=>l.categoria===categoriaAberta&&l.pacote_id===pacoteTecnicoId)
  const gruposLoteNaEtapa=(id:string)=>loteCategoria?gruposItensEmEtapa(loteCategoria,id==='faltas'?'necessidade':id as EtapaCotacao):[]
  const lotesAtivos=lotesCotacao.filter(l=>l.pacote_id===pacoteTecnicoId&&l.status!=='cancelado')
  const materiaisPorProduto=useMemo(()=>{
    const mapa:Record<string,MaterialTecnico>={}
    materiaisTecnicos.forEach(item=>{if(item.produto_id&&!mapa[item.produto_id])mapa[item.produto_id]=item})
    return mapa
  },[materiaisTecnicos])
  const materiaisPorDescricao=useMemo(()=>{
    const mapa:Record<string,MaterialTecnico>={}
    materiaisTecnicos.forEach(item=>{const chave=String(item.descricao||'').trim().toLocaleLowerCase('pt-BR');if(chave&&!mapa[chave])mapa[chave]=item})
    return mapa
  },[materiaisTecnicos])
  function visualCompra(item:Compra){
    const produto=item.produto_id?produtosCompras[item.produto_id]:undefined
    const chave=String(item.descricao||'').trim().toLocaleLowerCase('pt-BR')
    const material=(item.produto_id?materiaisPorProduto[item.produto_id]:undefined)||materiaisPorDescricao[chave]
    const categoria=categoriaMaterial(item.categoria||produto?.categoria||material?.categoria)
    return {
      categoria,
      codigo:produto?.codigo||material?.codigo||null,
      descricao:item.descricao||produto?.nome||material?.descricao||rotuloCategoria(categoria),
      imagem:produto?.foto_url||imagemWvetroMaterial(material),
      imagemObrigatoria:categoria==='perfil'||categoria==='acessorios',
    }
  }
  const comprasKanban=useMemo(()=>{
    const base:{faltas:Compra[];cotacao:Compra[];comprado:Compra[];entrega:Compra[];recebido:Compra[]}={faltas:[],cotacao:[],comprado:[],entrega:[],recebido:[]}
    listaCategoria.forEach(item=>{
      const st=String(item.status||'').toLowerCase()
      if(item.recebido_em||st==='recebido')base.recebido.push(item)
      else if(st==='aguardando_entrega')base.entrega.push(item)
      else if(st==='aprovado'||st==='pedido_emitido')base.comprado.push(item)
      else if(st==='cotacao')base.cotacao.push(item)
      else base.faltas.push(item)
    })
    return base
  },[listaCategoria])
  const totalImagensPendentes=useMemo(()=>compras.filter(item=>{
    const produto=item.produto_id?produtosCompras[item.produto_id]:undefined
    const chave=String(item.descricao||'').trim().toLocaleLowerCase('pt-BR')
    const material=(item.produto_id?materiaisPorProduto[item.produto_id]:undefined)||materiaisPorDescricao[chave]
    const categoria=categoriaMaterial(item.categoria||produto?.categoria||material?.categoria)
    const imagem=produto?.foto_url||imagemWvetroMaterial(material)
    return (categoria==='perfil'||categoria==='acessorios')&&!imagem
  }).length,[compras,produtosCompras,materiaisPorProduto,materiaisPorDescricao])

  const materiaisPorCategoria=useMemo(()=>{
    const base:{perfil:MaterialTecnico[];acessorios:MaterialTecnico[];vidro:MaterialTecnico[];outros:MaterialTecnico[]}={perfil:[],acessorios:[],vidro:[],outros:[]}
    materiaisTecnicos.forEach(m=>base[categoriaMaterialTecnico(m.categoria)].push(m))
    return base
  },[materiaisTecnicos])
  const materiaisCategoria=materiaisPorCategoria[categoriaMaterialAberta]
  const separacoesPorMaterial=useMemo(()=>{
    const mapa:Record<string,SeparacaoMaterial[]>={}
    separacoesMateriais.forEach(s=>{if(s.material_id)(mapa[s.material_id] ||= []).push(s)})
    return mapa
  },[separacoesMateriais])
  function quantidadeSobraMaterial(m:MaterialTecnico){
    return (separacoesPorMaterial[m.id]||[]).filter(s=>s.tipo_origem==='sobra_estoque').reduce((s,x)=>s+Number(x.quantidade||0),0)
  }
  function quantidadeComprarMaterial(m:MaterialTecnico){
    const qtd=Number(m.quantidade_ajustada??m.quantidade_tecnica??0)
    return Math.max(0,qtd-quantidadeSobraMaterial(m))
  }
  const totalSobraCategoria=useMemo(()=>materiaisCategoria.reduce((s,m)=>s+quantidadeSobraMaterial(m),0),[materiaisCategoria,separacoesPorMaterial])
  const totalComprarCategoria=useMemo(()=>materiaisCategoria.reduce((s,m)=>s+quantidadeComprarMaterial(m),0),[materiaisCategoria,separacoesPorMaterial])
  function compraRelacionadaMaterial(m:MaterialTecnico){
    const descricao=String(m.descricao||'').trim().toLocaleLowerCase('pt-BR')
    return compras.find(c=>
      (m.produto_id&&c.produto_id===m.produto_id)||
      (descricao&&String(c.descricao||'').trim().toLocaleLowerCase('pt-BR')===descricao)
    )||null
  }
  function colunaMaterial(m:MaterialTecnico):'faltas'|'cotacao'|'comprado'|'entrega'|'recebido'{
    const c=compraRelacionadaMaterial(m)
    const st=String(c?.status||m.status_compra||'necessidade').toLowerCase()
    if(c?.recebido_em||st==='recebido')return 'recebido'
    if(st==='aguardando_entrega')return 'entrega'
    if(st==='aprovado'||st==='pedido_emitido')return 'comprado'
    if(st==='cotacao')return 'cotacao'
    return 'faltas'
  }
  const kanbanMateriais=useMemo(()=>{
    const base:{faltas:MaterialTecnico[];cotacao:MaterialTecnico[];comprado:MaterialTecnico[];entrega:MaterialTecnico[];recebido:MaterialTecnico[]}={faltas:[],cotacao:[],comprado:[],entrega:[],recebido:[]}
    materiaisCategoria.forEach(m=>base[colunaMaterial(m)].push(m))
    return base
  },[materiaisCategoria,compras])
  function imagemMaterial(m:MaterialTecnico){return (m.produto_id?produtosMateriais[m.produto_id]?.foto_url:null)||imagemWvetroMaterial(m)}
  function fornecedorCompraMaterial(m:MaterialTecnico){
    const compra=compraRelacionadaMaterial(m)
    if(!compra)return '—'
    const cot=cotacaoPorNecessidade[compra.id]
    if(cot?.fornecedor_id&&fornecedoresCompras[cot.fornecedor_id]?.nome)return fornecedoresCompras[cot.fornecedor_id].nome
    const obs=String(compra.observacoes||'')
    const matches=[...obs.matchAll(/Fornecedor:\s*([^\n]+)/gi)]
    return matches.length?matches[matches.length-1][1].trim():'—'
  }
  // Kanban de acompanhamento técnico: não calcula nem importa barras comerciais WVetro.
  const materiaisTabela=aba==='materiais'&&filtroSituacaoMaterial!=='todos'?materiaisCategoria.filter(m=>colunaMaterial(m)===filtroSituacaoMaterial):materiaisCategoria
  const idsMateriaisTabela=materiaisTabela.map(m=>m.id)
  const todosMateriaisTabelaSelecionados=idsMateriaisTabela.length>0&&idsMateriaisTabela.every(id=>selecionadosMateriais.includes(id))

  const setorPorNome=useMemo(()=>{
    const r:Record<string,SetorColuna>={}
    setorItens.forEach(i=>{const c=setorColunas[i.coluna_id];if(c)r[c.setor_id]=c})
    return r
  },[setorItens,setorColunas])

  const colunaInstalacao=setorPorNome.instalacao
  const itens=(Array.isArray(orcamento?.itens)?orcamento?.itens:Array.isArray(venda?.itens_snapshot)?venda?.itens_snapshot:[])||[]
  // A Produção usa a coleção mais completa; em empate, o snapshot vendido prevalece.
  // As fontes dos módulos já aprovados continuam inalteradas.
  const itensVendidos=Array.isArray(venda?.itens_snapshot)?venda.itens_snapshot:[]
  const itensKanban=itensVendidos.length>=itens.length?itensVendidos:itens
  // Instalação deve seguir a fotografia do orçamento efetivamente VENDIDO.
  const itensInstalacao=(Array.isArray(venda?.itens_snapshot)&&venda.itens_snapshot.length?venda.itens_snapshot:itens)||[]
  const fluxoVenda=avaliarFluxoVenda({
    valorVenda,contas,compras,ordens,instalacoes,
    materiaisPlanejados:materiaisTecnicos.length,
    materiaisInteiramenteAtendidosEstoque:materiaisTecnicos.length>0
      &&materiaisTecnicos.every(m=>Number(m.quantidade_ajustada??m.quantidade_tecnica??0)>0
        &&quantidadeComprarMaterial(m)<=0.001),
  })
  const progressoInstalacao=fluxoVenda.progressoInstalacao

  useEffect(()=>{
    setSelecionadosMateriais([])
    setFiltroSituacaoMaterial('todos')
    setAnalisePdfCompra(null)
    setSelecionadosPdfCompra([])
  },[categoriaMaterialAberta])

  async function moverItensCotacao(lote:LoteCotacao,origem:EtapaCotacao,destino:EtapaCotacao,materialIds:string[]):Promise<boolean>{
    if(!venda||movendoLoteId||!materialIds.length||origem===destino)return false
    const nomes:Record<EtapaCotacao,string>={necessidade:'Falta comprar',cotacao:'Em cotação',comprado:'Comprado',entrega:'Aguardando chegar',recebido:'Recebido'}
    const retrocesso=ETAPAS_COTACAO.indexOf(destino)<ETAPAS_COTACAO.indexOf(origem)
    if(!confirmarMovimentoKanban({
      card:materialIds.length+' item(ns) · '+rotuloCategoria(lote.categoria),
      origem:nomes[origem],destino:nomes[destino],retrocesso,
      aviso:'Etapa administrativa por item. A ação não emite pedido, NF, pagamento ou entrada física em estoque.',
    }))return false
    const motivo=retrocesso?window.prompt('Motivo da volta de etapa para o histórico:','Correção da etapa anterior'):null
    if(retrocesso&&(!motivo||!motivo.trim()))return false
    setMovendoLoteId(lote.id);setErro('')
    try{
      const token=await tokenAtual()
      if(!token)throw Error('Sessão expirada.')
      const resp=await fetch('/api/vendas/cotacoes-lotes/mover',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({vendaId:venda.id,loteId:lote.id,versao:lote.versao,origem,destino,materialIds,motivo}),
      })
      const dados=await resp.json().catch(()=>({}))
      if(!resp.ok)throw Error(dados.error||'Movimentação não concluída.')
      if(!dados.lote?.itens)throw Error('O servidor não confirmou as novas etapas. Atualize para conferir.')
      setLotesCotacao(atual=>atual.map(l=>l.id===lote.id?{
        ...l,status:dados.lote.status,versao:dados.lote.versao,itens:dados.lote.itens,updated_at:new Date().toISOString(),
      }:l))
      setMensagemMateriais(materialIds.length+' item(ns) movido(s) para '+nomes[destino]+'. Os demais permaneceram na etapa anterior.')
      return true
    }catch(err){
      setErro(err instanceof Error?err.message:'Não foi possível mover itens.')
      await carregar()
      return false
    }finally{setMovendoLoteId(null)}
  }

  async function moverLoteCotacao(e:React.DragEvent<HTMLDivElement>,destinoId:string){
    e.preventDefault()
    const dados=e.dataTransfer.getData('application/x-atlas-cotacao')
    const [id,origemTexto,grupoId]=dados.split('|')
    const lote=lotesCotacao.find(l=>l.id===id)
    const destino=(destinoId==='faltas'?'necessidade':destinoId) as EtapaCotacao
    if(!lote||!ETAPAS_COTACAO.includes(destino)||!ETAPAS_COTACAO.includes(origemTexto as EtapaCotacao))return
    const origem=origemTexto as EtapaCotacao
    // Arrastar um card movimenta só o grupo de compra, jamais os demais da coluna.
    const grupo=gruposItensEmEtapa(lote,origem).find(g=>g.id===grupoId)
    if(!grupo)return
    await moverItensCotacao(lote,origem,destino,grupo.itens.map(item=>item.material_id))
  }

  async function receberArrastoCompra(e:React.DragEvent<HTMLDivElement>,destinoId:string){
    e.preventDefault()
    const compraId=e.dataTransfer.getData('application/x-atlas-compra-item')
    if(!compraId){
      await moverLoteCotacao(e,destinoId)
      return
    }
    const item=compras.find(c=>c.id===compraId)
    if(!item || ocupadoMateriais || !venda?.obra_id)return
    const nomes:Record<string,string>={faltas:'Falta comprar',cotacao:'Em cotação',comprado:'Comprado',entrega:'Aguardando chegar',recebido:'Recebido'}
    const statusOrigem=item.recebido_em||item.status==='recebido'?'recebido':
      item.status==='aguardando_entrega'?'entrega':
      item.status==='aprovado'||item.status==='pedido_emitido'?'comprado':
      item.status==='cotacao'?'cotacao':'faltas'
    if(statusOrigem===destinoId)return
    const ordem=['faltas','cotacao','comprado','entrega','recebido']
    const volta=ordem.indexOf(destinoId)<ordem.indexOf(statusOrigem)
    if(!confirmarMovimentoKanban({
      card:item.descricao||'Material comprado',origem:nomes[statusOrigem],
      destino:nomes[destinoId],retrocesso:volta,
      aviso:'Confira o pedido e documentos anexados. Se houver NF, pagamento ou estoque movimentado, faça o estorno específico antes de considerar a reversão operacional concluída.',
    }))return
    const destino:Record<string,'necessidade'|'cotacao'|'comprado'|'entrega'|'recebido'>={
      faltas:'necessidade',cotacao:'cotacao',comprado:'comprado',entrega:'entrega',recebido:'recebido',
    }
    setOcupadoMateriais(true);setErro('')
    try{await atualizarStatusNecessidades([item.id],destino[destinoId],{origem:'arrasto_compras_confirmado'})}
    finally{setOcupadoMateriais(false)}
  }

  async function emitirCotacaoCategoria(){
    if(!venda||!pacoteTecnicoId)return
    if(!selecionadosMateriais.some(id=>materiaisCategoria.some(m=>m.id===id))){
      setMensagemMateriais('Selecione os materiais individualmente ou use Selecionar todos antes de validar e enviar para Compras.')
      return
    }
    const categoria=categoriaMaterialAberta
    if(categoria==='perfil'&&orcamento?.wvetro_fluxo?.numero){
      setMensagemMateriais('Perfis cortados pertencem à Produção. Gere a cotação de compra a partir das barras comerciais do relatório Barras Utilizadas na aba Compras.')
      return
    }
    const existentes=lotesAtivos.find(l=>l.categoria===categoria)
    if(existentes&&!window.confirm('Já existe uma lista de cotação de '+rotuloCategoria(categoria).toLowerCase()+'. Gerar nova versão preservando a anterior no histórico?'))return
    if(!existentes&&!window.confirm('Validou os materiais de '+rotuloCategoria(categoria).toLowerCase()+'? A lista será enviada para a coluna Em cotação de Compras, sem confirmar pedido ou recebimento.'))return
    setEmitindoCotacao(true);setErro('');setMensagemMateriais('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente.')
      const res=await fetch('/api/vendas/cotacoes-lotes',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({
          vendaId:venda.id,categoria,
          materialIds:selecionadosMateriais.filter(id=>materiaisCategoria.some(m=>m.id===id)),
          reemitir:Boolean(existentes),
        }),
      })
      const json=await res.json().catch(()=>({}))
      if(!res.ok)throw new Error(json.error||'Não foi possível emitir a lista de cotação.')
      await carregar()
      setCategoriaAberta(categoria)
      setAba('compras')
      setMensagemMateriais('Lista de '+rotuloCategoria(categoria).toLowerCase()+' gerada. Abra o card em Compras para imprimir ou salvar PDF.')
      setSelecionadosMateriais([])
    }catch(e){setErro(e instanceof Error?e.message:'Falha ao emitir cotação.')}
    finally{setEmitindoCotacao(false)}
  }

  async function atualizarStatusNecessidades(necessidadeIds:string[],statusDestino:'necessidade'|'cotacao'|'comprado'|'entrega'|'recebido',extras?:{fornecedorNome?:string;documentoNome?:string;documentoUrl?:string;origem?:string;pedidoNumero?:string;valorTotal?:number|null;prazoEntrega?:string;previsaoEntrega?:string;observacoesPedido?:string},materialIds:string[]=[]){
    if(!venda||(!necessidadeIds.length&&!materialIds.length))return false
    const token=await tokenAtual()
    if(!token){setErro('Sessão expirada. Entre novamente no Atlas.');return false}
    const resp=await fetch('/api/vendas/materiais/status-lote',{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({vendaId:venda.id,necessidadeIds,materialIds,status:statusDestino,...extras}),
    })
    const json=await resp.json().catch(()=>({}))
    if(!resp.ok){setErro(json?.error||'Não foi possível atualizar os materiais.');return false}
    const rotulo=statusDestino==='necessidade'?'Falta comprar':statusDestino==='cotacao'?'Em cotação':statusDestino==='comprado'?'Comprado':statusDestino==='entrega'?'Aguardando chegar':'Recebido'
    setMensagemMateriais(`${json.atualizadosMateriais||json.atualizados||materialIds.length||necessidadeIds.length} item(ns) movido(s) para ${rotulo}.`)
    await carregar()
    return true
  }

  async function editarCompraCentral(item:Compra){
    const dados=dadosCompra(item)
    const statusAtual=String(item.status||'necessidade').toLowerCase()
    const statusInicial=statusAtual==='aprovado'||statusAtual==='pedido_emitido'?'comprado':statusAtual==='aguardando_entrega'?'entrega':statusAtual==='recebido'?'recebido':statusAtual==='cotacao'?'cotacao':'necessidade'
    const statusDigitado=window.prompt('Status da compra: necessidade, cotacao, comprado, entrega ou recebido',statusInicial)?.trim().toLowerCase()
    if(!statusDigitado)return
    const mapaStatus:Record<string,'necessidade'|'cotacao'|'comprado'|'entrega'|'recebido'>={necessidade:'necessidade',falta:'necessidade',cotacao:'cotacao','em cotacao':'cotacao',comprado:'comprado',aprovado:'comprado',pedido:'comprado',entrega:'entrega','aguardando entrega':'entrega',recebido:'recebido'}
    const statusDestino=mapaStatus[statusDigitado]
    if(!statusDestino){setErro('Status inválido. Use necessidade, cotacao, comprado, entrega ou recebido.');return}
    const fornecedor=window.prompt('Fornecedor:',dados.fornecedor||'')
    if(fornecedor==null)return
    const pedido=window.prompt('Número do pedido:',dados.pedido||'')
    if(pedido==null)return
    const valor=window.prompt('Valor total deste item/pedido:',dados.valor?String(dados.valor).replace('.',','):'')
    if(valor==null)return
    const prazo=window.prompt('Prazo de entrega:',dados.prazo||'')
    if(prazo==null)return
    const previsao=window.prompt('Previsão de entrega (AAAA-MM-DD, opcional):',dados.previsaoEntrega||'')
    if(previsao==null)return
    const obs=window.prompt('Observação da compra:', '')
    if(obs==null)return
    setOcupadoMateriais(true);setErro('')
    const ok=await atualizarStatusNecessidades([item.id],statusDestino,{
      fornecedorNome:fornecedor.trim(),
      pedidoNumero:pedido.trim(),
      valorTotal:valor.trim()?numeroEntrada(valor):null,
      prazoEntrega:prazo.trim(),
      previsaoEntrega:previsao.trim(),
      observacoesPedido:obs.trim(),
      origem:'edicao_manual_compra',
    })
    setOcupadoMateriais(false)
    if(ok)setMensagemMateriais('Compra atualizada manualmente. Custos e CMV recalculados com os novos dados.')
  }

  async function moverMateriaisEmLote(statusDestino:'necessidade'|'cotacao'|'comprado'|'entrega'|'recebido',materialIds=selecionadosMateriais){
    if(!materialIds.length)return
    const necessidades=[...new Set(materialIds.map(id=>materiaisTecnicos.find(m=>m.id===id)).filter(Boolean).map(m=>compraRelacionadaMaterial(m as MaterialTecnico)?.id).filter(Boolean))] as string[]
    setOcupadoMateriais(true);setErro('')
    const ok=await atualizarStatusNecessidades(necessidades,statusDestino,undefined,materialIds)
    setOcupadoMateriais(false)
    if(ok)setSelecionadosMateriais([])
  }

  async function confirmarCompradoMaterial(m:MaterialTecnico){
    const compra=compraRelacionadaMaterial(m)
    if(!window.confirm(`Confirmar ${m.codigo||m.descricao} como comprado?`))return
    setOcupadoMateriais(true);setErro('')
    const ok=await atualizarStatusNecessidades(compra?[compra.id]:[],'comprado',undefined,[m.id])
    setOcupadoMateriais(false)
    if(ok)setSelecionadosMateriais(ids=>ids.filter(id=>id!==m.id))
  }

  async function soltarMaterialNoKanban(destino:'faltas'|'cotacao'|'comprado'|'entrega'|'recebido'){
    const id=materialArrastandoId
    setColunaArrasteSobre(null);setMaterialArrastandoId(null)
    if(!id||ocupadoMateriais)return
    const atual=materiaisTecnicos.find(m=>m.id===id)
    if(!atual||colunaMaterial(atual)===destino)return
    const mapa:{[K in typeof destino]:'necessidade'|'cotacao'|'comprado'|'entrega'|'recebido'}={faltas:'necessidade',cotacao:'cotacao',comprado:'comprado',entrega:'entrega',recebido:'recebido'}
    await moverMateriaisEmLote(mapa[destino],[id])
  }

  function alternarSelecaoMaterial(id:string){setSelecionadosMateriais(atual=>atual.includes(id)?atual.filter(x=>x!==id):[...atual,id])}
  function alternarSelecionarTodos(){setSelecionadosMateriais(atual=>todosMateriaisTabelaSelecionados?atual.filter(id=>!idsMateriaisTabela.includes(id)):[...new Set([...atual,...idsMateriaisTabela])])}
  function abrirListaSituacao(id:'faltas'|'cotacao'|'comprado'|'entrega'|'recebido'){
    setFiltroSituacaoMaterial(id);setSelecionadosMateriais([])
    window.setTimeout(()=>listaMateriaisRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50)
  }

  async function analisarPdfCompra(file:File|null){
    if(!file||!venda||!obra)return
    if(file.size>15*1024*1024){setErro('O PDF de compra deve ter no máximo 15 MB.');return}
    setAnalisandoPdfCompra(true);setErro('');setMensagemMateriais('');setAnalisePdfCompra(null);setSelecionadosPdfCompra([])
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada.')
      const form=new FormData();form.append('arquivo',file);form.append('vendaId',venda.id);form.append('categoria',categoriaMaterialAberta)
      const resp=await fetch('/api/vendas/materiais/compra-pdf',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form})
      const json=await resp.json().catch(()=>({}))
      if(!resp.ok)throw new Error(json?.error||'Não foi possível analisar o PDF.')
      let documentoUrl:string|null=null;let documentoId:string|null=null
      const doc=await adicionarDocumentoCliente({clienteId:venda.cliente_id,obraId:obra.id,titulo:`Compra - ${file.name}`,arquivo:file,tipo:'compra_pdf',observacoes:`PDF de compra analisado na venda ${venda.numero||venda.id}. Categoria: ${rotuloCategoria(categoriaMaterialAberta)}.`})
      if(doc.ok&&doc.documento){documentoUrl=doc.documento.url;documentoId=doc.documento.id}
      const analise:AnalisePdfCompra={...json,documentoUrl,documentoId}
      setAnalisePdfCompra(analise)
      setSelecionadosPdfCompra((analise.sugeridos||[]).map(i=>i.necessidade_id))
      setMensagemMateriais(`PDF analisado: ${analise.resumo?.sugeridosComprados||0} item(ns) sugerido(s) como comprado(s) e ${analise.resumo?.pendentesValidacao||0} pendência(s) para validar.`)
      if(!doc.ok)setMensagemMateriais(m=>m+' A leitura foi concluída, mas o PDF não pôde ser anexado aos documentos da obra.')
    }catch(e:any){setErro(e?.message||'Erro ao analisar o PDF de compra.')}
    finally{setAnalisandoPdfCompra(false);if(inputPdfCompraRef.current)inputPdfCompraRef.current.value=''}
  }

  async function aplicarPdfCompra(){
    if(!analisePdfCompra||!selecionadosPdfCompra.length)return
    setOcupadoMateriais(true);setErro('')
    const ok=await atualizarStatusNecessidades(selecionadosPdfCompra,'comprado',{
      fornecedorNome:analisePdfCompra.fornecedor?.nome||'',
      documentoNome:analisePdfCompra.arquivo?.nome||'',
      documentoUrl:analisePdfCompra.documentoUrl||'',
      origem:'pdf_compra_validado',
      pedidoNumero:analisePdfCompra.pedido?.numero||'',
      valorTotal:analisePdfCompra.pedido?.valor_total??null,
      prazoEntrega:analisePdfCompra.pedido?.prazo_entrega||'',
      previsaoEntrega:analisePdfCompra.pedido?.previsao_entrega||'',
    })
    setOcupadoMateriais(false)
    if(ok){setAnalisePdfCompra(null);setSelecionadosPdfCompra([]);setMensagemMateriais('PDF validado. Os itens confirmados foram marcados como comprados; os demais continuam pendentes.')}
  }

  async function atualizarFluxoMateriais(mensagem:string){
    if(pacoteTecnicoId){
      const sep=await supabase.from('pacote_tecnico_separacoes').select('sobra_estoque_id,status').eq('pacote_id',pacoteTecnicoId).neq('status','cancelado')
      const sobraIds=[...new Set((sep.data||[]).map((x:any)=>x.sobra_estoque_id).filter(Boolean))] as string[]
      const recalc=await recalcularAproveitamentoPacote(pacoteTecnicoId,sobraIds)
      if(!recalc.ok)setMensagemMateriais(`${mensagem} A lista técnica foi salva, mas o recálculo de compra precisa de conferência: ${recalc.error||'erro no recálculo'}.`)
      else{
        // Alterar a lista técnica não emite uma compra. O usuário precisa
        // validar a categoria e gerar explicitamente sua lista de cotação.
        setMensagemMateriais(mensagem+(lotesCotacao.length?' Confira se precisa reemitir alguma cotação já gerada.':''))
      }
    }else setMensagemMateriais(mensagem)
    await carregar()
  }

  async function editarMaterialCentral(m:MaterialTecnico){
    const qtdAtual=Number(m.quantidade_ajustada??m.quantidade_tecnica??0)
    const quantidade=window.prompt(`Quantidade de ${m.codigo||m.descricao}:`,String(qtdAtual).replace('.',','))
    if(quantidade==null)return
    const descricao=window.prompt(categoriaMaterialTecnico(m.categoria)==='vidro'?'Descrição / medida do vidro:':'Descrição do material:',m.descricao)
    if(descricao==null||!descricao.trim())return
    let corte=m.comprimento_corte_mm??null
    if(categoriaMaterialTecnico(m.categoria)==='perfil'){
      const valorCorte=window.prompt('Medida / corte em mm (deixe vazio quando não se aplicar):',corte?String(corte):'')
      if(valorCorte==null)return
      corte=valorCorte.trim()?numeroEntrada(valorCorte):null
    }
    const motivo=window.prompt('Motivo da alteração:','Ajuste após conferência da obra')||''
    if(motivo.trim().length<3)return
    setOcupadoMateriais(true);setErro('')
    const r=await ajustarMaterial(m.id,{quantidade_ajustada:Math.max(0,numeroEntrada(quantidade)),descricao:descricao.trim(),comprimento_corte_mm:corte,justificativa_ajuste:motivo})
    setOcupadoMateriais(false)
    if(!r.ok){setErro(r.error||'Não foi possível alterar o material.');return}
    await atualizarFluxoMateriais(`${m.codigo||m.descricao} atualizado. Compras recalculadas com a nova necessidade.`)
  }

  async function substituirMaterialCentral(m:MaterialTecnico){
    const escopo=window.prompt('Substituição de perfil/acessório: digite OBRA para alterar somente esta venda ou GERAL para solicitar alteração da receita técnica de futuras obras.','OBRA')?.trim().toUpperCase()
    if(!escopo)return
    if(escopo==='GERAL'){
      setErro('Substituição geral não aplicada: é necessário identificar a receita técnica, linha e tipologia na Engenharia e aprovar uma nova versão. Nenhum material foi alterado.')
      return
    }
    if(escopo!=='OBRA'){setErro('Escolha OBRA ou GERAL. Nenhuma substituição foi feita.');return}
    const codigo=window.prompt(`Código do material que substituirá ${m.codigo||m.descricao} SOMENTE NESTA OBRA:`,'')?.trim()
    if(!codigo)return
    const pr=await supabase.from('produtos').select('id,codigo,nome,unidade,tamanho_barra_mm,foto_url,categoria').ilike('codigo',codigo).limit(5)
    const produto=((pr.data||[]) as ProdutoMaterial[]).find(p=>String(p.codigo||'').toLocaleLowerCase('pt-BR')===codigo.toLocaleLowerCase('pt-BR'))
    if(!produto){setErro(`Não encontrei o código ${codigo} no cadastro de produtos.`);return}
    const catNova=categoriaMaterial(produto.categoria)
    const catAtual=categoriaMaterialTecnico(m.categoria)
    if(catAtual!=='outros'&&catNova!==catAtual){setErro(`O código ${produto.codigo} pertence a outra categoria. Faça a troca dentro da categoria correta.`);return}
    const motivo=window.prompt('Motivo da substituição:','Substituição validada para esta obra')||''
    if(motivo.trim().length<3)return
    setOcupadoMateriais(true);setErro('')
    const r=await ajustarMaterial(m.id,{produto_id:produto.id,codigo:produto.codigo||null,descricao:produto.nome||produto.codigo||m.descricao,comprimento_barra_mm:produto.tamanho_barra_mm||m.comprimento_barra_mm||null,justificativa_ajuste:`Substituído ${m.codigo||m.descricao} por ${produto.codigo||produto.nome}. ${motivo}`})
    setOcupadoMateriais(false)
    if(!r.ok){setErro(r.error||'Não foi possível substituir o material.');return}
    await atualizarFluxoMateriais(`${m.codigo||m.descricao} substituído por ${produto.codigo||produto.nome}. Histórico preservado.`)
  }

  async function excluirMaterialCentral(m:MaterialTecnico){
    if(!window.confirm(`Excluir ${m.codigo||m.descricao} desta venda?`))return
    const motivo=window.prompt('Motivo da exclusão:','Material retirado após conferência')||''
    if(motivo.trim().length<3)return
    setOcupadoMateriais(true);setErro('')
    const r=await excluirMaterialDoPacote(m.id,motivo)
    setOcupadoMateriais(false)
    if(!r.ok){setErro(r.error||'Não foi possível excluir o material.');return}
    await atualizarFluxoMateriais(`${m.codigo||m.descricao} retirado desta venda e lista de compras recalculada.`)
  }

  async function adicionarMaterialCentral(){
    if(!pacoteTecnicoId){setErro('Esta venda ainda não possui pacote técnico.');return}
    const codigo=window.prompt('Código do material (opcional):','')?.trim()||''
    let produto:ProdutoMaterial|null=null
    if(codigo){
      const pr=await supabase.from('produtos').select('id,codigo,nome,unidade,tamanho_barra_mm,foto_url,categoria').ilike('codigo',codigo).limit(5)
      produto=(((pr.data||[]) as ProdutoMaterial[]).find(p=>String(p.codigo||'').toLocaleLowerCase('pt-BR')===codigo.toLocaleLowerCase('pt-BR')))||null
      if(!produto&&!window.confirm(`O código ${codigo} não está cadastrado. Deseja incluir este material manualmente nesta venda?`))return
    }
    const descricao=window.prompt(categoriaMaterialAberta==='vidro'?'Descrição e medida do vidro:':'Descrição do material:',produto?.nome||'')?.trim()
    if(!descricao)return
    const quantidade=window.prompt('Quantidade:','1')
    if(quantidade==null)return
    const cor=window.prompt('Cor / acabamento (opcional):','')?.trim()||null
    let corte:number|null=null
    if(categoriaMaterialAberta==='perfil'){
      const valor=window.prompt('Medida / corte em mm (opcional):','')
      if(valor==null)return
      corte=valor.trim()?numeroEntrada(valor):null
    }
    const motivo=window.prompt('Motivo da inclusão:','Material acrescentado após conferência')||''
    if(motivo.trim().length<3)return
    const categoriaBanco=categoriaMaterialAberta==='acessorios'?'acessorio':categoriaMaterialAberta==='outros'?'outro':categoriaMaterialAberta
    setOcupadoMateriais(true);setErro('')
    const r=await adicionarMaterialManual(pacoteTecnicoId,{categoria:categoriaBanco as any,produto_id:produto?.id||null,codigo:produto?.codigo||codigo||null,descricao,unidade:produto?.unidade||'UN',cor_ref:cor,quantidade:Math.max(0,numeroEntrada(quantidade)),comprimento_corte_mm:corte,comprimento_barra_mm:produto?.tamanho_barra_mm||null,justificativa:motivo})
    setOcupadoMateriais(false)
    if(!r.ok){setErro(r.error||'Não foi possível adicionar o material.');return}
    await atualizarFluxoMateriais(`${produto?.codigo||codigo||descricao} incluído nesta venda e conectado à lista de compras.`)
  }

  async function adicionarCustoExtra(){
    if(!venda)return
    const tipo=window.prompt('Tipo do custo: frete, instalação, mão de obra, nota fiscal ou outros','Frete')
    if(tipo==null||!tipo.trim())return
