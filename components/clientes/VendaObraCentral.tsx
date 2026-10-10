'use client'

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
type Ordem = { id:string; numero?:number|null; titulo?:string|null; item_ref?:string|null; quantidade?:number|null; status?:string|null; created_at:string }
type SetorItem = { id:string; coluna_id:string; titulo?:string|null; atualizado_em?:string|null }
type SetorColuna = { id:string; setor_id:string; nome:string; ordem:number }
type Documento = { id:string; obra_id?:string|null; titulo:string; nome_arquivo?:string|null; url:string; created_at:string; tipo?:string|null }
type RecebimentoVenda = { id:string; data_recebimento?:string|null; valor?:number|null; valor_desconto?:number|null; desconto?:number|null; forma?:string|null; referencia?:string|null; observacoes?:string|null; status?:string|null; criado_por_nome?:string|null; created_at?:string|null }
type MaterialTecnico = { id:string; produto_id?:string|null; categoria:string; codigo?:string|null; descricao:string; unidade:string; quantidade_tecnica?:number|null; quantidade_ajustada?:number|null; comprimento_corte_mm?:number|null; comprimento_barra_mm?:number|null; cor_ref?:string|null; item_ref?:string|null; origem_calculo?:string|null; status_calculo?:string|null; status_compra?:string|null; status_compra_atualizado_em?:string|null; incluido_manual?:boolean|null; justificativa_ajuste?:string|null; custo_wvetro?:number|null; venda_wvetro?:number|null; wvetro_dados?:Record<string,any>|null }
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

type Aba='visao'|'financeiro'|'custos'|'compras'|'materiais'|'tipologias'|'producao'|'instalacao'|'notas'|'documentos'|'historico'
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
  const [compras,setCompras]=useState<Compra[]>([])
  const [produtosCompras,setProdutosCompras]=useState<Record<string,ProdutoCompra>>({})
  const [cotacoesCompras,setCotacoesCompras]=useState<CotacaoCompra[]>([])
  const [fornecedoresCompras,setFornecedoresCompras]=useState<Record<string,FornecedorCompra>>({})
  const [ordens,setOrdens]=useState<Ordem[]>([])
  const [setorItens,setSetorItens]=useState<SetorItem[]>([])
  const [setorColunas,setSetorColunas]=useState<Record<string,SetorColuna>>({})
  const [documentos,setDocumentos]=useState<Documento[]>([])
  const [recebimentosVenda,setRecebimentosVenda]=useState<RecebimentoVenda[]>([])
  const [materiaisTecnicos,setMateriaisTecnicos]=useState<MaterialTecnico[]>([])
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
  const [painelEtapa,setPainelEtapa]=useState<'financeiro'|'compras'|'mercadoria'|'producao'|'instalacao'|'venda'|null>(null)
  const [categoriaAberta,setCategoriaAberta]=useState<'perfil'|'vidro'|'acessorios'|'outros'>('perfil')
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [modalRecebimento,setModalRecebimento]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const [preparandoFluxo,setPreparandoFluxo]=useState(false)
  const [mensagemFluxo,setMensagemFluxo]=useState('')
  const [recebimento,setRecebimento]=useState({valor:'',desconto:'',forma:'pix',data:new Date().toISOString().slice(0,10),referencia:'',observacoes:''})

  useEffect(()=>{
    tentouMaterializarVenda.current=null
    void carregar()
  },[vendaId,clienteId])

  useEffect(()=>{
    if(carregando||!venda||pacoteTecnicoId||sincronizandoMateriais)return
    if(tentouMaterializarVenda.current===venda.id)return
    tentouMaterializarVenda.current=venda.id
    void sincronizarMateriaisWVetro(true)
  },[carregando,venda?.id,pacoteTecnicoId])

  async function carregar(){
    setCarregando(true);setErro('')
    const vr=await supabase.from('vendas_obras').select('id,numero,orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,status,confirmado_em,confirmado_por_nome,itens_snapshot').eq('id',vendaId).eq('cliente_id',clienteId).maybeSingle()
    if(vr.error||!vr.data){setErro('Venda não encontrada para este cliente.');setCarregando(false);return}
    const v=vr.data as Venda; setVenda(v)

    const [cr,or,co,op,si]=await Promise.all([
      supabase.from('clientes').select('id,nome,cidade').eq('id',v.cliente_id).maybeSingle(),
      supabase.from('orcamentos').select('id,numero,valor_estimado,custo_estimado,status,itens,wvetro_fluxo').eq('id',v.orcamento_id).maybeSingle(),
      supabase.from('financeiro_contas_receber').select('id,venda_obra_id,valor,valor_pago,valor_desconto,status,vencimento,documento,parcela,total_parcelas').eq('venda_obra_id',v.id).order('vencimento',{ascending:true}),
      supabase.from('ordens_producao').select('id,numero,titulo,item_ref,quantidade,status,created_at').eq('venda_obra_id',v.id).order('created_at',{ascending:true}),
      supabase.from('setor_kanban_itens').select('id,coluna_id,titulo,atualizado_em').eq('orcamento_id',v.orcamento_id),
    ])

    if(cr.data)setCliente(cr.data as Cliente)
    if(or.data)setOrcamento(or.data as Orcamento)
    setContas((co.data||[]) as Conta[])
    setOrdens((op.data||[]) as Ordem[])
    setSetorItens((si.data||[]) as SetorItem[])

    const pacoteResp=await supabase.from('pacotes_tecnicos').select('id').eq('orcamento_id',v.orcamento_id).neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
    if(pacoteResp.data?.id){
      setPacoteTecnicoId(pacoteResp.data.id)
      const mt=await supabase.from('pacote_tecnico_materiais').select('id,produto_id,categoria,codigo,descricao,unidade,quantidade_tecnica,quantidade_ajustada,comprimento_corte_mm,comprimento_barra_mm,cor_ref,item_ref,origem_calculo,status_calculo,status_compra,status_compra_atualizado_em,incluido_manual,justificativa_ajuste,custo_wvetro,venda_wvetro,wvetro_dados').eq('pacote_id',pacoteResp.data.id).eq('excluido',false).order('categoria').order('ordem')
      const materiais=(mt.data||[]) as MaterialTecnico[]
      setMateriaisTecnicos(materiais)
      const materialProdutoIds=[...new Set(materiais.map(m=>m.produto_id).filter(Boolean))] as string[]
      if(materialProdutoIds.length){
        const pr=await supabase.from('produtos').select('id,codigo,nome,unidade,tamanho_barra_mm,foto_url,categoria').in('id',materialProdutoIds)
        setProdutosMateriais(Object.fromEntries(((pr.data||[]) as ProdutoMaterial[]).map(p=>[p.id,p])))
      }else setProdutosMateriais({})
    }else{
      setPacoteTecnicoId(null)
      setMateriaisTecnicos([])
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

    const falha=cr.error||or.error||co.error||op.error||si.error
    if(falha)setErro(falha.message)
    setCarregando(false)
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
  const custoPrevisto=Number(venda?.custo_previsto||orcamento?.custo_estimado||0)
  const cotacaoPorNecessidade=useMemo(()=>Object.fromEntries(cotacoesCompras.map(item=>[item.necessidade_id,item])),[cotacoesCompras])
  function custoCompraReal(item:Compra){
    const dados=dadosCompra(item)
    if(dados.valor&&dados.valor>0)return dados.valor
    const cot=cotacaoPorNecessidade[item.id]
    const qtd=Number(item.quantidade||0)
    const unit=Number(cot?.preco_unitario||0)
    const frete=Number(cot?.frete||0)
    return unit>0?unit*qtd+frete:0
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
  const custoPrevistoBase=custoPrevisto>0?custoPrevisto:custoPrevistoTecnico
  const custoRealizado=Object.values(custosPorCategoria).reduce((s,c)=>s+c.realizado,0)
  const margemReal=valorVenda>0&&custoRealizado>0?((valorVenda-custoRealizado)/valorVenda)*100:0
  const cmvReal=valorVenda>0&&custoRealizado>0?(custoRealizado/valorVenda)*100:0
  const recebido=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor_pago||0),0)
  const saldoContas=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
  const aReceber=contas.length?saldoContas:Math.max(0,valorVenda-recebido)
  const margemPrevista=valorVenda>0&&custoPrevistoBase>0?((valorVenda-custoPrevistoBase)/valorVenda)*100:0
  const markup=valorVenda>0&&custoPrevistoBase>0?(valorVenda/custoPrevistoBase):0

  const comprasEfetivadas=compras.filter(c=>compraEfetivada(c.status)).length
  const comprasRecebidas=compras.filter(c=>c.recebido_em||String(c.status||'').toLowerCase()==='recebido').length
  const progressoCompras=pct(comprasEfetivadas,compras.length)
  const progressoMercadoria=pct(comprasRecebidas,compras.length)
  const ordensConcluidas=ordens.filter(o=>finalizada(o.status)).length
  const progressoProducao=pct(ordensConcluidas,ordens.length)

  const comprasPorCategoria=useMemo(()=>{
    const base:{perfil:Compra[];vidro:Compra[];acessorios:Compra[];outros:Compra[]}={perfil:[],vidro:[],acessorios:[],outros:[]}
    compras.forEach(item=>base[categoriaMaterial(item.categoria)].push(item))
    return base
  },[compras])
  const listaCategoria=comprasPorCategoria[categoriaAberta]
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
  const materiaisTabela=filtroSituacaoMaterial==='todos'?materiaisCategoria:materiaisCategoria.filter(m=>colunaMaterial(m)===filtroSituacaoMaterial)
  const idsMateriaisTabela=materiaisTabela.map(m=>m.id)
  const todosMateriaisTabelaSelecionados=idsMateriaisTabela.length>0&&idsMateriaisTabela.every(id=>selecionadosMateriais.includes(id))

  const setorPorNome=useMemo(()=>{
    const r:Record<string,SetorColuna>={}
    setorItens.forEach(i=>{const c=setorColunas[i.coluna_id];if(c)r[c.setor_id]=c})
    return r
  },[setorItens,setorColunas])

  const colunaInstalacao=setorPorNome.instalacao
  const progressoInstalacao=colunaInstalacao?.nome.toLowerCase().includes('conclu')?100:colunaInstalacao?.nome.toLowerCase().includes('em instala')?60:colunaInstalacao?.nome.toLowerCase().includes('agendada')?30:colunaInstalacao?10:0
  const itens=(Array.isArray(orcamento?.itens)?orcamento?.itens:Array.isArray(venda?.itens_snapshot)?venda?.itens_snapshot:[])||[]

  useEffect(()=>{
    setSelecionadosMateriais([])
    setFiltroSituacaoMaterial('todos')
    setAnalisePdfCompra(null)
    setSelecionadosPdfCompra([])
  },[categoriaMaterialAberta])

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
        const token=await tokenAtual()
        if(token&&venda){
          await fetch('/api/vendas/reconstruir-fluxo',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({vendaId:venda.id,acao:'materializar_compras'})}).catch(()=>null)
        }
        setMensagemMateriais(mensagem)
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
    const codigo=window.prompt(`Código do material que substituirá ${m.codigo||m.descricao}:`,'')?.trim()
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

  async function registrarRecebimento(){
    if(!venda||!cliente)return
    const valor=numeroEntrada(recebimento.valor)
    const desconto=numeroEntrada(recebimento.desconto)
    const totalBaixado=valor+desconto
    if(valor<=0){setErro('Informe um valor recebido válido.');return}
    if(desconto<0){setErro('O desconto não pode ser negativo.');return}
    if(totalBaixado>aReceber+0.009){setErro('O valor recebido mais o desconto não pode ultrapassar o saldo da venda.');return}
    setSalvando(true);setErro('')
    const r=await registrarRecebimentoVendaComDesconto({
      vendaObraId:venda.id,
      clienteId:venda.cliente_id,
      valorRecebido:valor,
      desconto,
      dataRecebimento:recebimento.data,
      forma:recebimento.forma,
      referencia:recebimento.referencia,
      observacoes:recebimento.observacoes,
    })
    setSalvando(false)
    if(!r.ok){setErro(r.error||'Não foi possível registrar o recebimento.');return}
    setModalRecebimento(false)
    setRecebimento({valor:'',desconto:'',forma:'pix',data:new Date().toISOString().slice(0,10),referencia:'',observacoes:''})
    await carregar()
  }

  async function prepararFluxoCompleto(){
    if(!venda)return
    setPreparandoFluxo(true);setErro('');setMensagemFluxo('')
    try{
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const chamar=async(body:Record<string,unknown>)=>{
        const resp=await fetch('/api/vendas/reconstruir-fluxo',{
          method:'POST',
          headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
          body:JSON.stringify({vendaId:venda.id,...body}),
        })
        const json=await resp.json().catch(()=>({}))
        if(!resp.ok){
          if(json?.code==='wvetro_ambiguo'&&Array.isArray(json?.candidatos)){
            const numeros=json.candidatos.map((x:any)=>`#${x.wvetro_numero}`).join(', ')
            throw new Error(`${json.error} Candidatos: ${numeros}`)
          }
          throw new Error(json?.error||'Não foi possível preparar o fluxo da obra.')
        }
        return json
      }

      const preparado=await chamar({acao:'preparar'})
      const pacoteAtual=await supabase.from('pacotes_tecnicos').select('id,status').eq('orcamento_id',venda.orcamento_id).neq('status','substituido').order('created_at',{ascending:false}).limit(1).maybeSingle()
      let pacoteId=pacoteAtual.data?.id||null

      if(preparado.revisaoCriada||!pacoteId){
        const usuario=await usuarioAtual()
        const gerado=await gerarPacoteTecnico(venda.orcamento_id,'projeto_conferido',usuario,{perdaCorteMm:0,minimoSobraReaproveitavelMm:300})
        if(!gerado.ok)throw new Error(gerado.error||'Não foi possível gerar o pacote técnico da obra.')
        pacoteId=gerado.pacote.id
      }

      const compras=await chamar({acao:'materializar_compras'})
      setMensagemFluxo(
        `${preparado.mensagem} Pacote técnico ${pacoteId?'gerado/conferível':'preparado'}; ${compras.compras?.totalLinhas||0} linha(s) sincronizadas com Compras. As ordens de Produção foram criadas bloqueadas para respeitar Medição Final e liberação de materiais.`
      )
      await carregar()
    }catch(e){
      setErro(e instanceof Error?e.message:'Falha ao preparar o fluxo completo da obra.')
    }finally{
      setPreparandoFluxo(false)
    }
  }

  if(carregando)return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-400"><Loader2 className="mx-auto mb-2 animate-spin"/>Carregando central da venda...</div>
  if(!venda||!cliente)return <div className="min-h-screen bg-slate-50 p-8 text-red-600">{erro||'Venda não encontrada.'}</div>

  const abas:{id:Aba;label:string}[]=[
    {id:'visao',label:'Visão geral'},{id:'financeiro',label:'Financeiro'},{id:'custos',label:'Custos / CMV'},
    {id:'compras',label:'Compras'},{id:'materiais',label:'Materiais'},{id:'tipologias',label:'Tipologias'},{id:'producao',label:'Produção'},
    {id:'instalacao',label:'Instalação'},{id:'notas',label:'Notas / Recibos'},{id:'documentos',label:'Documentos'},{id:'historico',label:'Histórico'}
  ]

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <Link href={`/clientes/${clienteId}`} className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold text-slate-900">{obra?.nome||`Venda #${venda.numero||'—'}`}</h1><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{status(venda.status||'ativa')}</span></div>
              <p className="mt-1 text-sm text-slate-500">{cliente.nome} · Orçamento #{numeroOrcamento(orcamento)}{obra?.numero?` · Obra #${obra.numero}`:''}</p>
              <p className="mt-1 text-xs text-slate-400">Venda confirmada em {dataBR(venda.confirmado_em)}{venda.confirmado_por_nome?` por ${venda.confirmado_por_nome}`:''}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={()=>setModalRecebimento(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white"><Wallet size={15}/>Registrar recebimento</button>
            <button disabled={preparandoFluxo} onClick={()=>void prepararFluxoCompleto()} className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 disabled:opacity-50">{preparandoFluxo?<Loader2 size={15} className="animate-spin"/>:<RefreshCw size={15}/>}Preparar fluxo da obra</button>
            <Link href={`/orcamento/${venda.orcamento_id}/composicao`} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-700"><FileText size={15}/>Abrir orçamento</Link>
          </div>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-5">
      {erro&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagemFluxo&&<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagemFluxo}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi titulo="Valor da venda" valor={moeda(valorVenda)}/>
        <Kpi titulo="Recebido" valor={moeda(recebido)} detalhe={`${pct(recebido,valorVenda).toFixed(0)}% recebido`}/>
        <Kpi titulo="A receber" valor={moeda(aReceber)} destaque/>
        <Kpi titulo="Custo previsto" valor={custoPrevistoBase>0?moeda(custoPrevistoBase):'—'}/>
        <Kpi titulo="Custo realizado" valor={custoRealizado>0?moeda(custoRealizado):'—'} detalhe={custoRealizado>0?cmvReal.toFixed(1)+'% CMV real':'Aguardando compras com valor'}/>
        <Kpi titulo="Margem prevista" valor={custoPrevistoBase>0?margemPrevista.toFixed(1)+'%':'—'}/>
        <Kpi titulo="Markup" valor={markup>0?`${markup.toFixed(2)}x`:'—'}/>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Progresso titulo="Financeiro" valor={pct(recebido,valorVenda)} detalhe={`${moeda(recebido)} de ${moeda(valorVenda)}`} ativo={painelEtapa==='financeiro'} onClick={()=>setPainelEtapa(painelEtapa==='financeiro'?null:'financeiro')}/>
        <Progresso titulo="Compras" valor={progressoCompras} detalhe={compras.length?`${comprasEfetivadas} de ${compras.length} item(ns) comprados`:'Ainda sem compras vinculadas'} ativo={painelEtapa==='compras'} onClick={()=>setPainelEtapa(painelEtapa==='compras'?null:'compras')}/>
        <Progresso titulo="Mercadoria recebida" valor={progressoMercadoria} detalhe={compras.length?`${comprasRecebidas} de ${compras.length} item(ns) recebidos`:'Ainda sem entradas vinculadas'} ativo={painelEtapa==='mercadoria'} onClick={()=>setPainelEtapa(painelEtapa==='mercadoria'?null:'mercadoria')}/>
        <Progresso titulo="Produção" valor={progressoProducao} detalhe={ordens.length?`${ordensConcluidas} de ${ordens.length} ordem(ns) concluídas`:(setorPorNome.producao?.nome||'Ainda não liberada')} ativo={painelEtapa==='producao'} onClick={()=>setPainelEtapa(painelEtapa==='producao'?null:'producao')}/>
        <Progresso titulo="Instalação" valor={progressoInstalacao} detalhe={colunaInstalacao?.nome||'Ainda não gerada'} ativo={painelEtapa==='instalacao'} onClick={()=>setPainelEtapa(painelEtapa==='instalacao'?null:'instalacao')}/>
        <Progresso titulo="Venda" valor={100} detalhe="Orçamento confirmado e venda criada" ativo={painelEtapa==='venda'} onClick={()=>setPainelEtapa(painelEtapa==='venda'?null:'venda')}/>
      </div>

      {painelEtapa&&<section className="mt-4 overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-blue-100 bg-blue-50/40 px-5 py-4">
          <div>
            <h2 className="font-bold text-slate-900">
              {painelEtapa==='financeiro'?'Detalhamento financeiro':
               painelEtapa==='compras'?'Detalhamento de compras':
               painelEtapa==='mercadoria'?'Mercadoria recebida':
               painelEtapa==='producao'?'Detalhamento da produção':
               painelEtapa==='instalacao'?'Detalhamento da instalação':'Resumo da venda'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {painelEtapa==='compras'?'Clique em cada categoria para ver o que foi comprado, o que falta chegar e o fornecedor.':
               painelEtapa==='mercadoria'?'Acompanhe o que já entrou na obra e o que ainda está pendente de recebimento.':
               painelEtapa==='producao'?'Veja o que já foi produzido e o que ainda falta fabricar.':
               painelEtapa==='financeiro'?'Recebimentos, saldo e parcelas desta venda.':
               painelEtapa==='instalacao'?'Acompanhe o estágio de instalação desta obra.':'Dados do fechamento que originou esta venda.'}
            </p>
          </div>
          <button type="button" onClick={()=>setPainelEtapa(null)} className="grid h-8 w-8 place-items-center rounded-lg border bg-white text-slate-500 hover:bg-slate-50"><X size={15}/></button>
        </div>

        {(painelEtapa==='compras'||painelEtapa==='mercadoria')&&<div className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['perfil','vidro','acessorios','outros'] as const).map(cat=>{
              const lista=comprasPorCategoria[cat]
              const progresso=painelEtapa==='compras'
                ? progressoItens(lista,item=>compraEfetivada(item.status))
                : progressoItens(lista,item=>Boolean(item.recebido_em)||String(item.status||'').toLowerCase()==='recebido')
              return <button key={cat} type="button" onClick={()=>setCategoriaAberta(cat)} className={`rounded-xl border p-4 text-left transition hover:border-blue-300 ${categoriaAberta===cat?'border-blue-500 bg-blue-50/30 ring-2 ring-blue-100':'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2"><b className="text-sm text-slate-800">{rotuloCategoria(cat)}</b><span className="text-xs font-bold text-slate-600">{Math.round(progresso)}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-blue-600" style={{width:`${progresso}%`}}/></div>
                <p className="mt-2 text-[11px] text-slate-500">{lista.length} item(ns) nesta categoria</p>
              </button>
            })}
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2.5">Item / {rotuloCategoria(categoriaAberta)}</th>
                  <th className="px-3 py-2.5">Solicitado</th>
                  <th className="px-3 py-2.5">{painelEtapa==='compras'?'Comprado':'Recebido'}</th>
                  <th className="px-3 py-2.5">Falta chegar</th>
                  <th className="px-3 py-2.5">Fornecedor</th>
                  <th className="px-3 py-2.5">Previsão</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {listaCategoria.map(item=>{
                  const cot=cotacaoPorNecessidade[item.id]
                  const fornecedor=cot?.fornecedor_id?fornecedoresCompras[cot.fornecedor_id]?.nome:null
                  const dados=dadosCompra(item)
                  const comprado=compraEfetivada(item.status)
                  const recebidoItem=Boolean(item.recebido_em)||String(item.status||'').toLowerCase()==='recebido'
                  const qtd=Number(item.quantidade||0)
                  const unidade=item.unidade||''
                  const quantidadeMostrada=painelEtapa==='compras'?(comprado?qtd:0):(recebidoItem?qtd:0)
                  const falta=recebidoItem?0:qtd
                  return <tr key={item.id} className="border-t">
                    <td className="px-3 py-3 font-semibold text-slate-800">{item.descricao||rotuloCategoria(categoriaAberta)}</td>
                    <td className="px-3 py-3 text-slate-600">{qtd} {unidade}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{quantidadeMostrada} {unidade}</td>
                    <td className="px-3 py-3 text-slate-600">{falta} {unidade}</td>
                    <td className="px-3 py-3 text-slate-600">{fornecedor||'—'}</td>
                    <td className="px-3 py-3 text-slate-600">{dataBR(cot?.previsao_entrega)}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${recebidoItem?'bg-emerald-100 text-emerald-700':comprado?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-600'}`}>{recebidoItem?'Recebido':status(item.status)}</span></td>
                  </tr>
                })}
                {!listaCategoria.length&&<tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum item de {rotuloCategoria(categoriaAberta).toLowerCase()} vinculado a esta obra.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>}

        {painelEtapa==='financeiro'&&<div className="p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3"><Kpi titulo="Valor da venda" valor={moeda(valorVenda)}/><Kpi titulo="Recebido" valor={moeda(recebido)}/><Kpi titulo="A receber" valor={moeda(aReceber)} destaque/></div>
          <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-400"><tr><th className="px-3 py-2.5">Documento</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Desconto</th><th>Saldo</th><th>Status</th></tr></thead><tbody>{contas.map(c=><tr key={c.id} className="border-t"><td className="px-3 py-3">{c.documento||'Venda sob medida'}</td><td>{dataBR(c.vencimento)}</td><td>{moeda(c.valor)}</td><td>{moeda(c.valor_pago)}</td><td>{moeda(c.valor_desconto)}</td><td className="font-bold">{moeda(Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)))}</td><td>{status(c.status)}</td></tr>)}{!contas.length&&<tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Nenhuma parcela vinculada.</td></tr>}</tbody></table></div>
        </div>}

        {painelEtapa==='producao'&&<div className="p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-3"><Kpi titulo="Ordens" valor={String(ordens.length)}/><Kpi titulo="Produzidas" valor={String(ordensConcluidas)}/><Kpi titulo="Faltam" valor={String(Math.max(0,ordens.length-ordensConcluidas))}/></div>
          <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-400"><tr><th className="px-3 py-2.5">Peça / ordem</th><th>Quantidade</th><th>Produzido</th><th>Falta</th><th>Status</th></tr></thead><tbody>{ordens.map(o=>{const qtd=Number(o.quantidade||1);const pronta=finalizada(o.status);return <tr key={o.id} className="border-t"><td className="px-3 py-3 font-semibold">OP #{o.numero||'—'} · {o.titulo||o.item_ref||'Peça'}</td><td>{qtd}</td><td>{pronta?qtd:0}</td><td>{pronta?0:qtd}</td><td><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{status(o.status)}</span></td></tr>})}{!ordens.length&&<tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Ainda não existem ordens de produção para esta venda.</td></tr>}</tbody></table></div>
        </div>}

        {painelEtapa==='instalacao'&&<div className="p-4">
          <div className="rounded-xl border p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Wrench size={19}/></span><div><b className="text-slate-800">{colunaInstalacao?.nome||'Ainda não gerada'}</b><p className="text-xs text-slate-500">{colunaInstalacao?'Status sincronizado com o Kanban de Instalação.':'Quando a obra entrar no fluxo de instalação, o andamento aparecerá aqui automaticamente.'}</p></div></div></div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">{itens.map((item:any,idx:number)=><div key={item.id||idx} className="flex items-center justify-between rounded-xl border p-3"><div><b className="text-sm">{item.ambiente||item.descricao||item.configuracao_nome||`Tipologia ${idx+1}`}</b><p className="text-xs text-slate-500">Qtd {item.quantidade||1}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${progressoInstalacao===100?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600'}`}>{progressoInstalacao===100?'Instalado':'Pendente'}</span></div>)}</div>
        </div>}

        {painelEtapa==='venda'&&<div className="grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-4">
          <Kpi titulo="Venda" valor={`#${venda.numero||'—'}`}/>
          <Kpi titulo="Orçamento" valor={`#${numeroOrcamento(orcamento)}`}/>
          <Kpi titulo="Valor" valor={moeda(valorVenda)}/>
          <Kpi titulo="Confirmação" valor={dataBR(venda.confirmado_em)} detalhe={venda.confirmado_por_nome?`Por ${venda.confirmado_por_nome}`:undefined}/>
        </div>}
      </section>}

      <div className="mt-5 overflow-x-auto border-b"><div className="flex min-w-max">{abas.map(a=><button key={a.id} onClick={()=>setAba(a.id)} className={`border-b-2 px-3 py-3 text-sm font-semibold ${aba===a.id?'border-brand-navy text-brand-navy':'border-transparent text-slate-500'}`}>{a.label}</button>)}</div></div>

      <div className="mt-5 space-y-5">
        {aba==='visao'&&<>
          <div className="grid gap-5 lg:grid-cols-2">
            <Box titulo="Andamento da venda">
              <div className="space-y-3">
                {[
                  ['Venda','Confirmada',true],
                  ['Engenharia / projeto',setorPorNome['engenharia-projeto']?.nome||'Aguardando',!!setorPorNome['engenharia-projeto']],
                  ['Compras',compras.length?`${comprasRecebidas}/${compras.length} recebidas`:'Aguardando',compras.length>0],
                  ['Produção',setorPorNome.producao?.nome||'Aguardando',!!setorPorNome.producao||ordens.length>0],
                  ['Instalação',colunaInstalacao?.nome||'Aguardando',!!colunaInstalacao],
                ].map(([nome,det,ativo]:any)=><div key={nome} className="flex items-center gap-3 rounded-xl border p-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${ativo?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-400'}`}>{ativo?<CheckCircle2 size={17}/>:<ClipboardList size={17}/>}</span><div><b className="text-sm text-slate-800">{nome}</b><p className="text-xs text-slate-500">{det}</p></div></div>)}
              </div>
            </Box>
            <Box titulo="Próximas informações da venda">
              <div className="grid gap-3 sm:grid-cols-2">
                <button onClick={()=>setAba('financeiro')} className="rounded-xl border p-4 text-left hover:border-brand-navy"><Wallet className="mb-2 text-emerald-600"/><b>Financeiro</b><p className="mt-1 text-xs text-slate-500">Parcelas, recebimentos e saldo desta venda.</p></button>
                <button onClick={()=>setAba('compras')} className="rounded-xl border p-4 text-left hover:border-brand-navy"><ShoppingCart className="mb-2 text-amber-600"/><b>Compras</b><p className="mt-1 text-xs text-slate-500">Material comprado e recebido para esta obra.</p></button>
                <button onClick={()=>setAba('producao')} className="rounded-xl border p-4 text-left hover:border-brand-navy"><Factory className="mb-2 text-blue-600"/><b>Produção</b><p className="mt-1 text-xs text-slate-500">Peças previstas e andamento da fabricação.</p></button>
                <button onClick={()=>setAba('instalacao')} className="rounded-xl border p-4 text-left hover:border-brand-navy"><Wrench className="mb-2 text-violet-600"/><b>Instalação</b><p className="mt-1 text-xs text-slate-500">Status e conclusão da instalação.</p></button>
              </div>
            </Box>
          </div>
        </>}

        {aba==='financeiro'&&<Box titulo="Financeiro desta venda">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"><span>Valor da venda <b>{moeda(valorVenda)}</b></span><span>Recebido <b>{moeda(recebido)}</b></span><span>Saldo <b>{moeda(aReceber)}</b></span></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b text-left text-xs text-slate-400"><th className="pb-2">Documento</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Desconto</th><th>Saldo</th><th>Status</th></tr></thead><tbody>
            {contas.map(c=><tr key={c.id} className="border-b"><td className="py-3">{c.documento||'Venda sob medida'}</td><td>{c.parcela||1}/{c.total_parcelas||1}</td><td>{dataBR(c.vencimento)}</td><td>{moeda(c.valor)}</td><td>{moeda(c.valor_pago)}</td><td className="font-semibold text-amber-700">{moeda(c.valor_desconto)}</td><td className="font-bold">{moeda(Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)))}</td><td>{status(c.status)}</td></tr>)}
            {!contas.length&&<tr><td colSpan={8} className="py-8 text-center text-slate-400">Nenhuma conta vinculada a esta venda.</td></tr>}
          </tbody></table></div>
          <div className="mt-5 border-t pt-4">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Histórico de recebimentos desta venda</h3>
            <div className="space-y-3">{recebimentosVenda.map(r=>{const desconto=Number(r.desconto||0);return <div key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{moeda(r.valor)} recebido</b>{desconto>0&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">{moeda(desconto)} desconto</span>}<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold uppercase text-emerald-700">{r.forma||'Forma não informada'}</span></div><p className="mt-1 text-xs text-slate-600">Data do recebimento: <b>{dataBR(r.data_recebimento)}</b>{desconto>0?<> · Total baixado: {moeda(Number(r.valor||0)+desconto)}</>:null}</p><p className="mt-1 text-xs text-slate-400">Registrado no Atlas em {dataHoraBR(r.created_at)}{r.criado_por_nome?<> por {r.criado_por_nome}</>:null}</p>{r.referencia&&<p className="mt-2 text-xs text-slate-500">Referência/comprovante: {r.referencia}</p>}{r.observacoes&&<p className="mt-1 text-xs text-slate-500">Observações: {r.observacoes}</p>}</div><span className="text-xs font-semibold text-slate-400">{status(r.status||'registrado')}</span></div></div>})}{!recebimentosVenda.length&&<p className="py-5 text-center text-sm text-slate-400">Nenhum recebimento registrado para esta venda.</p>}</div>
          </div>
        </Box>}

        {aba==='custos'&&<Box titulo="Custos / CMV da obra">
          <div className="grid gap-3 md:grid-cols-6">
            <Kpi titulo="Valor da venda" valor={moeda(valorVenda)}/>
            <Kpi titulo="Custo previsto" valor={custoPrevistoBase>0?moeda(custoPrevistoBase):'—'}/>
            <Kpi titulo="Custo realizado" valor={custoRealizado>0?moeda(custoRealizado):'—'} detalhe={custoRealizado>0?cmvReal.toFixed(1)+'% CMV real':'Aguardando compras com valor'}/>
            <Kpi titulo="Margem prevista" valor={custoPrevistoBase>0?margemPrevista.toFixed(1)+'%':'—'}/>
            <Kpi titulo="Margem real" valor={custoRealizado>0?margemReal.toFixed(1)+'%':'—'} destaque={custoRealizado>0}/>
            <Kpi titulo="Markup" valor={markup>0?markup.toFixed(2)+'x':'—'}/>
          </div>
          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2.5">Categoria</th><th className="px-3 py-2.5">Itens</th><th className="px-3 py-2.5">Previsto técnico</th><th className="px-3 py-2.5">Realizado compras</th><th className="px-3 py-2.5">Diferença</th><th className="px-3 py-2.5">Status</th></tr>
              </thead>
              <tbody>
                {(['perfil','vidro','acessorios','outros'] as const).map(cat=>{
                  const c=custosPorCategoria[cat]
                  const dif=c.realizado-c.previsto
                  const temReal=c.realizado>0
                  return <tr key={cat} className="border-t">
                    <td className="px-3 py-3 font-bold text-slate-800">{rotuloCategoria(cat)}</td>
                    <td className="px-3 py-3 text-slate-600">{c.itens}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{c.previsto>0?moeda(c.previsto):'—'}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{temReal?moeda(c.realizado):'—'}</td>
                    <td className={'px-3 py-3 font-bold '+(dif>0?'text-amber-700':dif<0?'text-emerald-700':'text-slate-600')}>{temReal&&c.previsto>0?moeda(dif):'—'}</td>
                    <td className="px-3 py-3"><span className={'rounded-full px-2 py-1 text-xs font-bold '+(temReal?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-600')}>{temReal?'Com valor real':'Aguardando compra com valor'}</span></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">O custo realizado usa primeiro o valor total extraído/validado do pedido/PDF. Quando não houver valor no pedido, usa cotação selecionada: preço unitário x quantidade + frete.</p>
        </Box>}

        {aba==='compras'&&<Box titulo="Compras desta obra">
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <b className="text-sm text-slate-900">Acompanhamento de compras por categoria</b>
              <p className="mt-1 text-xs text-slate-500">Selecione Perfis, Acessórios, Vidros ou Outros para ver o percentual comprado, o que já foi pedido e o que ainda falta.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">{Math.round(progressoCompras)}% comprado</span>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">{comprasEfetivadas}/{compras.length||0} itens</span>
              {totalImagensPendentes>0&&<Link href="/cadastro/produtos" className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800">{totalImagensPendentes} imagem(ns) pendente(s)</Link>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['perfil','acessorios','vidro','outros'] as const).map(cat=>{
              const lista=comprasPorCategoria[cat]
              const comprados=lista.filter(item=>compraEfetivada(item.status)).length
              const recebidos=lista.filter(item=>Boolean(item.recebido_em)||String(item.status||'').toLowerCase()==='recebido').length
              const progresso=progressoItens(lista,item=>compraEfetivada(item.status))
              const tema=temaCategoria(cat)
              return <button key={cat} type="button" onClick={()=>setCategoriaAberta(cat)} className={'rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm '+(categoriaAberta===cat?tema.borda+' '+tema.fundo+' ring-2 ring-slate-100':'border-slate-200 bg-white')}>
                <div className="flex items-center justify-between gap-2"><b className="text-sm text-slate-900">{rotuloCategoria(cat)}</b><span className={'text-lg font-black '+tema.texto}>{Math.round(progresso)}%</span></div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={'h-full rounded-full '+tema.barra} style={{width:String(progresso)+'%'}}/></div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500"><span>{comprados}/{lista.length} comprados</span><span>{recebidos} recebidos</span></div>
              </button>
            })}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div><b className="text-sm text-slate-900">Kanban de {rotuloCategoria(categoriaAberta).toLowerCase()}</b><p className="text-[11px] text-slate-500">O item muda de coluna conforme a situação da compra.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={()=>{setCategoriaMaterialAberta(categoriaAberta);inputPdfCompraRef.current?.click()}} disabled={analisandoPdfCompra||ocupadoMateriais||!obra?.id} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">{analisandoPdfCompra?<Loader2 size={13} className="animate-spin"/>:<FileText size={13}/>} Anexar pedido/PDF</button>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{listaCategoria.length} item(ns)</span>
              </div>
            </div>
            <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
              {([
                ['faltas','Falta comprar','border-slate-300','bg-slate-50',comprasKanban.faltas],
                ['cotacao','Em cotação','border-blue-300','bg-blue-50/50',comprasKanban.cotacao],
                ['comprado','Comprado','border-violet-300','bg-violet-50/50',comprasKanban.comprado],
                ['entrega','Aguardando chegar','border-amber-300','bg-amber-50/50',comprasKanban.entrega],
                ['recebido','Recebido','border-emerald-300','bg-emerald-50/50',comprasKanban.recebido],
              ] as const).map(([id,titulo,borda,fundo,itensColuna])=><div key={id} className={'rounded-xl border-t-4 p-3 '+borda+' '+fundo}>
                <div className="mb-2 flex items-center justify-between gap-2"><b className="text-xs text-slate-800">{titulo}</b><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600">{itensColuna.length}</span></div>
                <div className="space-y-2">
                  {itensColuna.slice(0,4).map(item=>{const visual=visualCompra(item);return <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/80 bg-white p-2 shadow-sm">
                    <div className={'grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border '+(!visual.imagem&&visual.imagemObrigatoria?'border-amber-300':'border-slate-200')}>
                      {visual.imagem?<img src={visual.imagem} alt={visual.descricao} className="h-full w-full object-contain p-0.5"/>:<ImageIcon size={14} className={!visual.imagem&&visual.imagemObrigatoria?'text-amber-400':'text-slate-300'}/>}
                    </div>
                    <div className="min-w-0"><div className="font-mono text-[9px] font-bold text-slate-500">{visual.codigo||'Sem código'}</div><div className="truncate text-[11px] font-semibold text-slate-700">{visual.descricao}</div></div>
                  </div>})}
                  {itensColuna.length>4&&<div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-2 py-2 text-center text-[10px] font-semibold text-slate-500">+ {itensColuna.length-4} item(ns)</div>}
                  {!itensColuna.length&&<div className="rounded-lg border border-dashed border-slate-300 bg-white/60 px-2 py-5 text-center text-[10px] text-slate-400">Nenhum item</div>}
                </div>
              </div>)}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1380px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <tr><th className="px-3 py-2.5">Código / material</th><th className="px-3 py-2.5">Necessário</th><th className="px-3 py-2.5">Comprado</th><th className="px-3 py-2.5">Falta comprar</th><th className="px-3 py-2.5">Fornecedor</th><th className="px-3 py-2.5">Pedido / documento</th><th className="px-3 py-2.5">Valor / prazo</th><th className="px-3 py-2.5">Previsão</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Ações</th></tr>
              </thead>
              <tbody>
                {listaCategoria.map(item=>{
                  const visual=visualCompra(item)
                  const cot=cotacaoPorNecessidade[item.id]
                  const fornecedor=cot?.fornecedor_id?fornecedoresCompras[cot.fornecedor_id]?.nome:null
                  const dados=dadosCompra(item)
                  const comprado=compraEfetivada(item.status)
                  const recebidoItem=Boolean(item.recebido_em)||String(item.status||'').toLowerCase()==='recebido'
                  const qtd=Number(item.quantidade||0)
                  const unidade=item.unidade||''
                  return <tr key={item.id} className="border-t align-middle">
                    <td className="px-3 py-3"><ItemCompraVisual codigo={visual.codigo} descricao={visual.descricao} imagem={visual.imagem} imagemObrigatoria={visual.imagemObrigatoria}/></td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{qtd.toLocaleString('pt-BR')} {unidade}</td>
                    <td className="px-3 py-3 font-semibold text-slate-700">{(comprado?qtd:0).toLocaleString('pt-BR')} {unidade}</td>
                    <td className={'px-3 py-3 font-bold '+(comprado?'text-emerald-700':'text-amber-700')}>{(comprado?0:qtd).toLocaleString('pt-BR')} {unidade}</td>
                    <td className="px-3 py-3 text-slate-600">{fornecedor||dados.fornecedor||'—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-700">{dados.pedido?'Pedido '+dados.pedido:'—'}</div>
                      {dados.documentoUrl?<a href={dados.documentoUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-700 hover:underline">{dados.documento||'Abrir documento'}</a>:dados.documento&&<span>{dados.documento}</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      <div className="font-semibold text-slate-700">{dados.valor?moeda(dados.valor):'—'}</div>
                      {dados.prazo&&<div>Prazo: {dados.prazo}</div>}
                    </td>
                    <td className="px-3 py-3 text-slate-600">{dataBR(cot?.previsao_entrega||dados.previsaoEntrega)}</td>
                    <td className="px-3 py-3"><span className={'rounded-full px-2 py-1 text-xs font-bold '+(recebidoItem?'bg-emerald-100 text-emerald-700':comprado?'bg-violet-100 text-violet-700':String(item.status||'').toLowerCase()==='cotacao'?'bg-blue-100 text-blue-700':'bg-slate-100 text-slate-600')}>{recebidoItem?'Recebido':status(item.status)}</span></td>
                    <td className="px-3 py-3"><button type="button" disabled={ocupadoMateriais} onClick={()=>void editarCompraCentral(item)} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40"><Pencil size={13}/>Editar</button></td>
                  </tr>
                })}
                {!listaCategoria.length&&<tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum item de {rotuloCategoria(categoriaAberta).toLowerCase()} vinculado a esta obra.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Regra: Perfis e Acessórios devem exibir código, descrição e imagem técnica. Quando a imagem estiver ausente, o Atlas sinaliza o cadastro pendente sem bloquear o acompanhamento da compra.</p>
        </Box>}
        {aba==='materiais'&&(()=>{
          const grupoPdf=categoriaMaterialAberta==='perfil'?'perfis':categoriaMaterialAberta==='acessorios'?'acessorios':categoriaMaterialAberta==='vidro'?'vidros':null
          const colunas=[
            ['faltas','Falta comprar','border-red-200','bg-red-50/60','text-red-700',kanbanMateriais.faltas],
            ['cotacao','Em cotação','border-blue-200','bg-blue-50/60','text-blue-700',kanbanMateriais.cotacao],
            ['comprado','Comprado','border-emerald-200','bg-emerald-50/60','text-emerald-700',kanbanMateriais.comprado],
            ['entrega','Aguardando chegar','border-amber-200','bg-amber-50/70','text-amber-700',kanbanMateriais.entrega],
            ['recebido','Recebido','border-teal-200','bg-teal-50/60','text-teal-700',kanbanMateriais.recebido],
          ] as const
          const rotulo=rotuloCategoria(categoriaMaterialAberta)
          return <Box titulo="Materiais técnicos desta venda">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-slate-50 p-3">
              <div>
                <b className="text-sm text-slate-800">Gerencie os materiais por categoria</b>
                <p className="mt-1 text-xs text-slate-500">Clique em Perfil, Acessório, Vidro ou Outros para visualizar somente os itens daquela categoria, alterar, substituir, incluir ou excluir.</p>
                {mensagemMateriais&&<p className="mt-1 text-[11px] font-semibold text-blue-700">{mensagemMateriais}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={inputPdfCompraRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e=>void analisarPdfCompra(e.target.files?.[0]||null)}/>
                <button type="button" onClick={()=>inputPdfCompraRef.current?.click()} disabled={analisandoPdfCompra||ocupadoMateriais||!obra?.id} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">{analisandoPdfCompra?<Loader2 size={13} className="animate-spin"/>:<FileText size={13}/>} {analisandoPdfCompra?'Lendo PDF...':'Adicionar PDF de compra'}</button>
                <button type="button" onClick={()=>void sincronizarMateriaisWVetro(false)} disabled={sincronizandoMateriais||ocupadoMateriais} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50">{sincronizandoMateriais?<Loader2 size={13} className="animate-spin"/>:<RefreshCw size={13}/>} {sincronizandoMateriais?'Sincronizando...':'Sincronizar W.Vetro'}</button>
                {obra?.id&&<Link href={`/obras/${obra.id}/materiais`} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><Boxes size={13}/>Editor completo</Link>}
              </div>
            </div>

            {analisePdfCompra&&<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><b className="text-sm text-slate-900">Conferência do PDF de compra</b><p className="mt-1 text-xs text-slate-600">{analisePdfCompra.arquivo.nome}{analisePdfCompra.fornecedor?.nome?` · Fornecedor: ${analisePdfCompra.fornecedor.nome}`:' · Fornecedor não identificado'}</p></div>
                <button type="button" onClick={()=>{setAnalisePdfCompra(null);setSelecionadosPdfCompra([])}} className="grid h-8 w-8 place-items-center rounded-lg border bg-white text-slate-500"><X size={14}/></button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div className="rounded-lg bg-white p-2 text-xs"><span className="text-slate-400">Identificados</span><b className="block text-base text-slate-800">{analisePdfCompra.resumo.identificados}</b></div>
                <div className="rounded-lg bg-white p-2 text-xs"><span className="text-slate-400">IA sugere comprado</span><b className="block text-base text-emerald-700">{analisePdfCompra.resumo.sugeridosComprados}</b></div>
                <div className="rounded-lg bg-white p-2 text-xs"><span className="text-slate-400">Validar manualmente</span><b className="block text-base text-amber-700">{analisePdfCompra.resumo.pendentesValidacao}</b></div>
                <div className="rounded-lg bg-white p-2 text-xs"><span className="text-slate-400">Ainda faltando</span><b className="block text-base text-red-700">{analisePdfCompra.resumo.aindaNaoIdentificados}</b></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={()=>setSelecionadosPdfCompra(analisePdfCompra.itens.map(i=>i.necessidade_id))} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Selecionar identificados</button>
                <button type="button" onClick={()=>setSelecionadosPdfCompra([])} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-slate-500">Limpar seleção</button>
                <span className="text-xs text-slate-500">{selecionadosPdfCompra.length} item(ns) para confirmar</span>
              </div>
              <div className="mt-3 max-h-64 overflow-auto rounded-lg border bg-white">
                {analisePdfCompra.itens.map(item=><label key={item.necessidade_id} className="flex cursor-pointer items-start gap-3 border-b p-3 last:border-b-0">
                  <input type="checkbox" checked={selecionadosPdfCompra.includes(item.necessidade_id)} onChange={()=>setSelecionadosPdfCompra(atual=>atual.includes(item.necessidade_id)?atual.filter(id=>id!==item.necessidade_id):[...atual,item.necessidade_id])} className="mt-1 h-4 w-4"/>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-slate-700">{item.codigo||'Sem código'}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.validacao==='sugerido_comprado'?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{item.validacao==='sugerido_comprado'?'IA confiante':'Conferir'}</span><span className="text-[10px] text-slate-400">{Math.round((item.confianca||0)*100)}%</span></div><p className="truncate text-xs text-slate-700">{item.descricao}</p><p className="mt-0.5 text-[10px] text-slate-500">PDF: {item.quantidade_documento==null?'quantidade não confirmada':`${Number(item.quantidade_documento).toLocaleString('pt-BR')} ${item.unidade_documento||item.unidade||''}`} · Necessário: {Number(item.quantidade_necessaria||0).toLocaleString('pt-BR')} {item.unidade||''}</p>{item.observacao&&<p className="mt-0.5 text-[10px] text-amber-700">{item.observacao}</p>}</div>
                </label>)}
                {!analisePdfCompra.itens.length&&<p className="p-4 text-center text-xs text-slate-500">Nenhum material foi associado automaticamente. A lista permanece sem alteração para conferência manual.</p>}
              </div>
              {analisePdfCompra.pendencias.length>0&&<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3"><b className="text-xs text-amber-800">Pendências para conferir</b><div className="mt-1 space-y-1">{analisePdfCompra.pendencias.slice(0,8).map((p,idx)=><p key={idx} className="text-[11px] text-amber-700">• {p.texto||'Item'}{p.motivo?` — ${p.motivo}`:''}</p>)}</div></div>}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-slate-500">Nada é alterado só pela leitura. A compra só muda depois da sua confirmação.</p><button type="button" disabled={ocupadoMateriais||!selecionadosPdfCompra.length} onClick={()=>void aplicarPdfCompra()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{ocupadoMateriais?<Loader2 size={13} className="animate-spin"/>:<CheckCircle2 size={13}/>}Confirmar selecionados como comprados</button></div>
            </div>}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['perfil','Perfil',materiaisPorCategoria.perfil.length,Boxes],
                ['acessorios','Acessório',materiaisPorCategoria.acessorios.length,PackageCheck],
                ['vidro','Vidro',materiaisPorCategoria.vidro.length,FileText],
                ['outros','Outros',materiaisPorCategoria.outros.length,ClipboardList],
              ] as const).map(([id,label,total,Icon])=><button key={id} type="button" onClick={()=>setCategoriaMaterialAberta(id)} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${categoriaMaterialAberta===id?'border-blue-600 bg-blue-600 text-white shadow-sm':'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${categoriaMaterialAberta===id?'bg-white/15':'bg-slate-100'}`}><Icon size={17}/></span>
                <div><b className="text-sm">{label} ({total} itens)</b><p className={`mt-0.5 text-[11px] ${categoriaMaterialAberta===id?'text-blue-100':'text-slate-400'}`}>Ver somente {label.toLowerCase()}</p></div>
              </button>)}
            </div>

            <div className="mt-4 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
              {colunas.map(([id,titulo,borda,fundo,texto,itensColuna])=><div key={id} onDragOver={e=>{e.preventDefault();if(materialArrastandoId)setColunaArrasteSobre(id)}} onDragLeave={e=>{if(e.currentTarget===e.target)setColunaArrasteSobre(null)}} onDrop={e=>{e.preventDefault();void soltarMaterialNoKanban(id)}} className={`overflow-hidden rounded-xl border transition ${borda} ${fundo} ${colunaArrasteSobre===id?'ring-2 ring-blue-400 shadow-md':''}`}>
                <div className="flex items-center justify-between border-b border-white/80 px-3 py-2.5"><b className={`text-xs ${texto}`}>{titulo} ({itensColuna.length})</b><ChevronRight size={13} className={texto}/></div>
                <div className="space-y-2 p-2.5">
                  {itensColuna.slice(0,4).map(m=>{const img=imagemMaterial(m);return <div key={m.id} draggable={!ocupadoMateriais} onDragStart={e=>{setMaterialArrastandoId(m.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',m.id)}} onDragEnd={()=>{setMaterialArrastandoId(null);setColunaArrasteSobre(null)}} className={`flex cursor-grab items-center gap-2 rounded-lg border border-white bg-white p-2 shadow-sm active:cursor-grabbing ${materialArrastandoId===m.id?'opacity-50 ring-2 ring-blue-300':''}`} title="Arraste para outra coluna para mudar a situação">
                    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-slate-50">{img?<img src={img} alt={m.descricao} className="h-full w-full object-contain p-0.5"/>:<ImageIcon size={14} className="text-slate-300"/>}</div>
                    <div className="min-w-0"><div className="font-mono text-[10px] font-bold text-slate-700">{m.codigo||'Sem código'}</div><div className="truncate text-[11px] text-slate-600">{m.descricao}</div><div className="text-[10px] text-slate-400">Qtd. {Number(m.quantidade_ajustada??m.quantidade_tecnica??0).toLocaleString('pt-BR')} {m.unidade}</div></div>
                  </div>})}
                  {itensColuna.length>4&&<button type="button" onClick={()=>abrirListaSituacao(id)} className="w-full rounded-lg border border-dashed bg-white/70 px-2 py-2 text-center text-[10px] font-bold text-blue-600 hover:bg-white">Ver todos ({itensColuna.length})</button>}
                  {!itensColuna.length&&<div className="rounded-lg border border-dashed bg-white/60 px-2 py-5 text-center text-[10px] text-slate-400">Solte um item aqui</div>}
                </div>
              </div>)}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="font-bold text-slate-900">Lista completa de materiais - {rotulo}</h3><p className="text-xs text-slate-500">Mostrando somente {rotulo.toLowerCase()}. Você pode selecionar individualmente ou arrastar os cards do Kanban para mudar a situação.</p></div>
              <div className="flex flex-wrap gap-2">
                {obra?.id&&grupoPdf&&<Link target="_blank" href={`/obras/${obra.id}/materiais/pdf?${pacoteTecnicoId?`pacote=${pacoteTecnicoId}`:`orcamento=${venda.orcamento_id}`}&grupo=${grupoPdf}`} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700"><FileDown size={13}/>Gerar lista de {rotulo.toLowerCase()}</Link>}
                <button type="button" disabled={ocupadoMateriais||!pacoteTecnicoId} onClick={()=>void adicionarMaterialCentral()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{ocupadoMateriais?<Loader2 size={13} className="animate-spin"/>:<Plus size={13}/>}Adicionar material</button>
              </div>
            </div>

            <div ref={listaMateriaisRef} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={alternarSelecionarTodos} disabled={!materiaisTabela.length} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">{todosMateriaisTabelaSelecionados?'Desmarcar todos':'Selecionar todos'}</button>
                <span className="text-xs font-semibold text-slate-600">{selecionadosMateriais.length} selecionado(s)</span>
                {filtroSituacaoMaterial!=='todos'&&<button type="button" onClick={()=>setFiltroSituacaoMaterial('todos')} className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700">Filtro: {filtroSituacaoMaterial==='faltas'?'Falta comprar':filtroSituacaoMaterial==='cotacao'?'Em cotação':filtroSituacaoMaterial==='comprado'?'Comprado':filtroSituacaoMaterial==='entrega'?'Aguardando chegar':'Recebido'} · mostrar todos</button>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={ocupadoMateriais||!selecionadosMateriais.length} onClick={()=>void moverMateriaisEmLote('cotacao')} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-700 disabled:opacity-40">Em cotação</button>
                <button type="button" disabled={ocupadoMateriais||!selecionadosMateriais.length} onClick={()=>void moverMateriaisEmLote('comprado')} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-700 disabled:opacity-40">Comprado</button>
                <button type="button" disabled={ocupadoMateriais||!selecionadosMateriais.length} onClick={()=>void moverMateriaisEmLote('entrega')} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-bold text-amber-700 disabled:opacity-40">Aguardando chegar</button>
                <button type="button" disabled={ocupadoMateriais||!selecionadosMateriais.length} onClick={()=>void moverMateriaisEmLote('recebido')} className="rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-2 text-[11px] font-bold text-teal-700 disabled:opacity-40">Recebido</button>
                <button type="button" disabled={ocupadoMateriais||!selecionadosMateriais.length} onClick={()=>void moverMateriaisEmLote('necessidade')} className="rounded-lg border bg-white px-2.5 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-40">Voltar para falta comprar</button>
              </div>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1420px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-3 py-2.5"><input type="checkbox" aria-label="Selecionar todos os materiais visíveis" checked={todosMateriaisTabelaSelecionados} onChange={alternarSelecionarTodos} className="h-4 w-4"/></th><th>Imagem</th><th>Código</th><th>Descrição</th><th>Quantidade</th><th>Unidade</th><th>Medida / corte</th><th>Cor</th><th>Situação</th><th>Fornecedor</th><th>Ações</th></tr></thead>
                <tbody>
                  {materiaisTabela.map(m=>{const img=imagemMaterial(m);const col=colunaMaterial(m);const situacao=col==='faltas'?'Falta comprar':col==='cotacao'?'Em cotação':col==='comprado'?'Comprado':col==='entrega'?'Aguardando chegar':'Recebido';const badge=col==='recebido'?'bg-emerald-100 text-emerald-700':col==='comprado'?'bg-teal-100 text-teal-700':col==='entrega'?'bg-amber-100 text-amber-700':col==='cotacao'?'bg-blue-100 text-blue-700':'bg-red-100 text-red-700';const compra=compraRelacionadaMaterial(m);return <tr key={m.id} className="border-t align-middle">
                    <td className="px-3 py-3"><input type="checkbox" aria-label={`Selecionar ${m.codigo||m.descricao}`} checked={selecionadosMateriais.includes(m.id)} onChange={()=>alternarSelecaoMaterial(m.id)} className="h-4 w-4 cursor-pointer"/></td>
                    <td className="px-3 py-2"><div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg border bg-slate-50">{img?<img src={img} alt={m.descricao} className="h-full w-full object-contain p-1"/>:<ImageIcon size={17} className="text-slate-300"/>}</div></td>
                    <td className="px-3 py-3 font-mono text-xs font-bold text-slate-800">{m.codigo||'—'}</td>
                    <td className="px-3 py-3"><b className="text-slate-800">{m.descricao}</b>{m.justificativa_ajuste&&<div className="mt-1 max-w-[330px] text-[10px] text-slate-400">{m.justificativa_ajuste}</div>}</td>
                    <td className="px-3 py-3 font-bold text-slate-800">{Number(m.quantidade_ajustada??m.quantidade_tecnica??0).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3 text-slate-600">{m.unidade||'UN'}</td>
                    <td className="px-3 py-3 text-slate-600">{m.comprimento_corte_mm?`${Math.round(Number(m.comprimento_corte_mm))} mm`:m.comprimento_barra_mm?`Barra ${Math.round(Number(m.comprimento_barra_mm))} mm`:'—'}</td>
                    <td className="px-3 py-3 text-slate-600">{m.cor_ref||'—'}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${badge}`}>{situacao}</span></td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-600">{fornecedorCompraMaterial(m)}</td>
                    <td className="px-3 py-3"><div className="flex items-center gap-1.5">{col!=='comprado'&&col!=='entrega'&&col!=='recebido'&&<button disabled={ocupadoMateriais} onClick={()=>void confirmarCompradoMaterial(m)} title="Confirmar que este material foi comprado" className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"><CheckCircle2 size={13}/></button>}<button disabled={ocupadoMateriais} onClick={()=>void editarMaterialCentral(m)} title="Editar quantidade, descrição ou medida" className="grid h-8 w-8 place-items-center rounded-lg border text-blue-700 hover:bg-blue-50 disabled:opacity-40"><Pencil size={13}/></button><button disabled={ocupadoMateriais} onClick={()=>void substituirMaterialCentral(m)} title="Substituir material" className="grid h-8 w-8 place-items-center rounded-lg border text-violet-700 hover:bg-violet-50 disabled:opacity-40"><Replace size={13}/></button><button disabled={ocupadoMateriais} onClick={()=>void excluirMaterialCentral(m)} title="Excluir material desta venda" className="grid h-8 w-8 place-items-center rounded-lg border text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={13}/></button></div></td>
                  </tr>})}
                  {!materiaisTabela.length&&<tr><td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">Nenhum item de {rotulo.toLowerCase()} neste filtro. Use “Adicionar material”, sincronize com o W.Vetro ou mostre todos os status.</td></tr>}
                </tbody>
              </table>
            </div>
          </Box>
        })()}

        {aba==='tipologias'&&<Box titulo="Tipologias vendidas">
          <div className="grid gap-3 md:grid-cols-2">{itens.map((item:any,idx:number)=><div key={item.id||idx} className="rounded-xl border p-4"><p className="text-[11px] font-bold uppercase text-slate-400">Item {idx+1}</p><b className="mt-1 block text-slate-800">{item.ambiente||item.descricao||item.configuracao_nome||item.tipo_esquadria||'Tipologia'}</b><p className="mt-1 text-xs text-slate-500">{item.descricao||item.tipo_outro_texto||''}</p><p className="mt-2 text-xs text-slate-500">Qtd {item.quantidade||1}{item.largura_mm&&item.altura_mm?` · ${item.largura_mm} x ${item.altura_mm} mm`:''}</p></div>)}{!itens.length&&<p className="text-sm text-slate-400">O orçamento desta venda ainda não possui itens estruturados.</p>}</div>
        </Box>}

        {aba==='producao'&&<Box titulo="Produção desta venda">
          {setorPorNome.producao&&<div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">Status geral: <b>{setorPorNome.producao.nome}</b></div>}
          <div className="space-y-2">{ordens.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><b className="text-sm">OP #{o.numero||'—'} · {o.titulo||o.item_ref||'Peça'}</b><p className="text-xs text-slate-500">Qtd {o.quantidade||1} · criada em {dataBR(o.created_at)}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{status(o.status)}</span></div>)}{!ordens.length&&<p className="py-6 text-center text-sm text-slate-400">Ainda não existem ordens de produção para esta venda.</p>}</div>
        </Box>}

        {aba==='instalacao'&&<Box titulo="Instalação desta venda">
          <div className="rounded-xl border p-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Wrench size={20}/></span><div><b className="text-slate-800">{colunaInstalacao?.nome||'Ainda não gerada'}</b><p className="text-xs text-slate-500">{colunaInstalacao?'Status sincronizado com o Kanban de Instalação.':'Quando a obra entrar no fluxo de instalação, o status aparecerá aqui automaticamente.'}</p></div></div></div>
        </Box>}

        {aba==='notas'&&<Box titulo="Notas / Recibos desta venda">
          <div className="space-y-3">{recebimentosVenda.map(r=>{const desconto=Number(r.desconto||0);return <div key={r.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><b className="text-sm">{moeda(r.valor)} recebido</b>{desconto>0&&<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">{moeda(desconto)} desconto</span>}<span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold uppercase text-emerald-700">{r.forma||'Forma não informada'}</span></div><p className="mt-1 text-xs text-slate-500">Recebido em {dataBR(r.data_recebimento)}{desconto>0?<> · Total baixado {moeda(Number(r.valor||0)+desconto)}</>:null}</p><p className="mt-1 text-xs text-slate-400">Lançado no Atlas em {dataHoraBR(r.created_at)}{r.criado_por_nome?<> por {r.criado_por_nome}</>:null}</p>{r.referencia&&<p className="mt-2 text-xs text-slate-500">Referência/comprovante: {r.referencia}</p>}{r.observacoes&&<p className="mt-1 text-xs text-slate-500">Observações: {r.observacoes}</p>}</div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">{status(r.status||'registrado')}</span></div></div>})}{!recebimentosVenda.length&&<p className="py-6 text-center text-sm text-slate-400">Nenhum recibo/recebimento alocado a esta venda ainda.</p>}</div>
          <div className="mt-4 rounded-xl border border-dashed p-3 text-xs text-slate-500">Notas fiscais emitidas para a obra serão incluídas aqui quando estiverem vinculadas à venda. Nenhuma nota de outro cliente/obra será misturada nesta tela.</div>
        </Box>}

        {aba==='documentos'&&<Box titulo="Documentos vinculados ao cliente / obra">
          <div className="space-y-2">{documentos.slice(0,30).map(d=><a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-brand-navy"><div><b className="text-sm">{d.titulo}</b><p className="text-xs text-slate-500">{d.nome_arquivo||'Arquivo'} · {dataBR(d.created_at)}</p></div><FileText size={16} className="text-slate-400"/></a>)}{!documentos.length&&<p className="text-sm text-slate-400">Nenhum documento anexado.</p>}</div>
        </Box>}

        {aba==='historico'&&<Box titulo="Histórico da venda">
          <div className="space-y-4">
            <div className="flex gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-emerald-500"/><div><b className="text-sm">Venda confirmada</b><p className="text-xs text-slate-500">{dataBR(venda.confirmado_em)} · Orçamento #{numeroOrcamento(orcamento)}</p></div></div>
            {setorItens.map(i=>{const c=setorColunas[i.coluna_id];return c?<div key={i.id} className="flex gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-brand-navy"/><div><b className="text-sm">{c.setor_id.replace(/-/g,' ')} · {c.nome}</b><p className="text-xs text-slate-500">{dataBR(i.atualizado_em)}</p></div></div>:null})}
            {compras.map(c=><div key={`cp-${c.id}`} className="flex gap-3"><span className="mt-1 h-3 w-3 rounded-full bg-amber-500"/><div><b className="text-sm">Compra/material · {c.descricao}</b><p className="text-xs text-slate-500">{dataBR(c.created_at)} · {status(c.status)}</p></div></div>)}
          </div>
        </Box>}
      </div>
    </main>

    {modalRecebimento&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">Registrar recebimento desta venda</h2><p className="mt-1 text-xs text-slate-500">Pode ser parcial ou total. O valor recebido entra no financeiro geral e o desconto é registrado separadamente como abatimento.</p></div><button onClick={()=>setModalRecebimento(false)}><X size={18}/></button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Valor recebido<input value={recebimento.valor} onChange={e=>setRecebimento(f=>({...f,valor:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0,00"/></label>
        <label className="text-sm">Desconto<input value={recebimento.desconto} onChange={e=>setRecebimento(f=>({...f,desconto:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="0,00"/></label>
        <label className="text-sm">Data do recebimento<input type="date" max={dataInputLocal(new Date())} value={recebimento.data} onChange={e=>setRecebimento(f=>({...f,data:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"/><span className="mt-1 block text-[11px] text-slate-400">Use a data em que o dinheiro realmente foi recebido, mesmo que esteja lançando hoje.</span></label>
        <label className="text-sm">Forma<select value={recebimento.forma} onChange={e=>setRecebimento(f=>({...f,forma:e.target.value}))} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option></select></label>
      </div>
      <div className="mt-3 rounded-xl border bg-slate-50 p-3">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div><span className="text-slate-500">Saldo atual</span><b className="mt-1 block text-sm text-slate-900">{moeda(aReceber)}</b></div>
          <div><span className="text-slate-500">Total baixado</span><b className="mt-1 block text-sm text-slate-900">{moeda(numeroEntrada(recebimento.valor)+numeroEntrada(recebimento.desconto))}</b></div>
          <div><span className="text-slate-500">Saldo após</span><b className="mt-1 block text-sm text-brand-teal">{moeda(Math.max(0,aReceber-numeroEntrada(recebimento.valor)-numeroEntrada(recebimento.desconto)))}</b></div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{numeroEntrada(recebimento.valor)+numeroEntrada(recebimento.desconto)>0&&numeroEntrada(recebimento.valor)+numeroEntrada(recebimento.desconto)<aReceber-0.009?'Recebimento parcial: o saldo restante continuará em aberto.':'O Atlas atualiza automaticamente o saldo desta venda no financeiro.'}</p>
      </div>
      <label className="mt-3 block text-sm">Obra<input readOnly value={obra?.nome||'Venda ainda sem obra vinculada'} className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 text-slate-500"/></label>
      <input value={recebimento.referencia} onChange={e=>setRecebimento(f=>({...f,referencia:e.target.value}))} className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" placeholder="Referência / comprovante"/>
      <textarea value={recebimento.observacoes} onChange={e=>setRecebimento(f=>({...f,observacoes:e.target.value}))} className="mt-3 w-full rounded-lg border p-3 text-sm" rows={3} placeholder="Observações"/>
      <div className="mt-4 flex justify-end gap-2"><button onClick={()=>setModalRecebimento(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button><button disabled={salvando||numeroEntrada(recebimento.valor)<=0||numeroEntrada(recebimento.valor)+numeroEntrada(recebimento.desconto)>aReceber+0.009} onClick={registrarRecebimento} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{salvando?'Registrando...':'Registrar recebimento'}</button></div>
    </div></div>}
  </div>
}