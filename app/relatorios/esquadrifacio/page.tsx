'use client'
import {useRelatoriosAcesso,autorizarExportacaoRelatorio} from '@/components/relatorios/RelatoriosAcesso'
import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,BarChart3,BookOpen,Download,Printer,Search} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {baixarCsv} from '@/lib/relatorios'
import FinanceiroRelatorio,{type FinanceiroRelatorioDados} from '@/components/relatorios/FinanceiroRelatorio'
import {gruposRelatorios,relatoriosEsquadrifacio,type RelatorioIndividual,type FonteRelatorio} from '@/lib/relatoriosEsquadrifacio'
import {validarPeriodoBook} from '@/lib/bookEsquadrifacio'

type Simples={nome:string;quantidade:number;valor:number}
type Produto={nome:string;imagem:string|null;quantidade:number;total:number;custoConhecido:number|null;margemPrevista:number|null}
type ClienteResultado={nome:string;contratos:number;valorContratos:number;custoPrevisto:number|null;margemPrevista:number|null}
type Dados={
 ok:true;periodo:{inicio:string;fim:string};
 resumo:{qtdObras:number;qtdBalcao:number;totalContratos:number;totalBalcao:number;totalComercial:number;meta:number;comprasNf:number;quantidadeNf:number;comprasCmv:number;quantidadeCmv:number};
 mensal:{mes:string;contratos:number;balcao:number;meta:number;obras:number}[];
 representantes:Simples[];clientes:Simples[];clientesMargem:ClienteResultado[];cidades:Simples[];
 produtos:Produto[];fornecedores:Simples[];fornecedoresCmv:Simples[];notas:string[]
}
const moeda=(n:number)=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const num=(n:number)=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:2})
const porcentagem=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:2})+'%'
const nomeMes=(s:string)=>s.slice(5,7)+'/'+s.slice(0,4)
const inicial=()=>{
 const d=new Date(),ano=d.getFullYear(),mes=String(d.getMonth()+1).padStart(2,'0')
 return {inicio:ano+'-'+mes+'-01',fim:ano+'-'+mes+'-'+String(d.getDate()).padStart(2,'0')}
}
function Tag({tipo}:{tipo:FonteRelatorio}){
 const pendente=tipo==='pendente', parcial=['representantes','lucro-cliente','abc-produtos','produtos','lucro-produto','margem','dre','caixa','comparativo','cidades'].includes(tipo)
 return <span className={'inline-flex rounded-md px-2 py-1 text-[11px] font-semibold '+(pendente?'bg-slate-100 text-slate-600':parcial?'bg-amber-50 text-amber-800':'bg-emerald-50 text-emerald-800')}>{pendente?'Integração pendente':parcial?'Dados parciais / preliminares':'Consulta disponível'}</span>
}
function Indicador({nome,valor,nota}:{nome:string;valor:string;nota?:string}){
 return <div className="rounded-xl border bg-white p-4"><p className="text-xs font-semibold uppercase text-slate-500">{nome}</p><b className="mt-1 block text-xl text-slate-900">{valor}</b>{nota&&<p className="mt-1 text-xs text-slate-500">{nota}</p>}</div>
}
function Tabela({colunas,linhas,imagem=false}:{colunas:string[];linhas:(string|number|null)[][];imagem?:boolean}){
 return <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[630px] text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr>{colunas.map((c,i)=><th key={c+'-'+i} className="p-3">{c}</th>)}</tr></thead>
  <tbody>{linhas.map((linha,i)=><tr key={i} className="border-t">{linha.map((valor,j)=><td key={j} className="p-3 align-middle">{imagem&&j===0?<div className="flex items-center gap-2"><div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50">{typeof linha[1]==='string'&&linha[1].startsWith('https://')?<img src={linha[1]} alt={'Imagem do produto '+valor} className="h-full w-full object-contain" loading="lazy"/>:<span className="px-1 text-center text-[9px] text-slate-500">Foto pendente</span>}</div><span>{valor}</span></div>:imagem&&j===1?null:valor===null?'Não apurado':valor}</td>)}</tr>)}{!linhas.length&&<tr><td colSpan={colunas.length} className="p-8 text-center text-slate-500">Nenhum registro disponível para esta consulta no período.</td></tr>}</tbody></table></div>
}
function abc<T>(linhas:T[],getValor:(l:T)=>number){
 const total=linhas.reduce((s,l)=>s+getValor(l),0)
 let acumulado=0
 return linhas.map(l=>{const v=getValor(l);acumulado+=v;const fatia=total?100*v/total:0,ac=total?100*acumulado/total:0;return {l,participacao:fatia,acumulada:ac,classe:ac<=80?'A':ac<=95?'B':'C'}})
}
export default function RelatoriosEsquadrifacio(){
 const acessos=useRelatoriosAcesso()
 const [periodo,setPeriodo]=useState(inicial)
 const [atualizacao,setAtualizacao]=useState(0)
 const [grupo,setGrupo]=useState('Todos')
 const [busca,setBusca]=useState('')
 const [selecionado,setSelecionado]=useState('analise-vendas')
 const [dados,setDados]=useState<Dados|null>(null)
 const [financeiro,setFinanceiro]=useState<FinanceiroRelatorioDados|null>(null)
 const [carregando,setCarregando]=useState(false)
 const [erro,setErro]=useState('')
 useEffect(()=>{const s=new URLSearchParams(window.location.search).get('relatorio');if(s&&relatoriosEsquadrifacio.some(x=>x.id===s))setSelecionado(s)},[])
 const relatorio=relatoriosEsquadrifacio.find(r=>r.id===selecionado)||relatoriosEsquadrifacio[0]
 const itens=useMemo(()=>relatoriosEsquadrifacio.filter(r=>(grupo==='Todos'||r.grupo===grupo)&&r.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR'))),[busca,grupo])
 async function carregar(){
  setErro('');setCarregando(true)
  try{
   const token=await tokenAtual();if(!token)throw Error('Entre novamente no Atlas.')
   const p=new URLSearchParams(periodo)
   const [r,f]=await Promise.all([
    fetch('/api/relatorios/esquadrifacio?'+p,{headers:{Authorization:'Bearer '+token},cache:'no-store'}),
    fetch('/api/relatorios/financeiro?'+p,{headers:{Authorization:'Bearer '+token},cache:'no-store'})
   ])
   const result=await r.json()
   if(!r.ok)throw Error(result.error||'Não foi possível carregar os relatórios.')
   setDados(result as Dados)
   const fin=await f.json().catch(()=>({}))
   if(f.ok)setFinanceiro(fin as FinanceiroRelatorioDados)
   else{setFinanceiro(null);setErro('Relatório financeiro indisponível neste período: '+String(fin.error||'verifique o período.'))}
  }catch(e){setDados(null);setFinanceiro(null);setErro(e instanceof Error?e.message:'Erro ao consultar os dados.')}
  finally{setCarregando(false)}
 }
 useEffect(()=>{void carregar()},[atualizacao])
 function escolher(item:RelatorioIndividual){setSelecionado(item.id);const u=new URL(window.location.href);u.searchParams.set('relatorio',item.id);window.history.replaceState(null,'',u.pathname+u.search)}
 const relatorioRows=():{colunas:string[];linhas:(string|number|null)[][];imagens?:boolean}|null=>{
  if(!dados)return null
  const f=relatorio.fonte
  if(f==='vendas')return {colunas:['Mês','Contratos de obra','Vendas balcão','Total comercial','Qtd. obras'],linhas:dados.mensal.map(x=>[nomeMes(x.mes),moeda(x.contratos),moeda(x.balcao),moeda(x.contratos+x.balcao),x.obras])}
  if(f==='metas')return {colunas:['Mês','Meta cadastrada','Contratos de obras','Atingimento'],linhas:dados.mensal.map(x=>[nomeMes(x.mes),x.meta>0?moeda(x.meta):'Sem meta cadastrada',moeda(x.contratos),x.meta>0?porcentagem(100*x.contratos/x.meta):'Não apurado'])}
  if(f==='representantes')return {colunas:['Vendedor (balcão)','Vendas finalizadas','Valor'],linhas:dados.representantes.map(x=>[x.nome,x.quantidade,moeda(x.valor)])}
  if(f==='clientes')return {colunas:['Cliente','Contratos confirmados','Valor contratado'],linhas:dados.clientes.map(x=>[x.nome,x.quantidade,moeda(x.valor)])}
  if(f==='abc-clientes')return {colunas:['Cliente','Contratos','Valor','Participação','Acumulado','Classe'],linhas:abc(dados.clientes,x=>x.valor).map(x=>[x.l.nome,x.l.quantidade,moeda(x.l.valor),porcentagem(x.participacao),porcentagem(x.acumulada),x.classe])}
  if(f==='lucro-cliente')return {colunas:['Cliente','Contratos','Valor contratado','Custo previsto','Margem projetada'],linhas:dados.clientesMargem.map(x=>[x.nome,x.contratos,moeda(x.valorContratos),x.custoPrevisto===null?'A conferir':moeda(x.custoPrevisto),x.margemPrevista===null?'Não apurada':moeda(x.margemPrevista)])}
  if(f==='produtos'||f==='abc-produtos'||f==='lucro-produto'){
   if(f==='abc-produtos')return {colunas:['Produto (foto)','Imagem','Valor vendido','Participação','Acumulado','Classe'],imagens:true,linhas:abc(dados.produtos,x=>x.total).map(x=>[x.l.nome,x.l.imagem,moeda(x.l.total),porcentagem(x.participacao),porcentagem(x.acumulada),x.classe])}
   if(f==='lucro-produto')return {colunas:['Produto (foto)','Imagem','Valor vendido','Custo conhecido','Margem projetada'],imagens:true,linhas:dados.produtos.map(x=>[x.nome,x.imagem,moeda(x.total),x.custoConhecido===null?'Não apurado':moeda(x.custoConhecido),x.margemPrevista===null?'Não apurada':moeda(x.margemPrevista)])}
   return {colunas:['Produto (foto)','Imagem','Quantidade vendida','Valor vendido'],imagens:true,linhas:dados.produtos.map(x=>[x.nome,x.imagem,num(x.quantidade),moeda(x.total)])}
  }
  if(f==='cidades')return {colunas:['Cidade','Obras vendidas','Valor contratado'],linhas:dados.cidades.map(x=>[x.nome,x.quantidade,moeda(x.valor)])}
  if(f==='fornecedores')return {colunas:['Fornecedor','Origem da informação','Registros','Valor registrado'],linhas:[
   ...dados.fornecedores.map(x=>[x.nome,'NF de entrada',x.quantidade,moeda(x.valor)]),
   ...dados.fornecedoresCmv.map(x=>[x.nome,'Compra manual no CMV (não somada à NF)',x.quantidade,moeda(x.valor)])
  ]}
  if(f==='comparativo')return {colunas:['Indicador','Base de dados','Valor'],linhas:[['Vendas de obras','Contratos confirmados',moeda(dados.resumo.totalContratos)],['Vendas de balcão','Finalizadas',moeda(dados.resumo.totalBalcao)],['Compras de mercadoria','Notas de entrada cadastradas',moeda(dados.resumo.comprasNf)],['Compras manuais','CMV (origem distinta; pode repetir NF)',moeda(dados.resumo.comprasCmv)]]}
  if(f==='dre'&&financeiro){
   const d=financeiro.dre
   if(relatorio.id==='dre-analitica-2'){
    const grupos=financeiro.classificacao?.gastosPorGrupo||{}
    return {colunas:['Grupo no plano de contas','Pagamentos classificados (regime de caixa)','Na DRE contábil'],linhas:[
     ...Object.entries(grupos).map(([grupo,v])=>[grupo,moeda(v),'Ainda requer apropriação por competência']),
     ['Pagamentos ainda sem classificação',String(financeiro.classificacao?.pagamentosSemClassificacao??0),'Não apurado']
    ]}
   }
   if(relatorio.id==='dre-analitica-3'){
    return {colunas:['Indicador gerencial','Resultado da consulta','Situação'],linhas:[
     ['Quantidade de obras',d.obras,'Contratos confirmados'],
     ['Quantidade de vendas balcão',d.balcao,'Finalizadas'],
     ['Vendas com CMV incompleto',d.semPrevisao,d.semPrevisao>0?'Impedem fechamento':'Sem pendência técnica detectada'],
     ['Margem bruta prevista (%)',d.margemPct===null?'Não apurado':porcentagem(d.margemPct),'Prévia; não é lucro'],
     ['Lucro líquido',null,'Despesas e tributos não conciliados']
    ]}
   }
   if(relatorio.id==='dre-sintetica'){
    return {colunas:['Linha sintética','Valor','Situação'],linhas:[
     ['Receita comercial',moeda(d.receitaTotal),'Obras contratadas + balcão'],
     ['CMV previsto',moeda(d.cmvPrevisto),'Ainda não realizado integralmente'],
     ['Margem bruta projetada',d.margemBrutaProjetada===null?'Não apurada':moeda(d.margemBrutaProjetada),'Prévia'],
     ['Lucro líquido',null,'Depende de conciliação fiscal e competência']
    ]}
   }
   return {colunas:['Linha DRE gerencial prévia','Valor','Regime / situação'],linhas:[['Receita de obras contratada',moeda(d.receitaObras),'Contrato, não NF'],['Vendas balcão',moeda(d.receitaBalcao),'Finalizadas'],['Receita comercial',moeda(d.receitaTotal),'Não fiscal'],['CMV previsto',moeda(d.cmvPrevisto),'Previsão técnica'],['Margem bruta projetada',d.margemBrutaProjetada===null?'Não apurada':moeda(d.margemBrutaProjetada),'Não fechada'],['Tributos',null,'Falta conciliação'],['Despesas por competência',null,'Falta conciliação'],['Lucro líquido',null,'Não apurado']]}
  }
  if(f==='caixa'&&financeiro)return {colunas:['Mês','Recebimentos registrados','Pagamentos registrados','Diferença dos movimentos'],linhas:financeiro.caixa.meses.map(x=>[nomeMes(x.mes),moeda(x.recebido),moeda(x.pago),moeda(x.recebido-x.pago)])}
  if(f==='margem'&&financeiro){
   const d=financeiro.dre
   return {colunas:['Indicador','Valor'],linhas:[['Receita comercial registrada',moeda(d.receitaTotal)],['CMV previsto',moeda(d.cmvPrevisto)],['Margem bruta projetada',d.margemBrutaProjetada==null?'Não apurada':moeda(d.margemBrutaProjetada)],['Margem projetada %',d.margemPct==null?'Não apurada':porcentagem(d.margemPct)]]}
  }
  return null
 }
 const tabela=relatorioRows()
 async function imprimir(){try{await autorizarExportacaoRelatorio('esquadrifacio');window.print()}catch(e){setErro(e instanceof Error?e.message:'Impressão não autorizada.')}}
 async function exportar(){
  try{await autorizarExportacaoRelatorio('esquadrifacio')}catch(e){setErro(e instanceof Error?e.message:'Exportação não autorizada.');return}
  if(!tabela)return
  const header=tabela.imagens?tabela.colunas.filter((_,i)=>i!==1):tabela.colunas
  const body=tabela.imagens?tabela.linhas.map(row=>row.filter((_,i)=>i!==1)):tabela.linhas
  baixarCsv('esquadrifacio-'+relatorio.id+'-'+periodo.inicio+'-'+periodo.fim+'.csv',[header,...body.map(linha=>linha.map(v=>v??''))])
 }
 return <div className="min-h-screen bg-slate-50"><style>{'@media print {.relatorios-acoes,.relatorios-navegacao{display:none!important}.atlas-sidebar-shell,.atlas-sidebar-nav,.atlas-topbar,.atlas-mobile-navigation{display:none!important}.atlas-app-content{height:auto!important;overflow:visible!important} body{background:#fff!important}}'}</style>
  <main className="mx-auto max-w-7xl space-y-5 px-3 py-6 md:px-6">
   <div className="flex flex-wrap items-start justify-between gap-3"><div>
    <Link href="/relatorios" className="relatorios-acoes mb-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"><ArrowLeft size={15}/> Central de Relatórios</Link>
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Esquadrifácio · Gestão e resultados</p>
    <h1 className="mt-1 text-2xl font-bold text-slate-900">Relatórios gerenciais individuais</h1>
    <p className="mt-1 text-sm text-slate-600">31 visões do fechamento de referência, organizadas por assunto. Consulte cada relatório antes de compilar o fechamento mensal.</p>
   </div><div className="relatorios-acoes flex flex-wrap gap-2">
    {validarPeriodoBook(periodo.inicio,periodo.fim)&&<Link href={'/relatorios/esquadrifacio/book?inicio='+encodeURIComponent(periodo.inicio)+'&fim='+encodeURIComponent(periodo.fim)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"><BookOpen size={17}/> Gerar Book do Período</Link>}
    <button disabled={!acessos.esquadrifacio.exportar||!tabela} onClick={exportar} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"><Download size={15}/> Excel / CSV</button><button disabled={!acessos.esquadrifacio.exportar} onClick={()=>void imprimir()} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Printer size={15}/> Imprimir / PDF</button></div></div>
   <section className="relatorios-acoes flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
    <label className="text-xs font-bold">Data inicial<input className="mt-1 block rounded-lg border px-3 py-2 text-sm" type="date" value={periodo.inicio} onChange={e=>setPeriodo(p=>({...p,inicio:e.target.value}))}/></label>
    <label className="text-xs font-bold">Data final<input className="mt-1 block rounded-lg border px-3 py-2 text-sm" type="date" value={periodo.fim} onChange={e=>setPeriodo(p=>({...p,fim:e.target.value}))}/></label>
    <button disabled={carregando||periodo.inicio>periodo.fim} onClick={()=>setAtualizacao(x=>x+1)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{carregando?'Consultando...':'Aplicar período'}</button>
    <p className="text-xs text-slate-600">Relatórios de compras, vendas e Financeiro usam o período selecionado. Acesso restrito ao Master.</p>
   </section>
   {erro&&<p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{erro}</p>}
   <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
    <aside className="relatorios-navegacao self-start rounded-xl border bg-white p-3 lg:sticky lg:top-4">
     <div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar relatório" className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm"/></div>
     <select value={grupo} onChange={e=>setGrupo(e.target.value)} className="mt-2 w-full rounded-lg border p-2 text-sm"><option>Todos</option>{gruposRelatorios.map(g=><option key={g}>{g}</option>)}</select>
     <div className="mt-2 max-h-[65vh] space-y-1 overflow-y-auto">{itens.map(item=><button type="button" key={item.id} onClick={()=>escolher(item)} className={'block w-full rounded-lg border p-2 text-left text-xs '+(selecionado===item.id?'border-blue-500 bg-blue-50':'border-transparent hover:bg-slate-50')}>
      <span className="block font-semibold">{item.nome}</span><span className="mt-0.5 block text-[11px] text-slate-500">{item.grupo} · ref. pág. {item.pagina}</span>
     </button>)}{!itens.length&&<p className="py-5 text-center text-sm text-slate-500">Nenhum relatório encontrado.</p>}</div>
    </aside>
    <section className="space-y-4">
     <div className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-slate-500">{relatorio.grupo} · Visão {relatorio.pagina-1} de 31</p><h2 className="mt-1 text-xl font-bold text-slate-900">{relatorio.nome}</h2></div><Tag tipo={relatorio.fonte}/></div>
      <p className="mt-3 text-sm text-slate-600">{relatorio.observacao}</p><p className="mt-2 text-xs text-slate-500">Período consultado: {periodo.inicio.split('-').reverse().join('/')} até {periodo.fim.split('-').reverse().join('/')} · Esquadrifácio</p></div>
     {relatorio.fonte==='pendente'?<div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
       <h3 className="font-bold text-amber-900">Integração de dados necessária</h3><p className="mt-2 text-sm text-amber-900">{relatorio.observacao}</p>
       <p className="mt-2 text-xs text-amber-800">A visão está registrada no catálogo, mas os cálculos ficam desabilitados até existir uma fonte auditável. Não utilizamos valores fictícios do fechamento histórico.</p>
      </div>:<>
       {relatorio.fonte==='vendas'&&dados&&<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Indicador nome="Obras confirmadas" valor={moeda(dados.resumo.totalContratos)} nota={dados.resumo.qtdObras+' contratos'}/><Indicador nome="Balcão finalizado" valor={moeda(dados.resumo.totalBalcao)} nota={dados.resumo.qtdBalcao+' vendas'}/><Indicador nome="Total comercial" valor={moeda(dados.resumo.totalComercial)} nota="Não representa faturamento fiscal"/></div>}
       {relatorio.fonte==='metas'&&dados&&<div className="grid gap-3 sm:grid-cols-2"><Indicador nome="Meta cadastrada" valor={dados.resumo.meta>0?moeda(dados.resumo.meta):'Sem meta'}/><Indicador nome="Contratos de obra confirmados" valor={moeda(dados.resumo.totalContratos)}/></div>}
       {relatorio.fonte==='comparativo'&&dados&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Não subtraia compras de estoque da receita contratada para apurar lucro. As datas e regimes das fontes são diferentes; notas e CMV manual podem conter a mesma compra.</p>}
       {relatorio.fonte==='fornecedores'&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">As compras do CMV e as notas fiscais são mostradas separadamente. A soma de ambas pode duplicar uma mesma aquisição; a conciliação por documento será uma etapa futura.</p>}
       {relatorio.fonte==='caixa'&&financeiro&&<div className="grid gap-3 sm:grid-cols-3"><Indicador nome="Recebimentos" valor={moeda(financeiro.caixa.recebido)}/><Indicador nome="Pagamentos" valor={moeda(financeiro.caixa.pago)}/><Indicador nome="Diferença registrada" valor={moeda(financeiro.caixa.saldoParcial)} nota="Não é saldo bancário"/></div>}
       {relatorio.fonte==='dre'&&financeiro&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">DRE PRELIMINAR: CMV previsto, receita comercial contratada, sem lucro líquido ou tributos apurados. Para o detalhamento completo disponível, consulte <Link href="/relatorios" className="font-semibold underline">Financeiro</Link>.</p>}
       {tabela?<Tabela colunas={tabela.colunas} linhas={tabela.linhas} imagem={tabela.imagens}/>:<p className="rounded-xl border bg-white p-6 text-sm text-slate-600">{carregando?'Consultando fontes de dados...':'Informações não disponíveis. Verifique o período e as fontes habilitadas.'}</p>}
       {relatorio.fonte==='dre'&&financeiro&&<details className="rounded-xl border bg-white p-3"><summary className="cursor-pointer font-semibold">Ver todos os detalhes da DRE gerencial e plano de contas</summary><div className="mt-4"><FinanceiroRelatorio dados={financeiro} carregando={false}/></div></details>}
      </>}
     <p className="text-xs text-slate-600">Os relatórios são consultas de leitura; nenhum cadastro ou lançamento será modificado. Onde faltam fontes, há aviso explícito.</p>
    </section>
   </div>
   <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2"><BarChart3 size={18}/><h3 className="font-semibold">Fechamento mensal Esquadrifácio</h3></div><p className="mt-1 text-sm text-slate-600">Reúna as 31 visões em um Book gerencial com capa Esquadrifácio, índice, período consultado, relatórios disponíveis e avisos para integrações pendentes. Imprima ou salve o conjunto completo em PDF, sem alterar lançamentos.</p>{validarPeriodoBook(periodo.inicio,periodo.fim)&&<Link href={'/relatorios/esquadrifacio/book?inicio='+encodeURIComponent(periodo.inicio)+'&fim='+encodeURIComponent(periodo.fim)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white"><BookOpen size={17}/> Gerar e imprimir Book do período</Link>}</div>
  </main></div>
}
