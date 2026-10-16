'use client'
import {autorizarExportacaoRelatorio} from '@/components/relatorios/RelatoriosAcesso'
import {useEffect,useMemo,useState} from 'react'
import Link from 'next/link'
import {ArrowLeft,BookOpen,Printer,RefreshCw} from 'lucide-react'
import {tokenAtual} from '@/lib/auth'
import {gruposRelatorios,relatoriosEsquadrifacio} from '@/lib/relatoriosEsquadrifacio'
import {montarVisaoLivro,validarPeriodoBook,type DadosBook,type LivroTabela} from '@/lib/bookEsquadrifacio'
import type {FinanceiroRelatorioDados} from '@/components/relatorios/FinanceiroRelatorio'

type Periodo={inicio:string;fim:string}
const dataBR=(v:string)=>v.split('-').reverse().join('/')
const moeda=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const tituloMes=(inicio:string,fim:string)=>{
 const [a,m]=inicio.split('-'),[aa,mm]=fim.split('-')
 if(m===mm&&a===aa&&inicio.endsWith('-01')){
  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  const n=Number(m)
  return n>=1&&n<=12?meses[n-1].toUpperCase()+' / '+a:dataBR(inicio)+' a '+dataBR(fim)
 }
 return dataBR(inicio)+' a '+dataBR(fim)
}
function PrintTable({tabela}:{tabela:LivroTabela}){
 return <table className="livro-tabela w-full table-auto border-collapse text-[10px]">
  <thead><tr className="bg-slate-100">{tabela.colunas.map((t,j)=>tabela.imagens&&j===1?null:<th className="border border-slate-200 px-2 py-2 text-left font-semibold text-slate-800" key={t+j}>{t}</th>)}</tr></thead>
  <tbody>{tabela.linhas.map((linha,i)=><tr key={i} className={i%2===0?'bg-white':'bg-slate-50/70'}>
   {linha.map((campo,j)=>{
    if(tabela.imagens&&j===1)return null
    return <td key={j} className="border border-slate-200 px-2 py-1.5 align-middle text-slate-800">{tabela.imagens&&j===0?<div className="flex items-center gap-2">
     <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white">{typeof linha[1]==='string'&&linha[1].startsWith('https://')?<img src={linha[1]} alt={'Foto '+campo} loading="eager" className="h-full w-full object-contain"/>:<span className="p-0.5 text-center text-[7px] text-slate-500">Foto pendente</span>}</div><span>{String(campo??'Não informado')}</span></div>:campo===null?'Não apurado':campo}</td>
   })}
  </tr>)}{!tabela.linhas.length&&<tr><td colSpan={tabela.imagens?tabela.colunas.length-1:tabela.colunas.length} className="border border-slate-200 p-5 text-center text-slate-600">Nenhum registro encontrado para este período.</td></tr>}</tbody>
 </table>
}
export default function BookPeriodoEsquadrifacio(){
 const [rascunho,setRascunho]=useState<Periodo>({inicio:'',fim:''})
 const [consulta,setConsulta]=useState<Periodo|null>(null)
 const [dados,setDados]=useState<DadosBook|null>(null)
 const [financeiro,setFinanceiro]=useState<FinanceiroRelatorioDados|null>(null)
 const [status,setStatus]=useState<'inicial'|'consultando'|'pronto'|'erro'>('inicial')
 const [erro,setErro]=useState('')
 const [avisoFinanceiro,setAvisoFinanceiro]=useState('')
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search)
  const hoje=new Date()
  const mes=String(hoje.getMonth()+1).padStart(2,'0'),ano=hoje.getFullYear()
  const escolha={inicio:params.get('inicio')||ano+'-'+mes+'-01',fim:params.get('fim')||ano+'-'+mes+'-'+String(hoje.getDate()).padStart(2,'0')}
  setRascunho(escolha)
  setConsulta(escolha)
 },[])
 useEffect(()=>{
  if(!consulta)return
  if(!validarPeriodoBook(consulta.inicio,consulta.fim)){setStatus('erro');setErro('Informe um período válido de até 12 meses.');setDados(null);return}
  const controller=new AbortController()
  async function consultar(){
   setStatus('consultando');setErro('');setDados(null);setFinanceiro(null);setAvisoFinanceiro('')
   try{
    const token=await tokenAtual()
    if(!token)throw Error('A sessão expirou. Entre novamente no Atlas.')
    const p=new URLSearchParams({...consulta!,finalidade:'exportar'})
    const headers={Authorization:'Bearer '+token}
    const [r,f]=await Promise.all([
     fetch('/api/relatorios/esquadrifacio?'+p,{headers,signal:controller.signal,cache:'no-store'}),
     fetch('/api/relatorios/financeiro?'+p,{headers,signal:controller.signal,cache:'no-store'})
    ])
    const d=await r.json()
    if(!r.ok)throw Error(d.error||'Não foi possível carregar os relatórios do período.')
    const df=await f.json().catch(()=>({}))
    if(controller.signal.aborted)return
    setDados(d as DadosBook)
    if(f.ok)setFinanceiro(df as FinanceiroRelatorioDados)
    else setAvisoFinanceiro(df.error||'DRE e fluxo de caixa indisponíveis neste período.')
    setStatus('pronto')
   }catch(e){
    if(controller.signal.aborted)return
    setErro(e instanceof Error?e.message:'Falha ao carregar dados.')
    setStatus('erro')
   }
  }
  void consultar()
  return ()=>controller.abort()
 },[consulta?.inicio,consulta?.fim])
 const visoes=useMemo(()=>dados?relatoriosEsquadrifacio.map(relatorio=>({relatorio,...montarVisaoLivro(relatorio,dados,financeiro)})):[],[dados,financeiro])
 const disponiveis=visoes.filter(v=>v.estado==='disponivel').length
 const pendentes=visoes.filter(v=>v.estado==='pendente').length
 const indisponiveis=visoes.filter(v=>v.estado==='indisponivel').length
 const apto=status==='pronto'&&dados!==null
 function aplicar(){
  if(!validarPeriodoBook(rascunho.inicio,rascunho.fim)){setErro('Informe um período válido de até 12 meses.');return}
  setConsulta({...rascunho})
  const url=new URL(window.location.href)
  url.searchParams.set('inicio',rascunho.inicio);url.searchParams.set('fim',rascunho.fim)
  window.history.replaceState(null,'',url.pathname+url.search)
 }
 async function imprimir(){
  if(!apto)return
  try{await autorizarExportacaoRelatorio('esquadrifacio')}catch(e){setErro(e instanceof Error?e.message:'Impressão não autorizada.');return}
  // O navegador oferece Impressora ou Salvar como PDF. Sem escrever no financeiro/banco.
  window.print()
 }
 return <div className="min-h-screen bg-slate-100 text-slate-900"><style>{`
 @page { size:A4 portrait; margin:12mm 13mm 14mm; }
 @media print {
  html,body {background:#fff!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;}
  .atlas-sidebar-shell,.atlas-sidebar-nav,.atlas-topbar,.atlas-mobile-navigation,.atlas-app-content header,.book-controles,.book-ajuda {display:none!important;}
  .atlas-app-content {height:auto!important;overflow:visible!important;}
  .atlas-app-main {min-height:auto!important;padding:0!important;overflow:visible!important;}
  .book-documento {box-shadow:none!important;border:0!important;max-width:none!important;margin:0!important;padding:0!important;background:#fff!important;}
  .book-capa {break-after:page;min-height:246mm!important;border:0!important;}
  .book-indice {break-after:page;}
  .book-pagina {break-before:page;break-inside:auto;margin:0!important;padding-top:2mm!important;}
  .livro-tabela {font-size:8.5pt!important;width:100%!important;}
  .livro-tabela thead {display:table-header-group;}
  .livro-tabela tr {break-inside:avoid;page-break-inside:avoid;}
  .book-pagina header {display:block!important;}
  .book-rodape {display:block!important;}
  .book-grafico {break-inside:avoid;}
 }
 @media screen {.book-documento{box-shadow:0 15px 50px rgba(15,23,42,.10)}.book-pagina{border-top:1px solid #cbd5e1;margin-top:24px;padding-top:24px}}
 `}</style>
  <div className="book-controles sticky top-0 z-30 border-b bg-white p-3 shadow-sm"><div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
   <Link href="/relatorios/esquadrifacio" className="inline-flex items-center gap-1 text-sm font-bold text-blue-700"><ArrowLeft size={16}/> Voltar aos relatórios</Link>
   <div className="flex-1"/>
   <label className="text-xs font-bold">Início<input type="date" value={rascunho.inicio} onChange={e=>setRascunho(p=>({...p,inicio:e.target.value}))} className="ml-2 rounded-lg border p-2"/></label>
   <label className="text-xs font-bold">Fim<input type="date" value={rascunho.fim} onChange={e=>setRascunho(p=>({...p,fim:e.target.value}))} className="ml-2 rounded-lg border p-2"/></label>
   <button type="button" onClick={aplicar} disabled={status==='consultando'} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40"><RefreshCw size={15}/> Gerar período</button>
   <button type="button" onClick={imprimir} disabled={!apto||rascunho.inicio!==consulta?.inicio||rascunho.fim!==consulta?.fim} className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Printer size={16}/> Imprimir / Salvar PDF</button>
  </div></div>
  <main className="mx-auto max-w-5xl px-3 py-6">
   <div className="book-ajuda mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><b>Book Gerencial Esquadrifácio:</b> selecione o período, clique em Gerar período e, após carregar os relatórios, escolha <b>Imprimir / Salvar PDF</b>. No Chrome, selecione “Salvar como PDF” para guardar o livro completo. O documento não altera lançamentos financeiros.</div>
   {status==='consultando'&&<p role="status" className="mb-4 rounded-lg bg-white p-4 text-sm">Consultando os 31 relatórios e o Financeiro do período…</p>}
   {status==='erro'&&<p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{erro}</p>}
   {avisoFinanceiro&&<p role="status" className="book-ajuda mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{avisoFinanceiro}. Os demonstrativos indisponíveis serão identificados no livro.</p>}
   {apto&&consulta&&<div className="book-documento bg-white px-6 py-8 md:px-12">
    <section className="book-capa flex min-h-[850px] flex-col justify-between bg-slate-900 p-10 text-white">
     <div className="space-y-6"><img src="/branding/esquadrifacio-logo-r-transparente-escuro.webp" alt="Logotipo Esquadrifácio®" width={1280} height={236} loading="eager" className="block h-auto w-full max-w-[475px] object-contain"/><div className="h-[3px] w-32 rounded-full bg-emerald-300"/></div>
     <div><BookOpen className="mb-8 text-blue-300" size={58}/>
      <p className="text-lg uppercase tracking-[.17em] text-blue-200">Gestão e resultados</p>
      <h1 className="mt-4 text-5xl font-bold leading-tight">BOOK GERENCIAL</h1>
      <p className="mt-4 text-2xl font-semibold">{tituloMes(consulta.inicio,consulta.fim)}</p>
      <p className="mt-5 max-w-xl text-base text-slate-200">Fechamento do período · Vendas · Clientes · Produtos · Cidades · Compras · Resultados · DRE · Fluxo de caixa</p>
     </div>
     <div className="border-t border-white/25 pt-5 text-sm text-slate-300"><b className="text-white">ESQUADRIFÁCIO® SOLUÇÕES EM ALUMÍNIO LTDA</b><p className="mt-2">Documento gerencial do Atlas One · Confidencial · Acesso Master</p><p className="mt-1">Período: {dataBR(consulta.inicio)} a {dataBR(consulta.fim)}</p><p className="mt-1">Demonstrações fiscais ainda não conciliadas são expressamente identificadas no conteúdo.</p></div>
    </section>
    <section className="book-indice py-10"><img src="/branding/esquadrifacio-logo-r-transparente-claro.webp" alt="Logotipo Esquadrifácio®" width={1280} height={236} loading="eager" className="mb-6 h-auto w-full max-w-[240px]"/><p className="text-sm font-bold uppercase tracking-widest text-blue-700">Apresentação</p><h2 className="mt-3 text-3xl font-bold">Índice do Book</h2>
     <p className="mt-3 text-sm text-slate-700">Relatórios do período {dataBR(consulta.inicio)} a {dataBR(consulta.fim)}, consultados dos cadastros disponíveis no Atlas One. Indicadores de natureza diferente não devem ser confundidos com lucro ou receita fiscal.</p>
     <div className="mt-5 grid grid-cols-3 gap-3 text-center">{[['Visões',visoes.length],['Com dados',disponiveis],['Integrações pendentes',pendentes+indisponiveis]].map(([l,n])=><div key={String(l)} className="rounded-lg border bg-slate-50 p-3"><p className="text-[11px] text-slate-600">{l}</p><b className="text-2xl">{n}</b></div>)}</div>
     <div className="mt-7 space-y-4">{gruposRelatorios.map(g=><div key={g}><h3 className="mb-2 border-b border-blue-200 pb-1 font-bold text-blue-900">{g}</h3>{visoes.filter(v=>v.relatorio.grupo===g).map(v=><div key={v.relatorio.id} className="flex justify-between gap-3 py-1 text-xs"><span>{String(v.relatorio.pagina-1).padStart(2,'0')}. {v.relatorio.nome}</span><span className="shrink-0 text-slate-600">{v.estado==='disponivel'?'Consulta disponível':'Pendente'}</span></div>)}</div>)}</div>
     <p className="mt-7 text-xs text-slate-600">O Book reúne todas as visões cadastradas. Dados não apurados são marcados, nunca substituídos por valores inventados. O arquivo original histórico foi preservado separadamente.</p>
    </section>
    {visoes.map((v,i)=><section key={v.relatorio.id} className="book-pagina">
     <header className="mb-5 border-b-2 border-blue-700 pb-4">
      <div className="flex items-center justify-between gap-2"><img src="/branding/esquadrifacio-logo-r-transparente-claro.webp" alt="Logotipo Esquadrifácio®" width={1280} height={236} loading="eager" className="h-auto w-full max-w-[188px]"/><span className="text-xs text-slate-500">{String(i+1).padStart(2,'0')} / {String(visoes.length).padStart(2,'0')}</span></div>
      <p className="mt-3 text-xs font-semibold uppercase text-slate-500">{v.relatorio.grupo}</p>
      <h2 className="mt-1 text-2xl font-bold">{v.relatorio.nome}</h2>
      <p className="mt-2 text-xs text-slate-600">{dataBR(consulta.inicio)} a {dataBR(consulta.fim)}</p>
     </header>
     <p className="mb-4 rounded-lg border-l-4 border-blue-400 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">{v.aviso}</p>
     {v.tabela?<><PrintTable tabela={v.tabela}/>{v.tabela.linhas.length>0&&['abc-clientes','abc-produtos','cidades','fornecedores','representantes','produtos','clientes'].includes(v.relatorio.fonte)&&<div className="book-grafico mt-5 rounded-lg border p-3">
       <h3 className="mb-3 text-sm font-bold">Visão gráfica · maiores registros</h3>
       {v.tabela.linhas.slice(0,8).map((linha,j)=>{
        const titulo=String(linha[0]??'Não informado')
        const valorNumerico=(()=>{
         const encontrado=linha.slice(2).find(x=>typeof x==='string'&&x.includes('R$'))
         const bruto=String(encontrado??'').replace(/[^\d,]/g,'').replace(',','.')
         return Number(bruto)||0
        })()
        const máximo=v.tabela?.linhas.slice(0,8).reduce((max,row)=>{
         const preco=row.slice(2).find(x=>typeof x==='string'&&x.includes('R$'))
         return Math.max(max,Number(String(preco??'').replace(/[^\d,]/g,'').replace(',','.'))||0)
        },0)||1
        return <div key={j} className="mb-2 grid grid-cols-[32%_1fr] items-center gap-2 text-[10px]"><span className="truncate" title={titulo}>{titulo}</span><div className="h-3 rounded-sm bg-slate-100"><div className="h-3 rounded-sm bg-blue-600" style={{width:Math.max(0,100*valorNumerico/máximo)+'%'}}/></div></div>
       })}</div>}</>:<div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
       <b className="text-sm text-amber-900">{v.estado==='pendente'?'Integração de dados pendente':'Fonte indisponível neste período'}</b>
       <p className="mt-2 text-sm text-amber-900">{v.aviso}</p>
       <p className="mt-2 text-xs text-amber-800">Esta página faz parte do modelo de fechamento. Os resultados somente serão calculados após a integração e validação da origem dos dados.</p>
      </div>}
     <footer className="book-rodape mt-8 border-t pt-2 text-[10px] text-slate-500">Esquadrifácio® · Atlas One · Relatório {i+1} de {visoes.length} · {v.estado==='disponivel'?'Consulta aos dados do Atlas':'Dados a conferir'}</footer>
    </section>)}
    <section className="book-pagina"><header className="mb-5 border-b-2 border-blue-700 pb-4"><img src="/branding/esquadrifacio-logo-r-transparente-claro.webp" alt="Logotipo Esquadrifácio®" width={1280} height={236} loading="eager" className="mb-4 h-auto w-full max-w-[188px]"/><h2 className="mt-3 text-2xl font-bold">Notas metodológicas e pendências</h2></header>
     <p className="text-sm">Este relatório gerencial foi emitido a partir dos registros disponíveis no Atlas One para o período selecionado. A geração é somente de leitura e não equivale a demonstrações contábeis homologadas.</p>
     <div className="mt-5 space-y-2 text-xs">{dados!.notas.map((nota,i)=><p key={i} className="rounded bg-slate-50 p-2">{nota}</p>)}</div>
     <p className="mt-6 text-sm font-bold">Visões com integração pendente: {pendentes+indisponiveis}</p>
     <div className="mt-3 space-y-2 text-xs">{visoes.filter(v=>v.estado!=='disponivel').map(v=><p key={v.relatorio.id}><b>{v.relatorio.nome}:</b> {v.aviso}</p>)}</div>
     <p className="mt-8 text-xs text-slate-600">Documento para análise interna da Esquadrifácio. Não representa balanço, lucro fiscal nem extrato bancário conciliado.</p>
    </section>
   </div>}
  </main>
 </div>
}
