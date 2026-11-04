'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, ChevronRight, FileDown, FileSpreadsheet, Filter, ImageOff, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { useRelatoriosAcesso, autorizarExportacaoRelatorio } from '@/components/relatorios/RelatoriosAcesso'
import { baixarCSV, csvFinanceiro, dinheiro, formatarData } from '@/lib/financeiroPeriodo'
import type { TituloFinanceiro } from '@/lib/relatoriosContasFinanceiras'
import type { ColunaPdf, GrupoPdf } from '@/lib/relatoriosGerenciaisPdf'

type Tipo='pagar'|'receber'|'compras-fornecedor'|'compras-produto'|'vendas-cliente'|'vendas-produto'
type TipoAcesso='financeiro'|'compras'|'comercial'
type ItemAnalise={
 id:string;data:string;pessoa:string;pessoaId:string;documento:string;referencia:string;
 produto:string;produtoId:string;codigo:string;unidade:string;quantidade:number;
 valor:number;canal:string;imagem:string|null;categoria:string
}
type ResultadoAnalise={ok:boolean;tipo:Tipo;linhas:ItemAnalise[];observacao:string}
type ResultadoFinanceiro={ok:boolean;periodo:{hoje:string};pagar:{titulos:TituloFinanceiro[]}|null;receber:{titulos:TituloFinanceiro[]}|null}
type Linha={
 id:string;data:string;pessoa:string;pessoaId:string;referencia:string;documento:string;
 produto:string;produtoId:string;unidade:string;quantidade:number;valor:number;
 original:number;pago:number;saldo:number;imagem:string|null;categoria:string;canal:string;
 status:string
}
type Grupo={id:string;nome:string;total:number;itens:Linha[];imagem:string|null}
const tipos:{id:Tipo;titulo:string;descricao:string;acesso:TipoAcesso}[]=[
 {id:'pagar',titulo:'Contas a pagar',descricao:'Obrigações por fornecedor e vencimento',acesso:'financeiro'},
 {id:'receber',titulo:'Contas a receber',descricao:'Parcelas por cliente e vencimento',acesso:'financeiro'},
 {id:'compras-fornecedor',titulo:'Compras por fornecedor',descricao:'Total das notas fiscais confirmadas',acesso:'compras'},
 {id:'compras-produto',titulo:'Compras por produto',descricao:'Produtos das notas fiscais de entrada',acesso:'compras'},
 {id:'vendas-cliente',titulo:'Vendas por cliente',descricao:'Obras confirmadas e vendas de balcão',acesso:'comercial'},
 {id:'vendas-produto',titulo:'Vendas por produto',descricao:'Produtos vendidos no balcão',acesso:'comercial'}
]
const tiposFinanceiros=(t:Tipo)=>t==='pagar'||t==='receber'
const tiposProduto=(t:Tipo)=>t==='compras-produto'||t==='vendas-produto'
function intervaloMes(mes:string){
 const [ano,m]=mes.split('-').map(Number)
 const ultimo=new Date(ano,m,0).getDate()
 return {inicio:mes+'-01',fim:mes+'-'+String(ultimo).padStart(2,'0')}
}
function mesAtual(){
 const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date())
 return (p.find(x=>x.type==='year')?.value||'2026')+'-'+(p.find(x=>x.type==='month')?.value||'01')
}
const ordena=(a:Grupo,b:Grupo)=>b.total-a.total||a.nome.localeCompare(b.nome,'pt-BR')
const semInvalidas=(t:TituloFinanceiro)=>!['cancelado','estornado'].includes(t.status)
export default function RelatoriosSimplesPage(){
 const acessos=useRelatoriosAcesso()
 const disponiveis=tipos.filter(t=>acessos[t.acesso].consultar)
 const [tipo,setTipo]=useState<Tipo>('pagar')
 const [modo,setModo]=useState<'mes'|'periodo'>('mes')
 const [mes,setMes]=useState(mesAtual)
 const [periodo,setPeriodo]=useState(()=>intervaloMes(mesAtual()))
 const [aplicado,setAplicado]=useState(()=>intervaloMes(mesAtual()))
 const [busca,setBusca]=useState('')
 const [pessoa,setPessoa]=useState('')
 const [produto,setProduto]=useState('')
 const [situacao,setSituacao]=useState('aberto')
 const [dados,setDados]=useState<ResultadoAnalise|ResultadoFinanceiro|null>(null)
 const [aberto,setAberto]=useState<string|null>(null)
 const [erro,setErro]=useState('')
 const [carregando,setCarregando]=useState(false)
 const [gerando,setGerando]=useState(false)
 const [atualizado,setAtualizado]=useState('')
 const [recarregar,setRecarregar]=useState(0)
 const idTipo=disponiveis.some(t=>t.id===tipo)?tipo:disponiveis[0]?.id
 const tipoInfo=tipos.find(t=>t.id===idTipo)
 useEffect(()=>{
  if(!idTipo||!aplicado.inicio||!aplicado.fim)return
  const ctrl=new AbortController()
  let vivo=true
  async function carregar(){
   setCarregando(true);setErro('');setDados(null)
   try{
    const token=await tokenAtual()
    if(!token)throw new Error('Sessão expirada. Entre novamente no Atlas One.')
    const url=tiposFinanceiros(idTipo!)?'/api/relatorios/financeiro-contas':'/api/relatorios/analises-gerenciais'
    const query=new URLSearchParams({inicio:aplicado.inicio,fim:aplicado.fim})
    if(!tiposFinanceiros(idTipo!))query.set('tipo',idTipo!)
    const resposta=await fetch(url+'?'+query.toString(),{
     headers:{Authorization:'Bearer '+token},cache:'no-store',signal:ctrl.signal
    })
    const corpo=await resposta.json()
    if(!resposta.ok||!corpo.ok)throw new Error(corpo.error||'Não foi possível carregar o relatório.')
    if(vivo){setDados(corpo);setAtualizado(new Date().toLocaleString('pt-BR'))}
   }catch(e){
    if(vivo&&!ctrl.signal.aborted)setErro(e instanceof Error?e.message:'Não foi possível consultar os dados.')
   }finally{if(vivo)setCarregando(false)}
  }
  void carregar()
  return()=>{vivo=false;ctrl.abort()}
 },[idTipo,aplicado.inicio,aplicado.fim,recarregar])
 const linhas=useMemo<Linha[]>(()=>{
  if(!dados||!idTipo)return []
  if(tiposFinanceiros(idTipo)){
   const d=dados as ResultadoFinanceiro
   const lista=(idTipo==='pagar'?d.pagar?.titulos:d.receber?.titulos)||[]
   return lista.filter(semInvalidas).map(t=>({
    id:t.id,data:t.vencimento||'',pessoa:t.pessoa,pessoaId:t.pessoaId||'nome:'+t.pessoa,
    referencia:t.documento||t.referencia||'—',documento:t.documento||'',
    produto:'',produtoId:'',unidade:'',quantidade:1,valor:t.saldo,
    original:t.valor,pago:t.pago, saldo:t.saldo,imagem:null,categoria:'',
    canal:'Título financeiro',status:t.status
   }))
  }
  return (((dados as ResultadoAnalise).linhas)||[]).map(r=>({
   id:r.id,data:r.data,pessoa:r.pessoa,pessoaId:r.pessoaId,referencia:r.referencia,
   documento:r.documento,produto:r.produto,produtoId:r.produtoId,
   unidade:r.unidade,quantidade:r.quantidade,valor:r.valor,original:r.valor,pago:0,
   saldo:r.valor,imagem:r.imagem,categoria:r.categoria,canal:r.canal,status:'confirmado'
  }))
 },[dados,idTipo])
 const base=useMemo(()=>linhas.filter(r=>{
  if(!tiposFinanceiros(idTipo!))return true
  if(situacao==='sem-data')return !r.data&&r.saldo>0.009
  if(r.data<aplicado.inicio||r.data>aplicado.fim)return false
  if(situacao==='aberto')return r.saldo>0.009
  if(situacao==='quitado')return r.saldo<0.01
  if(situacao==='vencido')return r.saldo>0.009&&r.data<(dados as ResultadoFinanceiro)?.periodo?.hoje
  return true
 }),[linhas,idTipo,situacao,aplicado,dados])
 const pessoas=useMemo(()=>[...new Map(base.map(r=>[r.pessoaId,r.pessoa])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')),[base])
 const produtos=useMemo(()=>[...new Map(base.filter(r=>r.produtoId).map(r=>[r.produtoId,r.produto])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')),[base])
 const selecionadas=useMemo(()=>base.filter(r=>{
  if(pessoa&&r.pessoaId!==pessoa)return false
  if(produto&&r.produtoId!==produto)return false
  const q=busca.toLocaleLowerCase('pt-BR').trim()
  return !q||[r.pessoa,r.referencia,r.produto,r.documento].some(x=>x.toLocaleLowerCase('pt-BR').includes(q))
 }),[base,pessoa,produto,busca])
 const grupos=useMemo<Grupo[]>(()=>{
  const m=new Map<string,Grupo>()
  for(const r of selecionadas){
   const porProduto=tiposProduto(idTipo!)
   const key=(porProduto?r.produtoId+'|'+r.unidade:r.pessoaId)||r.pessoa
   const nome=porProduto?(r.produto+(r.unidade?' · '+r.unidade:'')):r.pessoa
   const item=m.get(key)||{id:key,nome,total:0,itens:[],imagem:porProduto?r.imagem:null}
   item.total+=tiposFinanceiros(idTipo!)?r.saldo:r.valor
   item.itens.push(r)
   if(!item.imagem&&r.imagem)item.imagem=r.imagem
   m.set(key,item)
  }
  return [...m.values()].sort(ordena)
 },[selecionadas,idTipo])
 const total=grupos.reduce((s,g)=>s+g.total,0)
 const temImagemPendente=tiposProduto(idTipo!)&&grupos.filter(g=>!g.imagem).length
 function escolher(t:Tipo){setTipo(t);setPessoa('');setProduto('');setBusca('');setSituacao('aberto');setAberto(null)}
 function aplicar(){
  const p=modo==='mes'?intervaloMes(mes):periodo
  const a=Date.parse(p.inicio+'T12:00:00Z'),b=Date.parse(p.fim+'T12:00:00Z')
  if(!p.inicio||!p.fim||Number.isNaN(a)||Number.isNaN(b)||a>b||b-a>366*86400000){
   setErro('Informe um período válido de até 12 meses.');return
  }
  setPessoa('');setProduto('');setBusca('');setAberto(null);setAplicado(p);setRecarregar(i=>i+1)
 }
 const referencias=(r:Linha)=>tiposFinanceiros(idTipo!)?r.referencia:r.referencia
 const labelPeriodo=formatarData(aplicado.inicio)+' a '+formatarData(aplicado.fim)
 const descricao=(dados&&!tiposFinanceiros(idTipo!)?(dados as ResultadoAnalise).observacao:
  'Valores e saldos de títulos na data da consulta, selecionados pelo vencimento. Não representam fluxo de caixa.')
 function colunas():ColunaPdf[]{
  if(tiposFinanceiros(idTipo!))return [
   {titulo:'Vencimento',largura:26},{titulo:'Documento / referência',largura:74},
   {titulo:'Situação',largura:55},{titulo:'Valor original',largura:39,alinhar:'right'},
   {titulo:'Pago',largura:39,alinhar:'right'},{titulo:'Em aberto',largura:40,alinhar:'right'}]
  if(tiposProduto(idTipo!))return [
   {titulo:'Data',largura:28},{titulo:'Nota / venda',largura:69},
   {titulo:'Fornecedor / cliente',largura:87},{titulo:'Quantidade',largura:43,alinhar:'right'},
   {titulo:'Valor (R$)',largura:46,alinhar:'right'}]
  return [
   {titulo:'Data',largura:33},{titulo:'Documento',largura:100},
   {titulo:'Origem',largura:65},{titulo:'Valor (R$)',largura:75,alinhar:'right'}]
 }
 function campos(r:Linha):string[]{
  if(tiposFinanceiros(idTipo!))return [
   formatarData(r.data)||'Sem data',referencias(r),
   r.saldo<0.01?'Quitada':r.pago>0?'Parcial':'Em aberto',
   dinheiro(r.original),dinheiro(r.pago),dinheiro(r.saldo)
  ]
  if(tiposProduto(idTipo!))return [
   formatarData(r.data),referencias(r),r.pessoa,
   r.quantidade.toLocaleString('pt-BR',{maximumFractionDigits:3})+' '+r.unidade,
   dinheiro(r.valor)]
  return [formatarData(r.data),referencias(r),r.canal,dinheiro(r.valor)]
 }
 async function pdf(){
  if(!idTipo||!tipoInfo||!dados||!acessos[tipoInfo.acesso].exportar)return
  setGerando(true);setErro('')
  try{
   await autorizarExportacaoRelatorio(tipoInfo.acesso)
   const {baixarPdfGerencial}=await import('@/lib/relatoriosGerenciaisPdf')
   const pg:GrupoPdf[]=grupos.map(g=>({
    nome:g.nome+(idTipo==='compras-fornecedor'&&g.itens[0]?.documento?' · CNPJ '+g.itens[0].documento:''),total:g.total,imagem:g.imagem,
    linhas:g.itens.map(i=>({valores:campos(i)}))
   }))
   await baixarPdfGerencial({
    titulo:tipoInfo.titulo,periodo:labelPeriodo,
    filtro:(pessoa?pessoas.find(x=>x[0]===pessoa)?.[1]:'Todos os clientes/fornecedores')+
     (produto?' · '+(produtos.find(x=>x[0]===produto)?.[1]||'Produto'):'')+
     (tiposFinanceiros(idTipo)?' · '+situacao:''),
    observacao:descricao,colunas:colunas(),grupos:pg,total,totalRegistros:selecionadas.length,unidadeTotal:'R$'
   })
  }catch(e){setErro(e instanceof Error?e.message:'Falha ao gerar PDF.')}
  finally{setGerando(false)}
 }
 async function exportar(){
  if(!idTipo||!tipoInfo)return
  try{
   await autorizarExportacaoRelatorio(tipoInfo.acesso)
   baixarCSV('atlas-'+idTipo+'-'+aplicado.inicio+'.csv',csvFinanceiro([
    ['Grupo','Pessoa','Produto','Data','Documento','Valor original','Pago','Saldo / Valor','Quantidade','Unidade'],
    ...grupos.flatMap(g=>g.itens.map(i=>[g.nome,i.pessoa,i.produto,i.data,i.referencia,i.original,i.pago,tiposFinanceiros(idTipo)?i.saldo:i.valor,i.quantidade,i.unidade]))
   ]))
  }catch(e){setErro(e instanceof Error?e.message:'Exportação não autorizada.')}
 }
 if(!disponiveis.length)return <main className="p-6 text-sm text-slate-600">Sem autorização para consultar relatórios gerenciais.</main>
 return <main className="mx-auto max-w-6xl space-y-5 px-3 py-6 md:px-6">
  <div className="flex items-center justify-between gap-3"><Link href="/relatorios" className="inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15}/>Central de Relatórios</Link><p className="text-xs text-slate-500">Somente consulta · Sem alterar lançamentos</p></div>
  <header><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Atlas One · Esquadrifácio</p>
   <h1 className="mt-1 text-2xl font-black text-slate-900">Relatórios simples para imprimir</h1>
   <p className="mt-1 text-sm text-slate-600">Escolha o relatório, selecione o mês ou período e gere um PDF detalhado com os totais.</p></header>
  <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
   {disponiveis.map(t=><button type="button" key={t.id} onClick={()=>escolher(t.id)} aria-pressed={idTipo===t.id}
    className={'rounded-xl border p-4 text-left transition '+(idTipo===t.id?'border-emerald-700 bg-emerald-50 shadow-sm':'border-slate-200 bg-white hover:border-emerald-300')}>
    <p className={'font-bold '+(idTipo===t.id?'text-emerald-900':'text-slate-900')}>{t.titulo}</p>
    <p className="mt-1 text-xs text-slate-600">{t.descricao}</p>
   </button>)}
  </section>
  <section className="rounded-xl border border-slate-200 bg-white p-4">
   <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Filter size={16}/>1. Escolha quando</h2>
   <div className="flex flex-wrap items-end gap-3">
    <label className="text-xs font-semibold text-slate-700">Período
     <select value={modo} onChange={e=>setModo(e.target.value as 'mes'|'periodo')} className="mt-1 block rounded-lg border p-2.5 text-sm">
      <option value="mes">Por mês</option><option value="periodo">Entre duas datas</option>
     </select></label>
    {modo==='mes'?<label className="text-xs font-semibold text-slate-700">Mês desejado<input type="month" value={mes} onChange={e=>setMes(e.target.value)} className="mt-1 block rounded-lg border p-2.5 text-sm"/></label>:<>
     <label className="text-xs font-semibold text-slate-700">De<input type="date" value={periodo.inicio} onChange={e=>setPeriodo(p=>({...p,inicio:e.target.value}))} className="mt-1 block rounded-lg border p-2.5 text-sm"/></label>
     <label className="text-xs font-semibold text-slate-700">Até<input type="date" value={periodo.fim} onChange={e=>setPeriodo(p=>({...p,fim:e.target.value}))} className="mt-1 block rounded-lg border p-2.5 text-sm"/></label></>}
    <button type="button" onClick={aplicar} disabled={carregando} className="rounded-lg bg-emerald-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Gerar relatório</button>
   </div>
  </section>
  {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
  {carregando&&<p className="rounded-xl border bg-white p-5 text-sm text-slate-600">Consultando dados de {tipoInfo?.titulo.toLowerCase()}…</p>}
  {dados&&!carregando&&<>
   <section className="rounded-xl border bg-white p-4">
    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold"><Search size={16}/>2. Filtre o que deseja imprimir</h2>
    <div className="flex flex-wrap gap-3">
     <label className="min-w-[180px] flex-1 text-xs font-semibold text-slate-700">{idTipo==='pagar'||idTipo?.startsWith('compras')?'Fornecedor':'Cliente'}
      <select value={pessoa} onChange={e=>setPessoa(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2.5 text-sm"><option value="">Todos</option>{pessoas.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label>
     {tiposProduto(idTipo!)&&<label className="min-w-[180px] flex-1 text-xs font-semibold text-slate-700">Produto
      <select value={produto} onChange={e=>setProduto(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2.5 text-sm"><option value="">Todos os produtos</option>{produtos.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label>}
     {tiposFinanceiros(idTipo!)&&<label className="min-w-[180px] text-xs font-semibold text-slate-700">Situação
      <select value={situacao} onChange={e=>{setSituacao(e.target.value);setPessoa('')}} className="mt-1 block w-full rounded-lg border bg-white p-2.5 text-sm">
       <option value="aberto">Em aberto no período</option><option value="todos">Todas no período</option>
       <option value="quitado">Quitadas no período</option><option value="vencido">Vencidas no período</option>
       <option value="sem-data">Sem vencimento definido</option>
      </select></label>}
     <label className="min-w-[180px] flex-1 text-xs font-semibold text-slate-700">Pesquisar nome ou documento
      <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar..." className="mt-1 block w-full rounded-lg border p-2.5 text-sm"/></label>
    </div>
   </section>
   <section className="space-y-4 rounded-xl border bg-white p-4 md:p-5">
    <div className="flex flex-wrap items-center justify-between gap-4">
     <div>
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">3. Resultado · {labelPeriodo}</p>
      <h2 className="mt-1 text-xl font-black text-slate-900">{tipoInfo?.titulo}</h2>
      <p className="mt-1 text-xs text-slate-500">Atualizado em {atualizado}</p>
     </div>
     <div className="flex flex-wrap gap-2">
      <button onClick={()=>void pdf()} disabled={gerando||!acessos[tipoInfo!.acesso].exportar} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
       <FileDown size={17}/>{gerando?'Preparando PDF…':'Baixar PDF completo'}</button>
      <button onClick={()=>void exportar()} disabled={!acessos[tipoInfo!.acesso].exportar} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-bold disabled:opacity-50"><FileSpreadsheet size={15}/>Excel / CSV</button>
     </div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
     <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{tiposFinanceiros(idTipo!)?'Saldo total em aberto':'Valor total'}</p><b className="mt-1 block text-xl font-black text-slate-900">{dinheiro(total)}</b></div>
     <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Lançamentos</p><b className="mt-1 block text-xl font-black">{selecionadas.length}</b></div>
     <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{tiposProduto(idTipo!)?'Produtos':'Clientes / fornecedores'}</p><b className="mt-1 block text-xl font-black">{grupos.length}</b></div>
    </div>
    {Boolean(temImagemPendente)&&<p className="text-xs text-amber-800">Atenção: {temImagemPendente} produto(s) do relatório não têm imagem associada no cadastro. O sistema indica a ausência, sem trocar pela imagem de outro produto.</p>}
    <p className="text-xs leading-relaxed text-slate-500">{descricao}</p>
    <div className="overflow-hidden rounded-xl border">
     <div className="flex items-center justify-between gap-3 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
      <span>{tiposProduto(idTipo!)?'Produto':'Fornecedor / cliente'}</span><span>Total</span>
     </div>
     {grupos.map(g=><div key={g.id} className="border-t">
      <button type="button" onClick={()=>setAberto(v=>v===g.id?null:g.id)}
       className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50">
       <span className="flex min-w-0 items-center gap-3">
        {tiposProduto(idTipo!)&&<span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
         {g.imagem?<img src={g.imagem} alt={'Foto de '+g.nome} className="h-full w-full object-contain" loading="lazy"/>:<span className="flex flex-col items-center text-[9px] text-amber-700"><ImageOff size={17}/>Sem foto</span>}</span>}
        {aberto===g.id?<ChevronDown size={16} className="shrink-0 text-slate-400"/>:<ChevronRight size={16} className="shrink-0 text-slate-400"/>}
        <span className="min-w-0"><span className="block break-words text-sm font-bold text-slate-800">{g.nome}</span><span className="text-xs text-slate-500">{g.itens.length} lançamento(s)</span></span>
       </span>
       <b className="shrink-0 text-sm tabular-nums">{dinheiro(g.total)}</b>
      </button>
      {aberto===g.id&&<div className="overflow-x-auto bg-slate-50 px-3 pb-3">
       <table className="w-full min-w-[600px] text-xs">
        <thead className="text-left text-slate-500"><tr><th className="p-2">{tiposFinanceiros(idTipo!)?'Vencimento':'Data'}</th><th className="p-2">Documento / referência</th>
         {tiposProduto(idTipo!)&&<th className="p-2">Fornecedor / cliente</th>}
         {tiposProduto(idTipo!)&&<th className="p-2 text-right">Quantidade</th>}
         {tiposFinanceiros(idTipo!)&&<th className="p-2 text-right">Valor original</th>}
         {tiposFinanceiros(idTipo!)&&<th className="p-2 text-right">Pago</th>}
         <th className="p-2 text-right">{tiposFinanceiros(idTipo!)?'Saldo':'Valor'}</th></tr></thead>
        <tbody>{g.itens.map(x=><tr key={x.id} className="border-t border-slate-200">
         <td className="p-2">{formatarData(x.data)}</td><td className="p-2">{x.referencia}</td>
         {tiposProduto(idTipo!)&&<td className="p-2">{x.pessoa}</td>}
         {tiposProduto(idTipo!)&&<td className="p-2 text-right">{x.quantidade.toLocaleString('pt-BR',{maximumFractionDigits:3})} {x.unidade}</td>}
         {tiposFinanceiros(idTipo!)&&<td className="p-2 text-right">{dinheiro(x.original)}</td>}
         {tiposFinanceiros(idTipo!)&&<td className="p-2 text-right">{dinheiro(x.pago)}</td>}
         <td className="p-2 text-right font-bold">{dinheiro(tiposFinanceiros(idTipo!)?x.saldo:x.valor)}</td>
        </tr>)}</tbody>
       </table>
      </div>}
     </div>)}
     {!grupos.length&&<div className="p-8 text-center text-sm text-slate-500">Nenhum lançamento encontrado com esses filtros.</div>}
     <div className="flex items-center justify-between bg-emerald-50 px-4 py-4 text-sm font-black text-emerald-900">
      <span>TOTAL DO RELATÓRIO</span><span>{dinheiro(total)}</span>
     </div>
    </div>
    <p className="text-xs text-slate-500">O PDF inclui todos os grupos e todos os lançamentos filtrados, mesmo que os detalhes estejam fechados na tela.</p>
   </section>
  </>}
  <p className="text-xs text-slate-500">Outras análises detalhadas continuam disponíveis na <Link href="/relatorios" className="font-bold text-blue-700 underline">Central de Relatórios</Link>. Relatórios de produtos são acompanhados das imagens cadastradas quando disponíveis.</p>
 </main>
}
