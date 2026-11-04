'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, FileSpreadsheet, Printer, RefreshCw, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import { useRelatoriosAcesso, autorizarExportacaoRelatorio } from '@/components/relatorios/RelatoriosAcesso'
import { baixarCSV, csvFinanceiro, dinheiro, formatarData, periodoRapido } from '@/lib/financeiroPeriodo'
import { aberta, faixaVencimento, noPeriodo, type MovimentoFinanceiro, type RankingFinanceiro, type ResumoFinanceiro, type TipoConta, type TituloFinanceiro } from '@/lib/relatoriosContasFinanceiras'

type DadosTipo={
 titulos:TituloFinanceiro[];movimentos:MovimentoFinanceiro[];
 resumo:ResumoFinanceiro;ranking:RankingFinanceiro[];
 previsao:{mes:string;valor:number;titulos:number}[]
}
type Dados={
 periodo:{inicio:string;fim:string;hoje:string};
 permissoes:{pagar:boolean;receber:boolean};
 pagar:DadosTipo|null;receber:DadosTipo|null;avisos:string[]
}
type Filtro='periodo'|'abertas'|'vencidas'|'ate7'|'ate30'|'semData'|'parciais'|'quitados'
const filtros:{id:Filtro;titulo:string}[]=[
 {id:'periodo',titulo:'Vencimentos do período'},
 {id:'abertas',titulo:'Todas em aberto'},
 {id:'vencidas',titulo:'Vencidas'},
 {id:'ate7',titulo:'Vencendo em 7 dias'},
 {id:'ate30',titulo:'De 8 a 30 dias'},
 {id:'semData',titulo:'Sem vencimento'},
 {id:'parciais',titulo:'Pagas parcialmente'},
 {id:'quitados',titulo:'Quitadas'}
]
function kpi(titulo:string,valor:number,obs:string,alerta=false){
 return <div key={titulo} className={'rounded-xl border bg-white p-4 '+(alerta?'border-amber-200':'border-slate-200')}>
  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
  <b className={'mt-1 block text-xl tabular-nums '+(alerta?'text-amber-800':'text-slate-900')}>{dinheiro(valor)}</b>
  <p className="mt-1 text-xs text-slate-500">{obs}</p>
 </div>
}
function rotuloSituacao(t:TituloFinanceiro,hoje:string){
 if(t.status==='cancelado'||t.status==='estornado')return 'Cancelada'
 if(t.status==='pago'&&t.saldo>0.009)return 'Conferir valores'
 if(t.saldo<0.01)return 'Quitada'
 if(t.pago>0)return 'Parcial'
 const f=faixaVencimento(t,hoje)
 return f==='vencidas'?'Vencida':f==='semData'?'Sem vencimento':'Em aberto'
}
function inicioMes(){
 const d=new Date()
 return periodoRapido('mes',d)
}
export default function RelatoriosContasPage(){
 const acessos=useRelatoriosAcesso()
 const [datas,setDatas]=useState(inicioMes)
 const [aplicado,setAplicado]=useState(inicioMes)
 const [dados,setDados]=useState<Dados|null>(null)
 const [tipo,setTipo]=useState<TipoConta>('receber')
 const [filtro,setFiltro]=useState<Filtro>('periodo')
 const [busca,setBusca]=useState('')
 const [limite,setLimite]=useState(200)
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 const [atualizado,setAtualizado]=useState('')
 const carregar=useCallback(async(inicio:string,fim:string)=>{
  if(!acessos.financeiro.consultar)return
  setErro('');setCarregando(true)
  try{
   const token=await tokenAtual()
   if(!token)throw new Error('Sessão expirada. Faça login no Atlas One novamente.')
   const resp=await fetch('/api/relatorios/financeiro-contas?inicio='+encodeURIComponent(inicio)+'&fim='+encodeURIComponent(fim),{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   })
   const json=await resp.json()
   if(!resp.ok||!json.ok)throw new Error(json.error||'Falha ao consultar os relatórios.')
   const novo=json as Dados
   if(!novo.permissoes[tipo]){
    if(novo.permissoes.receber)setTipo('receber')
    else if(novo.permissoes.pagar)setTipo('pagar')
   }
   setDados(novo);setAplicado({inicio,fim,preset:'personalizado'})
   setFiltro('periodo');setLimite(200)
   setAtualizado(new Date().toLocaleString('pt-BR'))
  }catch(e){setDados(null);setErro(e instanceof Error?e.message:'Relatório indisponível.')}
  finally{setCarregando(false)}
 },[acessos.financeiro.consultar,tipo])
 useEffect(()=>{if(acessos.financeiro.consultar)void carregar(datas.inicio,datas.fim)},[acessos.financeiro.consultar])
 const atual=dados?.[tipo]||null
 const titulosFiltrados=useMemo(()=>{
  if(!atual||!dados)return []
  const texto=busca.trim().toLocaleLowerCase('pt-BR')
  return atual.titulos.filter(t=>{
   if(texto&&!([t.pessoa,t.documento,t.id,t.referencia,t.observacoes].join(' ').toLocaleLowerCase('pt-BR').includes(texto)))return false
   const f=faixaVencimento(t,dados.periodo.hoje)
   if(filtro==='periodo')return !['cancelado','estornado'].includes(t.status)&&noPeriodo(t.vencimento,aplicado.inicio,aplicado.fim)
   if(filtro==='abertas')return aberta(t)
   if(filtro==='vencidas'||filtro==='ate7'||filtro==='ate30'||filtro==='semData')return f===filtro
   if(filtro==='parciais')return aberta(t)&&t.pago>0
   return t.status!=='cancelado'&&t.status!=='estornado'&&t.saldo<0.01
  }).sort((a,b)=>(a.vencimento||'9999').localeCompare(b.vencimento||'9999')||a.pessoa.localeCompare(b.pessoa,'pt-BR'))
 },[atual,dados,busca,filtro,aplicado.inicio,aplicado.fim])
 const movimentosPeriodo=useMemo(()=>(
  (atual?.movimentos||[]).filter(m=>noPeriodo(m.data,aplicado.inicio,aplicado.fim))
    .sort((a,b)=>b.data.localeCompare(a.data)||a.pessoa.localeCompare(b.pessoa,'pt-BR'))
 ),[atual,aplicado.inicio,aplicado.fim])
 const valorTitulos=titulosFiltrados.reduce((s,t)=>s+t.saldo,0)
 function atualizarFiltro(id:Filtro){setFiltro(id);setLimite(200)}
 function usarPeriodo(p:'mes'|'proximo_mes'|'semana'){
  const d=periodoRapido(p)
  setDatas(d);void carregar(d.inicio,d.fim)
 }
 async function exportarTitulos(){
  try{
   await autorizarExportacaoRelatorio('financeiro')
   const linhas:(string|number|null)[][]=[
    ['Tipo','Pessoa','Documento','Parcela','Emissão','Vencimento','Valor do título','Pago','Desconto','Saldo atual','Status','Situação','Data de pagamento','Forma','Observações','ID'],
    ...titulosFiltrados.map(t=>[
     tipo==='pagar'?'Pagar':'Receber',t.pessoa,t.documento,t.parcela||'',t.emissao,t.vencimento,
     t.valor,t.pago,t.desconto,t.saldo,t.status,rotuloSituacao(t,dados!.periodo.hoje),t.dataPagamento,t.forma,t.observacoes,t.id
    ])
   ]
   baixarCSV('atlas-contas-'+tipo+'-'+filtro+'-'+aplicado.inicio+'.csv',csvFinanceiro(linhas))
  }catch(e){setErro(e instanceof Error?e.message:'Exportação não autorizada.')}
 }
 async function exportarMovimentos(){
  try{
   await autorizarExportacaoRelatorio('financeiro')
   const linhas:(string|number|null)[][]=[
    ['Tipo','Data do movimento','Cliente ou fornecedor','Valor','Forma','Referência','Identificador'],
    ...movimentosPeriodo.map(m=>[tipo==='pagar'?'Pagamento':'Recebimento',m.data,m.pessoa,m.valor,m.forma,m.referencia,m.id])
   ]
   baixarCSV('atlas-movimentos-'+tipo+'-'+aplicado.inicio+'-'+aplicado.fim+'.csv',csvFinanceiro(linhas))
  }catch(e){setErro(e instanceof Error?e.message:'Exportação não autorizada.')}
 }
 async function imprimir(){
  try{await autorizarExportacaoRelatorio('financeiro');window.print()}
  catch(e){setErro(e instanceof Error?e.message:'Impressão não autorizada.')}
 }
 if(!acessos.financeiro.consultar)return <div role="alert" className="p-6 text-sm text-red-700">Sem autorização para os relatórios financeiros.</div>
 return <main className="mx-auto max-w-7xl space-y-5 px-3 py-6 md:px-6">
  <style>{'@media print{.no-print,.atlas-sidebar-shell,.atlas-sidebar-nav,.atlas-topbar,.atlas-mobile-navigation{display:none!important}.atlas-app-content{overflow:visible!important;height:auto!important}main{padding:0!important}.relatorio-tabela{overflow:visible!important}body{background:white!important}}'}</style>
  <div className="no-print flex items-center justify-between gap-3"><Link href="/relatorios" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700"><ArrowLeft size={16}/>Central de Relatórios</Link><Link href={tipo==='pagar'?'/financeiro/contas-pagar':'/financeiro/contas-receber'} className="text-xs font-semibold text-slate-500 underline">Abrir lançamentos financeiros</Link></div>
  <div><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Atlas One · Financeiro</p><h1 className="mt-1 text-2xl font-black text-slate-900">Relatórios de Contas a Pagar e Receber</h1>
   <p className="mt-1 text-sm text-slate-600">Cobranças, obrigações, atrasos, vencimentos, baixas e previsões. Consulta sem alteração dos títulos.</p></div>
  <Link href="/relatorios/simples" className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900"><span>Quer um relatório mais limpo de um mês ou fornecedor, com PDF completo?</span><span className="font-bold text-blue-700">Abrir gerador de relatórios →</span></Link>
  <div className="no-print flex flex-wrap gap-2">
   {(['receber','pagar'] as const).filter(t=>!dados||dados.permissoes[t]).map(t=><button key={t} type="button" onClick={()=>{setTipo(t);setFiltro('periodo');setBusca('');setLimite(200)}} aria-pressed={tipo===t} className={'rounded-xl border px-5 py-3 text-sm font-bold '+(tipo===t?'border-blue-700 bg-blue-700 text-white':'border-slate-200 bg-white text-slate-800')}>Contas a {t==='pagar'?'Pagar':'Receber'}</button>)}
  </div>
  <section className="no-print flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
   <label className="text-xs font-bold text-slate-600">Início do período<input type="date" value={datas.inicio} onChange={e=>setDatas(v=>({...v,inicio:e.target.value}))} className="mt-1 block rounded-lg border p-2 text-sm"/></label>
   <label className="text-xs font-bold text-slate-600">Fim do período<input type="date" value={datas.fim} onChange={e=>setDatas(v=>({...v,fim:e.target.value}))} className="mt-1 block rounded-lg border p-2 text-sm"/></label>
   <button onClick={()=>void carregar(datas.inicio,datas.fim)} disabled={carregando} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><RefreshCw size={15}/>{carregando?'Carregando…':'Aplicar período'}</button>
   <button onClick={()=>usarPeriodo('mes')} disabled={carregando} className="rounded-lg border px-3 py-2 text-xs font-bold">Este mês</button>
   <button onClick={()=>usarPeriodo('proximo_mes')} disabled={carregando} className="rounded-lg border px-3 py-2 text-xs font-bold">Próximo mês</button>
   <button onClick={()=>usarPeriodo('semana')} disabled={carregando} className="rounded-lg border px-3 py-2 text-xs font-bold">Esta semana</button>
  </section>
  {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</div>}
  {!dados&&<div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">{carregando?'Consultando informações financeiras…':'Escolha o período para carregar o relatório.'}</div>}
  {dados&&atual&&<>
   <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Data-base dos saldos: {formatarData(dados.periodo.hoje)} · Movimentos/vencimentos: {formatarData(aplicado.inicio)} a {formatarData(aplicado.fim)}</span><span>Atualizado em {atualizado}</span></div>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {kpi('Saldo em aberto',atual.resumo.aberto,'Posição atual de todos os títulos')}
    {kpi('Vencidos',atual.resumo.vencidas,'Em aberto e com vencimento anterior a hoje',true)}
    {kpi('Vence nos próximos 7 dias',atual.resumo.ate7,'Inclui o vencimento de hoje')}
    {kpi('Sem vencimento',atual.resumo.semData,'Exigem revisão da data cadastral',atual.resumo.semData>0)}
    {kpi('Vence de 8 a 30 dias',atual.resumo.ate30,'Saldos em aberto')}
    {kpi('Previsão no período',atual.resumo.previstoPeriodo,'Somente vencimentos preenchidos')}
    {kpi(tipo==='pagar'?'Pago no período':'Recebido no período',atual.resumo.realizadoPeriodo,tipo==='pagar'?'Pelo registro da conta':'Livro de recebimentos')}
    <div className="rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase text-slate-500">Conferência</p><b className="mt-1 block text-xl">{atual.resumo.parciais} parcial(is)</b><p className="mt-1 text-xs text-slate-500">{atual.resumo.inconsistentes} título(s) quitados no status, mas com saldo calculado</p></div>
   </div>
   <section className="space-y-3 rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">Títulos e parcelas</h2><div className="no-print flex gap-2"><button onClick={()=>void exportarTitulos()} disabled={!acessos.financeiro.exportar} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><Download size={14}/>CSV / Excel</button><button onClick={()=>void imprimir()} disabled={!acessos.financeiro.exportar} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><Printer size={14}/>Imprimir / PDF</button></div></div>
    <div className="no-print flex flex-wrap items-center gap-2">
     <label className="relative"><Search size={15} className="absolute left-2.5 top-2.5 text-slate-400"/><input value={busca} onChange={e=>{setBusca(e.target.value);setLimite(200)}} placeholder="Cliente, fornecedor ou documento" className="w-64 max-w-full rounded-lg border py-2 pl-8 pr-3 text-xs"/></label>
     <select value={filtro} onChange={e=>atualizarFiltro(e.target.value as Filtro)} className="rounded-lg border bg-white px-3 py-2 text-xs">{filtros.map(f=><option key={f.id} value={f.id}>{f.titulo}</option>)}</select>
    </div>
    <p className="text-xs text-slate-500">{filtros.find(f=>f.id===filtro)?.titulo} · {titulosFiltrados.length} título(s) · saldo: <b>{dinheiro(valorTitulos)}</b>{filtro==='periodo'?' · seleção pelo vencimento, inclusive quitados':''}</p>
    <div className="relatorio-tabela overflow-x-auto">
     <table className="w-full min-w-[900px] text-sm">
      <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Cliente / fornecedor</th><th className="p-3">Documento / parcela</th><th className="p-3">Vencimento</th><th className="p-3 text-right">Título</th><th className="p-3 text-right">Pago</th><th className="p-3 text-right">Desconto</th><th className="p-3 text-right">Saldo</th><th className="p-3">Situação</th></tr></thead>
      <tbody>{titulosFiltrados.slice(0,limite).map(t=><tr key={t.id} className="border-t align-top"><td className="p-3 font-medium">{t.pessoa}</td><td className="p-3">{t.documento||'—'}{t.parcela&&<div className="text-xs text-slate-500">Parcela {t.parcela}{t.totalParcelas?'/'+t.totalParcelas:''}</div>}</td><td className="p-3">{formatarData(t.vencimento)}</td><td className="p-3 text-right tabular-nums">{dinheiro(t.valor)}</td><td className="p-3 text-right tabular-nums">{dinheiro(t.pago)}</td><td className="p-3 text-right tabular-nums">{t.desconto?dinheiro(t.desconto):'—'}</td><td className="p-3 text-right font-bold tabular-nums">{dinheiro(t.saldo)}</td><td className="p-3 text-xs">{rotuloSituacao(t,dados.periodo.hoje)}</td></tr>)}
       {!titulosFiltrados.length&&<tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhum título encontrado com estes filtros.</td></tr>}</tbody>
     </table>
    </div>
    {titulosFiltrados.length>limite&&<div className="no-print flex flex-wrap items-center gap-3"><span className="text-xs text-amber-800">Mostrando {limite} de {titulosFiltrados.length}. O CSV contém todos os registros filtrados.</span><button onClick={()=>setLimite(v=>v+200)} className="rounded-lg border px-3 py-2 text-xs font-bold">Mostrar mais 200</button></div>}
   </section>
   <div className="grid gap-4 lg:grid-cols-2">
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-1 font-bold">Previsão de vencimentos</h2><p className="mb-3 text-xs text-slate-500">Saldos abertos com data de vencimento no período; não é recebimento ou pagamento realizado.</p><div className="space-y-2">
     {atual.previsao.map(m=><div key={m.mes} className="flex items-center justify-between gap-2 border-b py-2 text-sm"><span>{m.mes.slice(5,7)}/{m.mes.slice(0,4)} · {m.titulos} título(s)</span><b>{dinheiro(m.valor)}</b></div>)}{!atual.previsao.length&&<p className="text-sm text-slate-500">Sem vencimentos em aberto no período.</p>}
    </div></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-1 font-bold">{tipo==='receber'?'Saldo em aberto por cliente':'Saldo em aberto por fornecedor'}</h2><p className="mb-3 text-xs text-slate-500">Ranking dos maiores saldos atuais, de todos os vencimentos. Não inclui cancelamentos.</p><div className="space-y-2">
     {atual.ranking.slice(0,10).map(r=><div key={r.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm"><span className="max-w-[65%] break-words">{r.nome}<small className="ml-1 text-slate-400">({r.titulos})</small></span><b>{dinheiro(r.saldo)}</b></div>)}{!atual.ranking.length&&<p className="text-sm text-slate-500">Nenhum saldo em aberto.</p>}
    </div></section>
   </div>
   <section className="rounded-xl border bg-white p-4">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">{tipo==='receber'?'Recebimentos realizados':'Pagamentos realizados'} no período</h2><p className="text-xs text-slate-500">{tipo==='receber'?'Registros individuais de recebimento, inclusive créditos gerais.':'Valores pagos registrados na conta a pagar, por data de pagamento.'}</p></div><button onClick={()=>void exportarMovimentos()} disabled={!acessos.financeiro.exportar} className="no-print inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50"><FileSpreadsheet size={14}/>Exportar movimentos</button></div>
    <div className="relatorio-tabela overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Cliente / fornecedor</th><th className="p-3">Forma</th><th className="p-3">Referência</th><th className="p-3 text-right">Valor</th></tr></thead><tbody>{movimentosPeriodo.slice(0,limite).map(m=><tr key={m.id} className="border-t"><td className="p-3">{formatarData(m.data)}</td><td className="p-3">{m.pessoa}</td><td className="p-3">{m.forma||'—'}</td><td className="p-3">{m.referencia||'—'}</td><td className="p-3 text-right font-bold">{dinheiro(m.valor)}</td></tr>)}{!movimentosPeriodo.length&&<tr><td colSpan={5} className="p-6 text-center text-slate-500">Nenhum movimento registrado no período.</td></tr>}</tbody></table></div>
    {movimentosPeriodo.length>limite&&<p className="text-xs text-amber-800">Exibidos {limite} de {movimentosPeriodo.length}; o CSV inclui todos.</p>}
   </section>
   <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"><h2 className="text-sm font-bold text-amber-950">Regras de conferência financeira</h2><div className="mt-2 space-y-1">{dados.avisos.map(a=><p key={a} className="text-xs text-amber-900">• {a}</p>)}</div></section>
  </>}
 </main>
}
