'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Building2, ChevronDown, ChevronRight, ClipboardList, Download, FileText, Factory, Landmark, PackageSearch, Printer, Ruler, Search, ShoppingCart, WalletCards, Wrench } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import FinanceiroRelatorio, { FinanceiroRelatorioDados } from '@/components/relatorios/FinanceiroRelatorio'
import PlanoContasGerencial from '@/components/relatorios/PlanoContasGerencial'
import { baixarCsv, carregarResumoComercial, carregarResumoMedicao, ResumoComercial, ResumoMedicao } from '@/lib/relatorios'
import { formatarMoeda, formatarNumero, formatarPercentual } from '@/lib/formatacao'

type Setor = 'obras'|'comercial'|'financeiro'|'producao'|'compras'|'engenharia'|'assistencia'
type Obra = {
  id:string;clienteId:string;cliente:string;cidade:string;numero:number|null;orcamento:string|number;status:string;data:string
  venda:number;previsto:number|null;realizado:number;compras:number;lancamentos:number;parcial:boolean;diferenca:number|null
  pendencias:number;compartilhada:boolean;fontePrevisto:string
  categorias:{previsto:Record<string,number|null>;realizado:Record<string,number>}
}
type RelatorioObras = {
  obras:Obra[];total:{quantidade:number;venda:number;previsto:number;previstoDisponivel:number;realizado:number;compras:number;lancamentos:number;concluidas:number};avisos:string[]
}
const setores: {id:Setor;nome:string;descricao:string;Icon:typeof BarChart3}[]=[
  {id:'obras',nome:'Obras / CMV',descricao:'Previsto × realizado por obra',Icon:Building2},
  {id:'comercial',nome:'Comercial',descricao:'Orçamentos e vendas',Icon:ClipboardList},
  {id:'financeiro',nome:'Financeiro',descricao:'Contas e recebimentos',Icon:WalletCards},
  {id:'producao',nome:'Produção',descricao:'Medição e execução',Icon:Factory},
  {id:'compras',nome:'Compras / Estoque',descricao:'Pedidos e materiais',Icon:ShoppingCart},
  {id:'engenharia',nome:'Engenharia',descricao:'Planos e materiais',Icon:Landmark},
  {id:'assistencia',nome:'Assistência',descricao:'Atendimentos e manutenção',Icon:Wrench},
]
const vazioComercial:ResumoComercial={totalOrcamentos:0,valorOrcado:0,aprovados:0,recusados:0,vendidos:0,taxaConversao:0,ticketMedio:0}
const vazioMedicao:ResumoMedicao={totalMedicoes:0,medicoesComItens:0,itensTotal:0,itensMedidos:0,percentualItensMedidos:0}
const moeda=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const rotulo=(v:string)=>({ativa:'Em andamento',cancelada:'Cancelada',concluida:'Concluída'} as Record<string,string>)[v]||v
const dataBR=(v:string)=>v?new Date(v).toLocaleDateString('pt-BR'):'—'
function iniciarMes(){
 const d=new Date()
 return {inicio:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,fim:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(new Date(d.getFullYear(),d.getMonth()+1,0).getDate()).padStart(2,'0')}`}
}
function Kpi({nome,valor,observacao}:{nome:string;valor:string;observacao?:string}){
 return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">{nome}</p><b className="mt-1 block text-xl text-slate-900">{valor}</b>{observacao&&<p className="mt-1 text-xs text-slate-500">{observacao}</p>}</div>
}
function LinhaGrafico({rotulo,previsto,realizado,escala}:{rotulo:string;previsto:number;realizado:number;escala:number}){
 return <div className="space-y-1.5 border-b border-slate-100 pb-3 last:border-0"><b className="text-xs text-slate-700">{rotulo}</b><div className="grid grid-cols-[65px_1fr_auto] items-center gap-2 text-xs"><span className="text-slate-500">Previsto</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${Math.max(0,100*previsto/escala)}%`}}/></div><span className="tabular-nums text-slate-600">{moeda(previsto)}</span><span className="text-slate-500">Realizado</span><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{width:`${Math.max(0,100*realizado/escala)}%`}}/></div><span className="tabular-nums text-slate-600">{moeda(realizado)}</span></div></div>
}
export default function RelatoriosPage(){
 const [setor,setSetor]=useState<Setor>('obras')
 const [periodo,setPeriodo]=useState(iniciarMes)
 const [inicio,setInicio]=useState(periodo.inicio)
 const [fim,setFim]=useState(periodo.fim)
 const [busca,setBusca]=useState('')
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 const [dados,setDados]=useState<RelatorioObras|null>(null)
 const [comercial,setComercial]=useState<ResumoComercial>(vazioComercial)
 const [medicao,setMedicao]=useState<ResumoMedicao>(vazioMedicao)
 const [financeiro,setFinanceiro]=useState<FinanceiroRelatorioDados|null>(null)
 const [aberto,setAberto]=useState<string|null>(null)
 async function carregar(s:Setor=setor){
  if(inicio>fim){setErro('Confira as datas do período.');return}
  setErro('');setCarregando(true)
  try{
   if(s==='obras'){
    const token=await tokenAtual();if(!token)throw new Error('Entre novamente no Atlas.')
    const resp=await fetch(`/api/relatorios/obras-cmv?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
    const json=await resp.json()
    if(!resp.ok)throw new Error(json.error||'Não foi possível carregar as obras.')
    setDados(json as RelatorioObras)
   }
   if(s==='financeiro'){
    const token=await tokenAtual();if(!token)throw new Error('Entre novamente no Atlas.')
    const resp=await fetch(`/api/relatorios/financeiro?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
    const json=await resp.json()
    if(!resp.ok)throw new Error(json.error||'Não foi possível carregar os relatórios financeiros.')
    setFinanceiro(json as FinanceiroRelatorioDados)
   }
   if(s==='comercial')setComercial(await carregarResumoComercial({inicio,fim}))
   if(s==='producao')setMedicao(await carregarResumoMedicao({inicio,fim}))
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar relatório.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar('obras')},[])
 function selecionar(s:Setor){setSetor(s);setBusca('');if(s==='comercial'||s==='producao'||s==='financeiro'||(s==='obras'&&!dados))void carregar(s)}
 const obras=(dados?.obras||[]).filter(o=>[o.cliente,o.cidade,String(o.orcamento),String(o.numero)].join(' ').toLowerCase().includes(busca.toLowerCase()))
 const escala=Math.max(1,...obras.slice(0,8).flatMap(x=>[x.previsto||0,x.realizado]))
 function exportar(){
  if(setor==='obras'){
   if(!dados)return
   baixarCsv('atlas-relatorio-obras-cmv.csv',[
    ['Data confirmação','Venda / Obra','Cliente','Cidade','Orçamento WVetro','Status','Valor venda','Custo previsto WVetro','Compra registrada','Lançamentos manuais','Custo realizado registrado','Diferença parcial','CMV registrado %','Parcial'],
    ...obras.map(o=>[dataBR(o.data),o.numero||'',o.cliente,o.cidade,o.orcamento,rotulo(o.status),o.venda,o.previsto??'',o.compras,o.lancamentos,o.realizado,o.diferenca??'',o.venda?Math.round(o.realizado/o.venda*10000)/100:0,o.parcial?'Sim':'Não'])
   ])
  }else if(setor==='financeiro'&&financeiro){
   baixarCsv('atlas-relatorio-financeiro-gerencial.csv',[
    ['Relatório','Indicador','Valor','Observação'],
    ['DRE prévia','Receita contratada de obras',financeiro.dre.receitaObras,'Não é receita fiscal por competência'],
    ['DRE prévia','Vendas de balcão finalizadas',financeiro.dre.receitaBalcao,''],
    ['DRE prévia','Receita comercial total',financeiro.dre.receitaTotal,''],
    ['DRE prévia','CMV previsto',financeiro.dre.cmvPrevisto,'WVetro e custo de balcão'],
    ['DRE prévia','Margem bruta projetada',financeiro.dre.margemBrutaProjetada??'Não apurado','CMV incompleto impede fechamento'],
    ['DRE prévia','Lucro líquido','Não apurado','Exige tributos, despesas e apropriação contábil'],
    ['Movimentos registrados','Entradas recebidas',financeiro.caixa.recebido,'Por data de recebimento'],
    ['Movimentos registrados','Pagamentos realizados',financeiro.caixa.pago,'Por data de pagamento'],
    ['Movimentos registrados','Diferença parcial',financeiro.caixa.saldoParcial,'Não é saldo bancário'],
    ['Títulos','Saldo a receber',financeiro.contas.aReceber,'Por vencimento'],
    ['Títulos','Saldo a pagar',financeiro.contas.aPagar,'Por vencimento'],
    ...financeiro.caixa.meses.map(m=>['Movimentos mensais',m.mes+' - entradas',m.recebido,'']),
    ...financeiro.caixa.meses.map(m=>['Movimentos mensais',m.mes+' - saídas',m.pago,'']),
   ])
  }else if(setor==='comercial'){
   baixarCsv('atlas-relatorio-comercial.csv',[
    ['Indicador','Valor'],['Orçamentos',comercial.totalOrcamentos],['Valor orçado',comercial.valorOrcado],['Vendidos',comercial.vendidos],['Aprovados',comercial.aprovados],['Recusados',comercial.recusados],['Conversão (%)',comercial.taxaConversao],['Ticket médio',comercial.ticketMedio]
   ])
  }else if(setor==='producao'){
   baixarCsv('atlas-relatorio-medicao.csv',[
    ['Indicador','Valor'],['Medições',medicao.totalMedicoes],['Medições com itens',medicao.medicoesComItens],['Itens para medir',medicao.itensTotal],['Itens medidos',medicao.itensMedidos],['Conclusão (%)',medicao.percentualItensMedidos]
   ])
  }
 }
 return <div className="min-h-screen bg-slate-50"><style>{`@media print { .atlas-sidebar-shell, .atlas-sidebar-nav, .atlas-topbar, .atlas-mobile-navigation, .atlas-app-content header {display:none!important} .atlas-app-content{height:auto!important;overflow:visible!important} .atlas-app-main{padding:0!important;min-height:auto!important} body{background:white!important} }`}</style><main className="mx-auto max-w-7xl space-y-5 px-3 py-6 md:px-6">
   <div><p className="text-xs font-bold uppercase tracking-wider text-blue-600">Gestão · Atlas One</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Central de Relatórios</h1><p className="mt-1 text-sm text-slate-500">Um único lugar para consultar os relatórios por setor. Novos relatórios serão incorporados aqui.</p></div>
   <Link href="/relatorios/fornecedores" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-blue-400"><div><b className="text-sm text-slate-900">Análise de Fornecedores · Perfis</b><p className="mt-1 text-xs text-slate-600">Comprado × recebido em kg, datas, diferenças, alertas e ranking por fornecedor</p></div><span className="text-xs font-bold text-blue-700">Abrir relatório →</span></Link>
   <Link href="/relatorios/esquadrifacio" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 transition hover:border-blue-500 print:hidden">
    <div><b className="text-sm text-slate-900">Esquadrifácio · Relatórios gerenciais individuais</b><p className="mt-1 text-xs text-slate-600">31 visões: DRE, fluxo de caixa, vendas, metas, Curva ABC, clientes, produtos, cidades, compras e margem · acesso Master</p></div>
    <span className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">Abrir todos os relatórios →</span>
   </Link>
   <p className="text-xs text-slate-500">Os futuros fechamentos mensais serão compilados dos relatórios individuais após homologação. O arquivo histórico aprovado permanece preservado.</p>
   <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7 print:hidden">
    {setores.map(({id,nome,descricao,Icon})=><button key={id} type="button" aria-pressed={setor===id} onClick={()=>selecionar(id)} className={`min-w-0 rounded-xl border p-3 text-left transition ${setor===id?'border-blue-600 bg-blue-50 shadow-sm':'border-slate-200 bg-white hover:border-blue-300'}`}><Icon size={19} className={setor===id?'text-blue-700':'text-slate-500'}/><b className="mt-2 block text-xs text-slate-900">{nome}</b><span className="mt-0.5 block text-[11px] text-slate-500">{descricao}</span></button>)}
   </div>
   <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 print:hidden"><label className="font-semibold" htmlFor="tipo-relatorio">Tipo de relatório</label><select id="tipo-relatorio" value={setor} onChange={e=>selecionar(e.target.value as Setor)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="obras">Obras — Previsto × realizado / CMV</option><option value="comercial">Comercial — Resumo de orçamentos e vendas</option><option value="financeiro">Financeiro — DRE prévia, fluxo e títulos</option><option value="producao">Produção — Resumo de Medição Final</option><option value="compras">Compras — Consultas do setor</option><option value="engenharia">Engenharia — Consultas do setor</option><option value="assistencia">Assistência — Consultas do setor</option></select></div>
   <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 print:border-0 print:p-0">
    <div className="flex flex-wrap items-end gap-3 print:hidden">
     <label className="text-xs font-semibold text-slate-600">De<input type="date" value={inicio} onChange={e=>setInicio(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label>
     <label className="text-xs font-semibold text-slate-600">Até<input type="date" value={fim} onChange={e=>setFim(e.target.value)} className="mt-1 block rounded-lg border p-2 text-sm"/></label>
     <button onClick={()=>void carregar()} disabled={carregando} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{carregando?'Carregando...':'Aplicar período'}</button>
    </div>
    <div className="flex gap-2 print:hidden">{['obras','comercial','producao','financeiro'].includes(setor)&&<button disabled={carregando||setor==='obras'&&!dados} onClick={exportar} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><Download size={15}/> CSV / Excel</button>}<button onClick={()=>window.print()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold"><Printer size={15}/> Imprimir / PDF</button></div>
    <p className="hidden text-sm text-slate-600 print:block">Período: {inicio} a {fim} · Data de confirmação da venda (Obras)</p>
   </div>
   {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
   {setor==='obras'&&<section className="space-y-5">
     <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-lg font-bold">Relatório de Obras / CMV</h2><p className="text-xs text-slate-500">Período pela confirmação da venda. Custos realizados acumulados até a consulta, mesmo quando registrados depois do período.</p></div><label className="relative print:hidden"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Filtrar cliente ou obra" className="rounded-lg border py-2 pl-9 pr-3 text-sm"/></label></div>
     {dados&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi nome="Obras / vendas" valor={formatarNumero(dados.total.quantidade)} observacao={`${dados.total.concluidas} concluídas`}/><Kpi nome="Valor vendido" valor={moeda(dados.total.venda)}/><Kpi nome="Custo previsto" valor={moeda(dados.total.previsto)} observacao={`${dados.total.previstoDisponivel} de ${dados.total.quantidade} com previsão disponível`}/><Kpi nome="CMV registrado" valor={moeda(dados.total.realizado)} observacao="Valor parcial enquanto houver compras pendentes"/></div>
     <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-white p-4"><h3 className="mb-3 font-bold">Previsto × realizado por obra</h3>{obras.some(o=>o.previsto!==null)?obras.filter(o=>o.previsto!==null).slice(0,8).map(o=><LinhaGrafico key={o.id} rotulo={o.cliente} previsto={o.previsto||0} realizado={o.realizado} escala={escala}/>):<p className="text-sm text-slate-500">Nenhuma obra no período.</p>}<p className="mt-3 text-xs text-slate-500">Exibe até 8 obras filtradas. Azul: previsto; laranja: realizado registrado.</p></section>
      <section className="space-y-3 rounded-xl border bg-white p-4"><h3 className="font-bold">Composição do realizado</h3><div className="grid grid-cols-2 gap-3"><Kpi nome="Compras vinculadas" valor={moeda(dados.total.compras)}/><Kpi nome="Lançamentos manuais" valor={moeda(dados.total.lancamentos)}/></div><p className="text-xs text-slate-500">CMV = compras efetivadas com valor + despesas/consumo registrados no módulo Custos/CMV. Não representa lucro final antes da conclusão e conferência de todos os custos.</p>{dados.avisos.map(a=><p key={a} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">{a}</p>)}</section>
     </div>
     <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Cliente / obra</th><th className="p-3 text-right">Venda</th><th className="p-3 text-right">Previsto</th><th className="p-3 text-right">Realizado</th><th className="p-3 text-right">Diferença parcial</th><th className="p-3 text-right">CMV %</th><th className="p-3">Situação</th></tr></thead><tbody>{obras.map(o=><Fragment key={o.id}>{/* Cada expansão fica vinculada ao ID da venda */}<tr className="border-t"><td className="p-3"><button onClick={()=>setAberto(aberto===o.id?null:o.id)} className="flex items-center gap-1 font-semibold text-blue-700 print:text-slate-900">{aberto===o.id?<ChevronDown size={14}/>:<ChevronRight size={14}/>} {o.cliente}</button><p className="pl-5 text-xs text-slate-500">Venda {o.numero||'—'} · WVetro #{o.orcamento} · {dataBR(o.data)}</p></td><td className="p-3 text-right">{moeda(o.venda)}</td><td className="p-3 text-right">{o.previsto==null?'Indisponível':moeda(o.previsto)}</td><td className="p-3 text-right">{moeda(o.realizado)}</td><td className={`p-3 text-right ${o.diferenca!==null&&o.diferenca<0?'text-red-600':''}`}>{o.diferenca==null?'—':moeda(o.diferenca)}</td><td className="p-3 text-right">{o.venda?formatarPercentual(o.realizado/o.venda*100,1):'—'}</td><td className="p-3 text-xs">{rotulo(o.status)}{o.parcial&&<span className="block text-amber-700">CMV parcial</span>}</td></tr>
       {aberto===o.id&&<tr key={o.id+'-detalhes'} className="bg-slate-50"><td colSpan={7} className="p-4"><p className="mb-2 font-semibold">Detalhamento da obra</p><div className="grid gap-2 sm:grid-cols-3"><Kpi nome="Compras" valor={moeda(o.compras)}/><Kpi nome="Outros lançamentos" valor={moeda(o.lancamentos)}/><Kpi nome="Diferença até agora" valor={o.diferenca===null?'—':moeda(o.diferenca)}/></div><p className="mt-2 text-xs text-slate-600">Custos previstos por categoria: perfis {moeda((o.categorias.previsto.perfil||0)+(o.categorias.previsto.sobra||0))}, acessórios {moeda(o.categorias.previsto.acessorio||0)}, vidros {moeda(o.categorias.previsto.vidro||0)}. Sobra de perfil: {o.categorias.previsto.sobra==null?'não informada':moeda(o.categorias.previsto.sobra)}.</p><Link className="mt-3 inline-block text-xs font-bold text-blue-700 underline print:hidden" href={`/clientes/${o.clienteId}/vendas/${o.id}`}>Abrir obra e comprovantes</Link></td></tr>}
      </Fragment>)}{!obras.length&&<tr><td colSpan={7} className="p-8 text-center text-slate-500">Nenhuma obra encontrada.</td></tr>}</tbody></table></div>
     <p className="text-xs text-slate-500">A diferença positiva não é economia confirmada: pode haver material ou serviço ainda não lançado. Custos previstos ausentes não são tratados como zero na linha individual.</p></>}
   </section>}
   {setor==='comercial'&&<section className="space-y-4"><h2 className="text-lg font-bold">Relatórios Comerciais</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi nome="Orçamentos" valor={formatarNumero(comercial.totalOrcamentos)}/><Kpi nome="Valor orçado" valor={formatarMoeda(comercial.valorOrcado)}/><Kpi nome="Vendidos" valor={formatarNumero(comercial.vendidos)}/><Kpi nome="Conversão" valor={formatarPercentual(comercial.taxaConversao,1)}/><Kpi nome="Aprovados" valor={formatarNumero(comercial.aprovados)}/><Kpi nome="Recusados" valor={formatarNumero(comercial.recusados)}/><Kpi nome="Ticket médio" valor={formatarMoeda(comercial.ticketMedio)}/></div><Modulo nome="Orçamentos e funil" texto="Consultar os orçamentos e o andamento comercial." href="/orcamento/pesquisar"/></section>}
   {setor==='producao'&&<section className="space-y-4"><h2 className="text-lg font-bold">Relatórios de Produção</h2><p className="text-xs text-slate-500">Resumo existente de Medição Final</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi nome="Medições" valor={formatarNumero(medicao.totalMedicoes)}/><Kpi nome="Medições com itens" valor={formatarNumero(medicao.medicoesComItens)}/><Kpi nome="Itens para medir" valor={formatarNumero(medicao.itensTotal)}/><Kpi nome="Itens medidos" valor={formatarNumero(medicao.itensMedidos)}/><Kpi nome="Conclusão de itens" valor={formatarPercentual(medicao.percentualItensMedidos,1)}/></div><Modulo nome="Quadro de Produção" texto="Acompanhar os cards, etapas e liberações." href="/producao"/></section>}
   {setor==='financeiro'&&<><FinanceiroRelatorio dados={financeiro} carregando={carregando}/><PlanoContasGerencial inicio={inicio} fim={fim} onClassificado={()=>void carregar("financeiro")}/><div className="grid gap-3 md:grid-cols-3 print:hidden"><Modulo nome="Contas a receber" texto="Acessar títulos e recebimentos detalhados" href="/financeiro/contas-receber"/><Modulo nome="Contas a pagar" texto="Acessar obrigações e pagamentos detalhados" href="/financeiro/contas-pagar"/><Modulo nome="Caixa" texto="Acessar os movimentos do balcão" href="/balcao/caixa"/></div></>}
   {setor==='compras'&&<Catalogo setor="Compras / Estoque" itens={[['Compras','Consultar os pedidos e materiais','/compras'],['Notas fiscais','Consultar os documentos de compra','/compras/notas'],['Estoque','Consultar o estoque disponível','/estoque']]}/>}
   {setor==='engenharia'&&<Catalogo setor="Engenharia" itens={[['Engenharia','Consultar receitas, materiais e plano de corte','/engenharia']]}/>}
   {setor==='assistencia'&&<Catalogo setor="Assistência" itens={[['Assistências','Consultar os atendimentos e manutenções','/assistencias']]}/>}
  </main></div>
}
function Modulo({nome,texto,href}:{nome:string;texto:string;href:string}){return <Link href={href} className="block rounded-xl border bg-white p-4 transition hover:border-blue-400"><b>{nome}</b><p className="mt-1 text-sm text-slate-500">{texto}</p><span className="mt-2 block text-xs font-bold text-blue-600">Abrir setor →</span></Link>}
function Catalogo({setor,itens}:{setor:string;itens:[string,string,string][]}){return <section className="space-y-4"><div><h2 className="text-lg font-bold">Relatórios de {setor}</h2><p className="text-sm text-slate-500">Acessos aos dados do setor. Os demonstrativos específicos serão adicionados nesta central conforme forem validados.</p></div><div className="grid gap-3 md:grid-cols-3">{itens.map(([nome,texto,href])=><Modulo key={href} nome={nome} texto={texto} href={href}/>)}</div></section>}
