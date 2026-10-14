'use client'

import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,Download,Printer,Search} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {baixarCsv} from '@/lib/relatorios'
import type {LinhaFornecedor,ReferenciaPeriodo,ResultadoFornecedores,ResumoFornecedor} from '@/lib/relatorioFornecedores'

type Dados=ResultadoFornecedores&{ok:boolean}
const moeda=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const numero=(n:number,casas=3)=>n.toLocaleString('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas})
const sinal=(n:number,casas=2)=>(n>0?'+':'')+n.toLocaleString('pt-BR',{minimumFractionDigits:casas,maximumFractionDigits:casas})
const dataBr=(s:string)=>s?s.split('-').reverse().join('/'):'—'
const datas=(lista:string[])=>lista.length?lista.map(dataBr).join(', '):'—'
const mesAtual=()=>{const hoje=new Date();return {inicio:`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`,fim:`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`}}
const preferencias='atlas-relatorio-fornecedores-limites-v1'
function status(percentual:number|null,situacao:string,atencao:number,critico:number){
 if(situacao==='aguardando_recebimento')return {texto:'Aguardando recebimento',classe:'bg-slate-100 text-slate-700'}
 if(situacao==='sem_compra')return {texto:'Sem compra vinculada',classe:'bg-slate-100 text-slate-700'}
 if(percentual===null)return {texto:'Sem conferência',classe:'bg-slate-100 text-slate-700'}
 if(Math.abs(percentual)>critico)return {texto:'Fora da tolerância',classe:'bg-red-100 text-red-800'}
 if(Math.abs(percentual)>atencao)return {texto:'Atenção',classe:'bg-amber-100 text-amber-800'}
 return {texto:'Dentro da tolerância',classe:'bg-emerald-100 text-emerald-800'}
}
function Badge({percentual,situacao,atencao,critico}:{percentual:number|null;situacao:string;atencao:number;critico:number}){
 const resultado=status(percentual,situacao,atencao,critico)
 return <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold ${resultado.classe}`}>{resultado.texto}</span>
}
function Card({nome,valor,obs}:{nome:string;valor:string;obs?:string}){
 return <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">{nome}</p><p className="mt-1 text-xl font-bold text-slate-900">{valor}</p>{obs&&<p className="mt-1 text-xs text-slate-500">{obs}</p>}</div>
}
export default function AnaliseFornecedores(){
 const hoje=useMemo(mesAtual,[])
 const [inicio,setInicio]=useState(hoje.inicio)
 const [fim,setFim]=useState(hoje.fim)
 const [referencia,setReferencia]=useState<ReferenciaPeriodo>('compra')
 const [busca,setBusca]=useState('')
 const [fornecedor,setFornecedor]=useState('')
 const [obraFiltrada,setObraFiltrada]=useState('')
 const [atencao,setAtencao]=useState(7)
 const [critico,setCritico]=useState(10)
 const [dados,setDados]=useState<Dados|null>(null)
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 useEffect(()=>{setObraFiltrada(new URLSearchParams(window.location.search).get('obra')||'')},[])
 useEffect(()=>{try{
  const limites=JSON.parse(localStorage.getItem(preferencias)||'{}')
  if(typeof limites.atencao==='number'&&limites.atencao>=0&&limites.atencao<=100)setAtencao(limites.atencao)
  if(typeof limites.critico==='number'&&limites.critico>=0&&limites.critico<=100)setCritico(limites.critico)
 }catch{}},[])
 async function carregar(){
  if(!inicio||!fim||inicio>fim){setErro('Confira as datas do período.');return}
  setErro('');setCarregando(true)
  try{
   const token=await tokenAtual();if(!token)throw new Error('Entre novamente no Atlas.')
   const params=new URLSearchParams({inicio,fim,referencia})
   const resp=await fetch(`/api/relatorios/fornecedores?${params}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
   const json=await resp.json()
   if(!resp.ok)throw new Error(json.error||'Falha ao carregar relatório.')
   setDados(json as Dados)
  }catch(e){setErro(e instanceof Error?e.message:'Erro no relatório.');setDados(null)}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[])
 function salvarLimites(a:number,c:number){
  if(!Number.isFinite(a)||!Number.isFinite(c)||a<0||c<=a||c>100)return
  setAtencao(a);setCritico(c)
  try{localStorage.setItem(preferencias,JSON.stringify({atencao:a,critico:c}))}catch{}
 }
 const linhas=useMemo(()=>dados?.linhas.filter(l=>(!fornecedor||l.fornecedorChave===fornecedor)&&(!obraFiltrada||l.vendaId===obraFiltrada)&&
  [l.fornecedor,l.cliente,String(l.numero||''),...l.documentos].join(' ').toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')))||[],[dados,fornecedor,busca,obraFiltrada])
 const resumos=useMemo(()=>dados?.fornecedores.flatMap(f=>{
  const escolhidas=linhas.filter(l=>l.fornecedorChave===f.fornecedorChave)
  if(!escolhidas.length)return []
  const validas=escolhidas.filter(l=>l.situacao==='conferido')
  const pesoComprado=validas.reduce((s,l)=>s+l.pesoComprado,0)
  const pesoRecebido=validas.reduce((s,l)=>s+l.pesoRecebido,0)
  const valorComprado=validas.reduce((s,l)=>s+l.valorComprado,0)
  const valorRecebido=validas.reduce((s,l)=>s+l.valorRecebido,0)
  return [{...f,obras:escolhidas.length,conferidas:validas.length,pendentes:escolhidas.length-validas.length,
   pesoComprado,pesoRecebido,valorComprado,valorRecebido,
   pesoDiferenca:validas.length?pesoRecebido-pesoComprado:null,
   percentual:validas.length&&pesoComprado?(pesoRecebido-pesoComprado)/pesoComprado*100:null,
   valorDiferenca:validas.length?valorRecebido-valorComprado:null}]
 })||[],[dados,linhas])
 const total=useMemo(()=>{
  const conferidas=linhas.filter(l=>l.situacao==='conferido')
  const comprado=conferidas.reduce((s,l)=>s+l.pesoComprado,0)
  const recebido=conferidas.reduce((s,l)=>s+l.pesoRecebido,0)
  const difValor=conferidas.reduce((s,l)=>s+(l.valorDiferenca||0),0)
  return {conferidas:conferidas.length,pendentes:linhas.length-conferidas.length,percentual:comprado?(recebido-comprado)/comprado*100:null,difValor}
 },[linhas])
 function exportar(){
  baixarCsv('atlas-analise-fornecedores-perfis.csv',[
   ['Fornecedor','Cliente / obra','Nº venda','Data(s) compra','Data(s) recebimento','Nota / Romaneio','Peso comprado (kg)','Peso recebido (kg)','Diferença (kg)','Diferença (%)','Valor comprado (R$)','Valor recebido (R$)','Diferença valor (R$)','Situação'],
   ...linhas.map(l=>[l.fornecedor,l.cliente,l.numero||'',datas(l.datasCompra),datas(l.datasRecebimento),l.documentos.join(' / '),l.pesoComprado,l.pesoRecebido,l.pesoDiferenca??'',l.percentual??'',l.valorComprado,l.valorRecebido,l.valorDiferenca??'',status(l.percentual,l.situacao,atencao,critico).texto])
  ])
 }
 return <div className="min-h-screen bg-slate-50"><style>{`@media print {.atlas-sidebar-shell,.atlas-sidebar-nav,.atlas-topbar,.atlas-mobile-navigation,.print-hide{display:none!important}.atlas-app-content{height:auto!important;overflow:visible!important}.atlas-app-main{padding:0!important;min-height:auto!important}body{background:white!important}}`}</style>
  <main className="mx-auto max-w-7xl space-y-5 px-3 py-6 md:px-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div><Link href="/relatorios" className="print-hide mb-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><ArrowLeft size={15}/> Central de Relatórios</Link><h1 className="text-2xl font-bold text-slate-900">Análise de Fornecedores · Perfis</h1><p className="mt-1 text-sm text-slate-600">Peso comprado × recebido, variação em quilos, porcentagem e valor, por fornecedor e obra.</p></div><div className="print-hide flex gap-2"><button type="button" onClick={exportar} disabled={!linhas.length} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"><Download size={15}/> CSV / Excel</button><button type="button" onClick={()=>window.print()} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Printer size={15}/> Imprimir / PDF</button></div></div>
   <section className="print-hide space-y-3 rounded-xl border bg-white p-4"><div className="flex flex-wrap items-end gap-3">
    <label className="text-xs font-semibold text-slate-600">Período por<select value={referencia} onChange={e=>setReferencia(e.target.value as ReferenciaPeriodo)} className="mt-1 block rounded-lg border px-2 py-2 text-sm"><option value="compra">Data da compra</option><option value="recebimento">Data do recebimento</option><option value="movimento">Compra ou recebimento</option></select></label>
    <label className="text-xs font-semibold text-slate-600">De<input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="mt-1 block rounded-lg border px-2 py-2 text-sm"/></label>
    <label className="text-xs font-semibold text-slate-600">Até<input type="date" value={fim} onChange={e=>setFim(e.target.value)} className="mt-1 block rounded-lg border px-2 py-2 text-sm"/></label>
    <button type="button" onClick={()=>void carregar()} disabled={carregando} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{carregando?'Consultando...':'Aplicar período'}</button>
   </div><div className="flex flex-wrap items-end gap-3">
    <label className="text-xs font-semibold text-slate-600">Fornecedor<select value={fornecedor} onChange={e=>setFornecedor(e.target.value)} className="mt-1 block max-w-[270px] rounded-lg border px-2 py-2 text-sm"><option value="">Todos os fornecedores</option>{dados?.fornecedores.map(f=><option key={f.fornecedorChave} value={f.fornecedorChave}>{f.fornecedor}</option>)}</select></label>
    <label className="relative text-xs font-semibold text-slate-600">Cliente, venda ou nota<span className="relative mt-1 block"><Search size={15} className="absolute left-2 top-3 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar obra ou documento" className="rounded-lg border py-2 pl-8 pr-2 text-sm"/></span></label>
    <label className="text-xs font-semibold text-slate-600">Atenção acima de (%)<input type="number" min="0" max="99" step="0.1" value={atencao} onChange={e=>salvarLimites(Number(e.target.value),critico)} className="mt-1 block w-28 rounded-lg border px-2 py-2 text-sm"/></label>
    <label className="text-xs font-semibold text-slate-600">Fora da tolerância acima de (%)<input type="number" min="0.1" max="100" step="0.1" value={critico} onChange={e=>salvarLimites(atencao,Number(e.target.value))} className="mt-1 block w-28 rounded-lg border px-2 py-2 text-sm"/></label>
   </div><p className="text-xs text-slate-500">Limites salvos neste navegador. Alertas valem para diferenças tanto a mais quanto a menos. Se a compra e o recebimento ocorrerem em meses diferentes, ambos são comparados na mesma obra.</p></section>
   {obraFiltrada&&<p className="print-hide rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">Exibindo somente a obra selecionada. <button type="button" onClick={()=>{setObraFiltrada('');window.history.replaceState(null,'','/relatorios/fornecedores')}} className="underline">Ver todas as obras</button></p>}
   <p className="text-xs text-slate-600">Período: {dataBr(inicio)} a {dataBr(fim)} · referência: {referencia==='compra'?'compra':referencia==='recebimento'?'recebimento':'compra ou recebimento'}. Peso e valores conferidos por fornecedor + obra.</p>
   {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Card nome="Fornecedores no filtro" valor={String(resumos.length)}/><Card nome="Obras conferidas" valor={String(total.conferidas)} obs={`${total.pendentes} sem comparação completa`}/><Card nome="Variação ponderada de peso" valor={total.percentual===null?'—':sinal(total.percentual)+'%'} obs="Sobre a soma dos quilos comprados nas obras conferidas"/><Card nome="Diferença em valor" valor={moeda(total.difValor)} obs="Recebido menos comprado, nas obras conferidas"/></div>
   <section className="space-y-2"><h2 className="text-lg font-bold">Ranking geral por fornecedor</h2><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[800px] text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="p-3">Fornecedor</th><th className="p-3 text-right">Obras conferidas</th><th className="p-3 text-right">Peso comprado</th><th className="p-3 text-right">Peso recebido</th><th className="p-3 text-right">Diferença %</th><th className="p-3 text-right">Diferença R$</th><th className="p-3">Alerta</th></tr></thead><tbody>{resumos.map((f:ResumoFornecedor)=><tr key={f.fornecedorChave} className="border-t"><td className="p-3"><button type="button" onClick={()=>setFornecedor(fornecedor===f.fornecedorChave?'':f.fornecedorChave)} className="font-semibold text-blue-700 underline print:text-slate-900">{f.fornecedor}</button>{f.pendentes>0&&<p className="text-xs text-slate-500">{f.pendentes} obra(s) pendente(s)</p>}</td><td className="p-3 text-right">{f.conferidas}</td><td className="p-3 text-right">{numero(f.pesoComprado)} kg</td><td className="p-3 text-right">{numero(f.pesoRecebido)} kg</td><td className="p-3 text-right font-bold">{f.percentual===null?'—':sinal(f.percentual)+'%'}</td><td className="p-3 text-right">{f.valorDiferenca===null?'—':moeda(f.valorDiferenca)}</td><td className="p-3"><Badge percentual={f.percentual} situacao={f.conferidas?'conferido':'aguardando_recebimento'} atencao={atencao} critico={critico}/></td></tr>)}{!resumos.length&&<tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhum lançamento de perfil em KG para o período.</td></tr>}</tbody></table></div></section>
   <section className="space-y-2"><h2 className="text-lg font-bold">Detalhamento por obra</h2><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1250px] text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="p-3">Fornecedor / cliente</th><th className="p-3">Compra</th><th className="p-3">Recebimento</th><th className="p-3 text-right">Comprado</th><th className="p-3 text-right">Recebido</th><th className="p-3 text-right">Dif. kg</th><th className="p-3 text-right">Dif. %</th><th className="p-3 text-right">Dif. R$</th><th className="p-3">Situação</th></tr></thead><tbody>{linhas.map((l:LinhaFornecedor)=><tr key={l.id} className="border-t"><td className="p-3"><b>{l.fornecedor}</b><p className="mt-1">{l.cliente} · Venda {l.numero||'—'}</p>{l.clienteId&&<Link className="print-hide text-xs font-semibold text-blue-700 underline" href={`/clientes/${l.clienteId}/vendas/${l.vendaId}`}>Abrir CMV da obra</Link>}</td><td className="p-3"><span>{datas(l.datasCompra)}</span><p className="text-xs text-slate-500">{moeda(l.valorComprado)}</p></td><td className="p-3"><span>{datas(l.datasRecebimento)}</span><p className="text-xs text-slate-500">{moeda(l.valorRecebido)}</p>{l.documentos.length>0&&<p className="text-xs text-slate-500">Doc. {l.documentos.join(', ')}</p>}</td><td className="p-3 text-right">{numero(l.pesoComprado)} kg</td><td className="p-3 text-right">{numero(l.pesoRecebido)} kg</td><td className="p-3 text-right">{l.pesoDiferenca===null?'—':sinal(l.pesoDiferenca,3)+' kg'}</td><td className="p-3 text-right font-semibold">{l.percentual===null?'—':sinal(l.percentual)+'%'}</td><td className="p-3 text-right">{l.valorDiferenca===null?'—':moeda(l.valorDiferenca)}</td><td className="p-3"><Badge percentual={l.percentual} situacao={l.situacao} atencao={atencao} critico={critico}/></td></tr>)}{!linhas.length&&<tr><td colSpan={9} className="p-6 text-center text-slate-500">Nenhuma obra encontrada nos filtros.</td></tr>}</tbody></table></div></section>
   <p className="text-xs text-slate-600">Conciliação por fornecedor e obra, agregando notas e lançamentos: não é conferência individual por pedido/romaneio. Compras sem recebimento ou recebimentos sem compra ficam pendentes, sem percentual inventado. As divergências de valor são a diferença entre os valores registrados; se o preço por quilo mudou, nem toda diferença decorre do peso. Entregas parciais podem causar divergência provisória, mesmo com os dois lados registrados.</p>
  </main></div>
}
