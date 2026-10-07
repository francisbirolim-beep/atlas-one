'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Building2, CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Factory,
  FileText, Loader2, PackageCheck, Receipt, ShoppingCart, Wallet, Wrench, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { registrarRecebimentoVendaComDesconto } from '@/lib/cliente360Recebimentos'

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
type Compra = { id:string; produto_id?:string|null; descricao?:string|null; categoria?:string|null; quantidade?:number|null; unidade?:string|null; status?:string|null; recebido_em?:string|null; created_at:string }
type CotacaoCompra = { id:string; necessidade_id:string; fornecedor_id?:string|null; preco_unitario?:number|null; frete?:number|null; prazo_dias?:number|null; previsao_entrega?:string|null; selecionada?:boolean|null }
type FornecedorCompra = { id:string; nome:string }
type Ordem = { id:string; numero?:number|null; titulo?:string|null; item_ref?:string|null; quantidade?:number|null; status?:string|null; created_at:string }
type SetorItem = { id:string; coluna_id:string; titulo?:string|null; atualizado_em?:string|null }
type SetorColuna = { id:string; setor_id:string; nome:string; ordem:number }
type Documento = { id:string; obra_id?:string|null; titulo:string; nome_arquivo?:string|null; url:string; created_at:string; tipo?:string|null }
type RecebimentoVenda = { id:string; data_recebimento?:string|null; valor?:number|null; valor_desconto?:number|null; desconto?:number|null; forma?:string|null; referencia?:string|null; observacoes?:string|null; status?:string|null; criado_por_nome?:string|null; created_at?:string|null }

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
  const [cotacoesCompras,setCotacoesCompras]=useState<CotacaoCompra[]>([])
  const [fornecedoresCompras,setFornecedoresCompras]=useState<Record<string,FornecedorCompra>>({})
  const [ordens,setOrdens]=useState<Ordem[]>([])
  const [setorItens,setSetorItens]=useState<SetorItem[]>([])
  const [setorColunas,setSetorColunas]=useState<Record<string,SetorColuna>>({})
  const [documentos,setDocumentos]=useState<Documento[]>([])
  const [recebimentosVenda,setRecebimentosVenda]=useState<RecebimentoVenda[]>([])
  const [aba,setAba]=useState<Aba>('visao')
  const [painelEtapa,setPainelEtapa]=useState<'financeiro'|'compras'|'mercadoria'|'producao'|'instalacao'|'venda'|null>(null)
  const [categoriaAberta,setCategoriaAberta]=useState<'perfil'|'vidro'|'acessorios'|'outros'>('perfil')
  const [carregando,setCarregando]=useState(true)
  const [erro,setErro]=useState('')
  const [modalRecebimento,setModalRecebimento]=useState(false)
  const [salvando,setSalvando]=useState(false)
  const [recebimento,setRecebimento]=useState({valor:'',desconto:'',forma:'pix',data:new Date().toISOString().slice(0,10),referencia:'',observacoes:''})

  useEffect(()=>{void carregar()},[vendaId,clienteId])

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
        supabase.from('compras_necessidades').select('id,produto_id,descricao,categoria,quantidade,unidade,status,recebido_em,created_at').eq('obra_id',v.obra_id).order('created_at',{ascending:true}),
        supabase.from('cliente_documentos').select('id,obra_id,titulo,nome_arquivo,url,created_at,tipo').eq('cliente_id',v.cliente_id).eq('obra_id',v.obra_id).order('created_at',{ascending:false}),
      ])
      if(ob.data)setObra(ob.data as Obra)
      const comprasObra=(cp.data||[]) as Compra[]
      setCompras(comprasObra)
      setDocumentos((dc.data||[]) as Documento[])

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

  const valorVenda=Number(venda?.valor_venda||orcamento?.valor_estimado||0)
  const custoPrevisto=Number(venda?.custo_previsto||orcamento?.custo_estimado||0)
  const recebido=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Number(c.valor_pago||0),0)
  const saldoContas=contas.filter(c=>c.status!=='cancelado').reduce((s,c)=>s+Math.max(0,Number(c.valor||0)-Number(c.valor_pago||0)-Number(c.valor_desconto||0)),0)
  const aReceber=contas.length?saldoContas:Math.max(0,valorVenda-recebido)
  const margemPrevista=valorVenda>0&&custoPrevisto>0?((valorVenda-custoPrevisto)/valorVenda)*100:0
  const markup=valorVenda>0&&custoPrevisto>0?(valorVenda/custoPrevisto):0

  const comprasEfetivadas=compras.filter(c=>compraEfetivada(c.status)).length
  const comprasRecebidas=compras.filter(c=>c.recebido_em||String(c.status||'').toLowerCase()==='recebido').length
  const progressoCompras=pct(comprasEfetivadas,compras.length)
  const progressoMercadoria=pct(comprasRecebidas,compras.length)
  const ordensConcluidas=ordens.filter(o=>finalizada(o.status)).length
  const progressoProducao=pct(ordensConcluidas,ordens.length)

  const cotacaoPorNecessidade=useMemo(()=>Object.fromEntries(cotacoesCompras.map(item=>[item.necessidade_id,item])),[cotacoesCompras])
  const comprasPorCategoria=useMemo(()=>{
    const base:{perfil:Compra[];vidro:Compra[];acessorios:Compra[];outros:Compra[]}={perfil:[],vidro:[],acessorios:[],outros:[]}
    compras.forEach(item=>base[categoriaMaterial(item.categoria)].push(item))
    return base
  },[compras])
  const listaCategoria=comprasPorCategoria[categoriaAberta]

  const setorPorNome=useMemo(()=>{
    const r:Record<string,SetorColuna>={}
    setorItens.forEach(i=>{const c=setorColunas[i.coluna_id];if(c)r[c.setor_id]=c})
    return r
  },[setorItens,setorColunas])

  const colunaInstalacao=setorPorNome.instalacao
  const progressoInstalacao=colunaInstalacao?.nome.toLowerCase().includes('conclu')?100:colunaInstalacao?.nome.toLowerCase().includes('em instala')?60:colunaInstalacao?.nome.toLowerCase().includes('agendada')?30:colunaInstalacao?10:0
  const itens=(Array.isArray(orcamento?.itens)?orcamento?.itens:Array.isArray(venda?.itens_snapshot)?venda?.itens_snapshot:[])||[]

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
            <Link href={`/orcamento/${venda.orcamento_id}/composicao`} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-700"><FileText size={15}/>Abrir orçamento</Link>
          </div>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-7xl px-4 py-5">
      {erro&&<div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi titulo="Valor da venda" valor={moeda(valorVenda)}/>
        <Kpi titulo="Recebido" valor={moeda(recebido)} detalhe={`${pct(recebido,valorVenda).toFixed(0)}% recebido`}/>
        <Kpi titulo="A receber" valor={moeda(aReceber)} destaque/>
        <Kpi titulo="Custo previsto" valor={custoPrevisto>0?moeda(custoPrevisto):'—'}/>
        <Kpi titulo="Custo realizado" valor="—" detalhe="Será alimentado pelas entradas reais"/>
        <Kpi titulo="Margem prevista" valor={custoPrevisto>0?`${margemPrevista.toFixed(1)}%`:'—'}/>
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
          <div className="grid gap-3 md:grid-cols-4"><Kpi titulo="Custo previsto" valor={custoPrevisto>0?moeda(custoPrevisto):'—'}/><Kpi titulo="Custo realizado" valor="—" detalhe="Próxima etapa: entradas reais por categoria"/><Kpi titulo="Margem prevista" valor={custoPrevisto>0?`${margemPrevista.toFixed(1)}%`:'—'}/><Kpi titulo="Markup" valor={markup>0?`${markup.toFixed(2)}x`:'—'}/></div>
          <div className="mt-4 rounded-xl border border-dashed p-4 text-sm text-slate-500">A estrutura já está separada nesta venda. Na próxima etapa, Perfil, Vidro, Acessórios, Mão de obra, Instalação, Frete e Outros serão alimentados com previsto x realizado e custo por tipologia.</div>
        </Box>}

        {aba==='compras'&&<Box titulo="Compras e materiais desta obra">
          <div className="space-y-2">{compras.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><b className="text-sm">{c.descricao||c.categoria||'Material'}</b><p className="text-xs text-slate-500">{c.quantidade||0} {c.unidade||''} · {c.categoria||'Sem categoria'} · lançado em {dataBR(c.created_at)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-bold ${c.recebido_em||finalizada(c.status)?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{c.recebido_em?'Recebido':status(c.status)}</span></div>)}{!compras.length&&<p className="py-6 text-center text-sm text-slate-400">Nenhuma compra/material vinculado à obra ainda.</p>}</div>
        </Box>}

        {aba==='materiais'&&<Box titulo="Materiais desta venda">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {['perfil','vidro','acessorio','outros'].map(cat=>{const lista=compras.filter(x=>String(x.categoria||'').toLowerCase().includes(cat==='acessorio'?'acess':cat));const recebidos=lista.filter(x=>x.recebido_em||finalizada(x.status)).length;return <div key={cat} className="rounded-xl border p-4"><p className="text-[11px] font-bold uppercase text-slate-400">{cat==='acessorio'?'Acessórios':cat.replace(/^./,s=>s.toUpperCase())}</p><p className="mt-1 text-xl font-bold text-slate-900">{lista.length}</p><p className="mt-1 text-xs text-slate-500">{recebidos} recebido(s) · {Math.max(0,lista.length-recebidos)} pendente(s)</p></div>})}
          </div>
          <p className="mt-4 text-xs text-slate-500">Esta visão usa as necessidades de compra já vinculadas à obra. Conforme entrada e conferência dos materiais forem lançadas, os status desta venda acompanham automaticamente.</p>
        </Box>}

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
