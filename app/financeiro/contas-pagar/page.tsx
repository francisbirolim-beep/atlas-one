'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, RefreshCw, WalletCards, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'
import BarraFiltrosPeriodo from '@/components/financeiro/BarraFiltrosPeriodo'
import FormLancamentoManual from '@/components/financeiro/FormLancamentoManual'
import {baixarCSV,csvFinanceiro,dinheiro,formatarData,isoLocal,noPeriodo,periodoRapido,type PeriodoFinanceiro} from '@/lib/financeiroPeriodo'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'
import { calcularBaixaPagar, saldoContaPagar } from '@/lib/contasPagarAjustes'

type Conta={id:string;nf_id:string|null;fornecedor_id?:string|null;fornecedor_nome:string|null;fornecedor_cnpj_cpf?:string|null;fornecedor_cidade?:string|null;documento:string|null;parcela:string;descricao:string|null;data_emissao:string|null;vencimento:string|null;valor:number;status:string;data_pagamento:string|null;valor_pago:number|null;valor_desconto?:number|null;valor_juros?:number|null;valor_multa?:number|null;valor_troco?:number|null;forma_pagamento:string|null;forma_pagamento_prevista?:string|null;origem?:string|null}
type FormPagamento={dataPagamento:string;formaPagamento:string;valorEntregue:string;valorDesconto:string;valorJuros:string;valorMulta:string;valorTroco:string}
const campoDinheiro='mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500'

type FornecedorCadastro={id:string;nome:string;cnpj_cpf:string|null;cidade:string|null;telefone:string|null}
type Situacao='todas'|'aberto'|'vencido'|'pago'|'cancelado'
type Categoria={id:string;codigo:string;nome:string;grupo:string}
export default function ContasPagarPage(){
 const[contas,setContas]=useState<Conta[]>([]),[loading,setLoading]=useState(true),[erro,setErro]=useState(''),[acao,setAcao]=useState('')
 const[fornecedoresCadastro,setFornecedoresCadastro]=useState<FornecedorCadastro[]>([])
 const[modalPagamento,setModalPagamento]=useState<Conta|null>(null)
 const[aviso,setAviso]=useState('')
 const[ultimoReciboId,setUltimoReciboId]=useState<string|null>(null)
 const[formPagamento,setFormPagamento]=useState<FormPagamento>({dataPagamento:'',formaPagamento:'pix',valorEntregue:'0',valorDesconto:'0',valorJuros:'0',valorMulta:'0',valorTroco:'0'})
 const alterarCampo=(campo:keyof FormPagamento,valor:string)=>setFormPagamento(atual=>({...atual,[campo]:valor}))

 const[categorias,setCategorias]=useState<Categoria[]>([]),[classificacoes,setClassificacoes]=useState<Record<string,string>>({})
 const[periodo,setPeriodo]=useState<PeriodoFinanceiro>(()=>periodoRapido('todos'))
 const[situacao,setSituacao]=useState<Situacao>('aberto'),[fornecedor,setFornecedor]=useState(''),[busca,setBusca]=useState(''),[dataBase,setDataBase]=useState<'vencimento'|'pagamento'>('vencimento'),[agrupar,setAgrupar]=useState(false)
 async function carregar(){setLoading(true);setErro('');try{const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.');const r=await fetch('/api/financeiro/contas-pagar?limit=1000',{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro');setContas(j.contas||[]);setFornecedoresCadastro(j.fornecedoresCadastro||[]);setCategorias(j.categorias||[]);setClassificacoes(Object.fromEntries((j.classificacoes||[]).map((v:{conta_pagar_id:string;plano_conta_id:string})=>[v.conta_pagar_id,v.plano_conta_id])))}catch(e){setErro(e instanceof Error?e.message:'Erro ao carregar.')}finally{setLoading(false)}}
 useEffect(()=>{void carregar()},[])
 function abrirPagamento(conta:Conta){
  setErro('');setAviso('');setModalPagamento(conta)
  const formaPrevista=String(conta.forma_pagamento_prevista||'').trim().toLowerCase()
  const formasPermitidas=['pix','boleto','transferencia','dinheiro','cartao_credito','cartao_debito','cheque','outros']
  setFormPagamento({dataPagamento:isoLocal(new Date()),formaPagamento:formasPermitidas.includes(formaPrevista)?formaPrevista:'pix',
    valorEntregue:Number(conta.valor).toFixed(2),valorDesconto:'0',valorJuros:'0',valorMulta:'0',valorTroco:'0'})
 }
 const calculoPagamento=modalPagamento?calcularBaixaPagar({
  valorTitulo:modalPagamento.valor,valorEntregue:formPagamento.valorEntregue,
  valorDesconto:formPagamento.valorDesconto,valorJuros:formPagamento.valorJuros,
  valorMulta:formPagamento.valorMulta,valorTroco:formPagamento.valorTroco,
  formaPagamento:formPagamento.formaPagamento,
 }):null
 async function confirmarPagamento(){
  if(!modalPagamento||!calculoPagamento?.ok||acao)return
  const id=modalPagamento.id
  // Abrir a aba no clique evita o bloqueio de pop-ups após a chamada assíncrona.
  // A impressão só será liberada depois de o servidor confirmar a baixa.
  const janelaRecibo=window.open('about:blank','_blank')
  if(janelaRecibo)janelaRecibo.opener=null
  setAcao(id+'pagar');setErro('');setAviso('');setUltimoReciboId(null)
  try{
   const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.')
   const r=await fetch('/api/financeiro/contas-pagar',{method:'PATCH',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},
     body:JSON.stringify({id,acao:'pagar',...formPagamento})})
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível confirmar o pagamento.')
   if(j.simulacao){
    janelaRecibo?.close()
    setContas(prev=>prev.map(c=>c.id===id?{...c,...j.conta}:c))
    setAviso('Prévia: pagamento simulado com os ajustes informados. Nenhum dado real foi alterado.')
   }else{
    setUltimoReciboId(id)
    const caminho='/financeiro/recibo/pagar/'+encodeURIComponent(id)+'?acao=imprimir'
    if(janelaRecibo&&!janelaRecibo.closed)janelaRecibo.location.replace(caminho)
    else setAviso('Pagamento confirmado. A janela de impressão foi bloqueada pelo navegador. Use o botão Imprimir comprovante.')
    await carregar()
   }
   setModalPagamento(null)
  }catch(e){janelaRecibo?.close();setErro(e instanceof Error?e.message:'Erro ao confirmar pagamento.')}
  finally{setAcao('')}
 }
 async function mudar(id:string,tipo:'reabrir'|'cancelar'){
  if(acao)return
  setAcao(id+tipo);setErro('');setAviso('')
  try{
   const t=await tokenAtual();if(!t)throw new Error('Sessão expirada.')
   const r=await fetch('/api/financeiro/contas-pagar',{method:'PATCH',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({id,acao:tipo})})
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Erro')
   if(j.simulacao){setContas(prev=>prev.map(c=>c.id===id?{...c,...j.conta}:c));setAviso('Prévia: ação simulada sem modificar o banco real.')}
   else await carregar()
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao atualizar.')}finally{setAcao('')}
 }
 async function classificar(id:string,categoriaId:string){
  if(!categoriaId)return
  if(window.location.hostname.endsWith('.vercel.app')||window.location.hostname==='localhost'){
   setClassificacoes(p=>({...p,[id]:categoriaId}));setErro('Simulação: classificação DRE mostrada na prévia, sem gravar no banco de dados.');return
  }
  setAcao('categoria'+id);setErro('')
  try{
   const t=await tokenAtual(),r=await fetch('/api/financeiro/lancamentos-manuais',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({tipo:'pagar',operacao:'classificar',tituloId:id,categoriaId})})
   const j=await r.json();if(!r.ok)throw new Error(j.error||'Não foi possível classificar.')
   setClassificacoes(p=>({...p,[id]:categoriaId}))
  }catch(e){setErro(e instanceof Error?e.message:'Erro ao classificar.')}finally{setAcao('')}
 }
 const hoje=isoLocal(new Date())
 const fornecedores=useMemo(()=>[...new Set(contas.map(c=>c.fornecedor_nome||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')),[contas])
 const encontradosCadastro=useMemo(()=>busca.trim()?fornecedoresCadastro.filter(f=>correspondeBuscaAtlas(busca,f.nome,f.cnpj_cpf,f.cidade,f.telefone)):[],[fornecedoresCadastro,busca])
 const filtradas=useMemo(()=>contas.filter(c=>{
  const vencida=(c.status==='aberto'||c.status==='pendente_vencimento')&&!!c.vencimento&&c.vencimento<hoje
  const okSituacao=situacao==='todas'||(situacao==='vencido'&&vencida)||(situacao==='aberto'&&(c.status==='aberto'||c.status==='pendente_vencimento'))||c.status===situacao
  const campo=dataBase==='pagamento'?c.data_pagamento:c.vencimento
  return okSituacao&&(!fornecedor||c.fornecedor_nome===fornecedor)&&noPeriodo(campo,periodo.inicio,periodo.fim)&&correspondeBuscaAtlas(busca,c.fornecedor_nome,c.fornecedor_cnpj_cpf,c.fornecedor_cidade,c.documento,c.descricao,c.parcela)
 }),[contas,situacao,fornecedor,periodo,dataBase,busca,hoje])
 const exibidas=useMemo(()=>agrupar?[...filtradas].sort((a,b)=>(a.fornecedor_nome||'').localeCompare(b.fornecedor_nome||'','pt-BR')||(a.vencimento||'').localeCompare(b.vencimento||'')):filtradas,[filtradas,agrupar])
 const resumo=useMemo(()=>({
  aberto:filtradas.filter(c=>['aberto','pendente_vencimento'].includes(c.status)).reduce((s,c)=>s+saldoContaPagar(c),0),
  vencido:filtradas.filter(c=>['aberto','pendente_vencimento'].includes(c.status)&&!!c.vencimento&&c.vencimento<hoje).reduce((s,c)=>s+saldoContaPagar(c),0),
  pago:filtradas.filter(c=>c.status==='pago').reduce((s,c)=>s+Number(c.valor_pago??c.valor),0),
  total:filtradas.reduce((s,c)=>s+Number(c.valor),0)
 }),[filtradas,hoje])
 const csv=()=>baixarCSV('atlas-contas-a-pagar.csv',csvFinanceiro([
  ['Contas a pagar - Esquadrifácio','Período',`${periodo.inicio||'Todos'} a ${periodo.fim||'Todos'}`],
  ['Fornecedor','Documento','Parcela','Descrição','Vencimento','Data do pagamento','Forma prevista','DRE','Valor original','Desconto','Juros','Multa','Troco','Pagamento líquido','Saldo','Situação'],
  ...filtradas.map(c=>[c.fornecedor_nome,c.documento,c.parcela,c.descricao,formatarData(c.vencimento),formatarData(c.data_pagamento),c.forma_pagamento_prevista,categorias.find(x=>x.id===classificacoes[c.id])?.nome||'A classificar',Number(c.valor),Number(c.valor_desconto||0),Number(c.valor_juros||0),Number(c.valor_multa||0),Number(c.valor_troco||0),Number(c.valor_pago||0),saldoContaPagar(c),c.status]),
  ['TOTAL','','','','','','','',resumo.total,filtradas.reduce((s,c)=>s+Number(c.valor_desconto||0),0),filtradas.reduce((s,c)=>s+Number(c.valor_juros||0),0),filtradas.reduce((s,c)=>s+Number(c.valor_multa||0),0),filtradas.reduce((s,c)=>s+Number(c.valor_troco||0),0),resumo.pago,resumo.aberto,'']
 ]))
 return <main className="min-h-screen bg-slate-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
 <style jsx global>{`@media print{@page{size:A4 landscape;margin:12mm}.no-print,nav,aside{display:none!important}main{padding:0!important;background:white!important} table{font-size:10px!important}button{display:none!important}}`}</style>
 <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Financeiro</p><h1 className="mt-1 text-2xl font-bold">Contas a Pagar</h1><p className="mt-1 text-sm text-slate-600">Lançamentos manuais e títulos gerados por compras, juntos e sem duplicar a cobrança.</p></div><div className="no-print flex flex-wrap items-center gap-2"><FormLancamentoManual tipo="pagar" onSalvo={()=>void carregar()}/><Link href="/compras" className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold">Compras</Link><button title="Atualizar" onClick={()=>void carregar()} className="rounded-xl border bg-white p-2.5"><RefreshCw size={18}/></button></div></header>
 {erro&&<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}
 {aviso&&<div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">{aviso}</div>}
 {ultimoReciboId&&<div className="no-print flex flex-wrap gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
  <Link href={'/financeiro/recibo/pagar/'+encodeURIComponent(ultimoReciboId)+'?acao=imprimir'} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-300 bg-white px-3 py-2 font-semibold">Imprimir comprovante</Link>
  <Link href={'/financeiro/recibo/pagar/'+encodeURIComponent(ultimoReciboId)+'?acao=pdf'} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white">Baixar PDF</Link>
 </div>}
 <BarraFiltrosPeriodo periodo={periodo} onPeriodo={setPeriodo} onExportar={csv} adicional={<>
   <label className="text-xs font-semibold text-slate-600">Fornecedor<select value={fornecedor} onChange={e=>setFornecedor(e.target.value)} className="mt-1 block max-w-[220px] rounded-lg border p-2.5 text-sm"><option value="">Todos os fornecedores</option>{fornecedores.map(n=><option key={n} value={n}>{n}</option>)}</select></label>
   <label className="text-xs font-semibold text-slate-600">Situação<select value={situacao} onChange={e=>setSituacao(e.target.value as Situacao)} className="mt-1 block rounded-lg border p-2.5 text-sm">{[['todas','Todas'],['aberto','Em aberto'],['vencido','Vencidas'],['pago','Pagas'],['cancelado','Canceladas']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <label className="text-xs font-semibold text-slate-600">Período pela data<select value={dataBase} onChange={e=>setDataBase(e.target.value as 'vencimento'|'pagamento')} className="mt-1 block rounded-lg border p-2.5 text-sm"><option value="vencimento">Vencimento</option><option value="pagamento">Pagamento efetivo</option></select></label>
   <label className="text-xs font-semibold text-slate-600">Buscar<input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome, CPF/CNPJ, cidade, boleto..." className="mt-1 block max-w-[210px] rounded-lg border p-2.5 text-sm"/></label>
   <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={agrupar} onChange={e=>setAgrupar(e.target.checked)}/>Agrupar por fornecedor</label>
  </>}/>
 <section className="grid gap-3 sm:grid-cols-4"><Card t="Em aberto (filtrado)" v={dinheiro(resumo.aberto)}/><Card t="Vencido (filtrado)" v={dinheiro(resumo.vencido)} destaque/><Card t="Já pago (filtrado)" v={dinheiro(resumo.pago)}/><Card t="Valor original (filtrado)" v={dinheiro(resumo.total)}/></section>
 {busca.trim()&&<section className="rounded-2xl border bg-white p-4"><h2 className="mb-2 text-sm font-bold text-slate-800">Fornecedores encontrados no cadastro — {encontradosCadastro.length}</h2><p className="mb-3 text-xs text-slate-500">A pesquisa do cadastro funciona independentemente de vencimento e situação dos boletos. Para consultar os títulos, use o financeiro do fornecedor.</p>{encontradosCadastro.length?<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{encontradosCadastro.slice(0,60).map(f=><Link key={f.id} href={`/fornecedores/${f.id}#financeiro`} className="rounded-xl border p-3 text-sm hover:border-blue-400 hover:bg-blue-50"><span className="block font-semibold text-blue-800">{f.nome}</span><span className="block text-xs text-slate-600">{[f.cidade,f.cnpj_cpf,f.telefone].filter(Boolean).join(' · ')||'Cadastro sem localização'}</span><span className="mt-1 block text-xs text-blue-700">Ver todos os boletos do fornecedor →</span></Link>)}</div>:<p className="text-sm text-slate-500">Nenhum fornecedor com esse nome, CPF/CNPJ, cidade ou telefone no cadastro.</p>}</section>}
 <section className="rounded-2xl border bg-white p-5"><h2 className="mb-3 text-sm font-bold text-slate-800">Relatório de títulos — {filtradas.length} parcela(s)</h2>{loading?<div className="py-12 text-center"><Loader2 className="mx-auto animate-spin"/></div>:<div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="p-2">Fornecedor</th><th className="p-2">Documento</th><th className="p-2">Parcela</th><th className="p-2">Vencimento</th><th className="p-2">Forma prevista</th><th className="p-2">DRE / categoria</th><th className="p-2 text-right">Original</th><th className="p-2 text-right">Desconto</th><th className="p-2 text-right">Juros</th><th className="p-2 text-right">Multa</th><th className="p-2 text-right">Troco</th><th className="p-2 text-right">Pago líquido</th><th className="p-2 text-right">Saldo</th><th className="p-2">Status</th><th className="no-print p-2 text-right">Ações</th></tr></thead><tbody>{exibidas.map((c,i)=>{
  const vencida=['aberto','pendente_vencimento'].includes(c.status)&&!!c.vencimento&&c.vencimento<hoje
  const subtotal=agrupar&&exibidas.filter(x=>x.fornecedor_nome===c.fornecedor_nome).reduce((s,x)=>s+Number(x.valor),0)
  return <tr key={c.id} className="border-b last:border-0"><td className="p-2 font-medium">{c.fornecedor_id?<Link href={`/fornecedores/${c.fornecedor_id}#financeiro`} className="text-brand-navy hover:underline" title="Abrir financeiro do fornecedor">{c.fornecedor_nome||'—'}</Link>:(c.fornecedor_nome||'—')}{agrupar&&exibidas.findIndex(x=>x.fornecedor_nome===c.fornecedor_nome)===i&&<span className="block text-[10px] font-semibold text-blue-700">Total fornecedor: {dinheiro(subtotal||0)}</span>}</td><td className="p-2">{c.documento||c.descricao||'—'}</td><td className="p-2">{c.parcela}</td><td className={`p-2 ${vencida?'font-semibold text-red-600':''}`}>{formatarData(c.vencimento)}</td><td className="p-2 capitalize">{c.forma_pagamento_prevista||'—'}</td><td className="p-2"><span className="hidden print:inline">{categorias.find(x=>x.id===classificacoes[c.id])?.nome||'Não classificado'}</span><select aria-label={`Categoria do título ${c.documento||c.id}`} value={classificacoes[c.id]||''} onChange={e=>void classificar(c.id,e.target.value)} disabled={!!acao} className="no-print max-w-[185px] rounded-lg border p-1.5 text-xs"><option value="">A classificar</option>{categorias.map(x=><option key={x.id} value={x.id}>{x.codigo} · {x.nome}</option>)}</select></td><td className="p-2 text-right font-semibold">{dinheiro(Number(c.valor))}</td><td className="p-2 text-right text-amber-700">{dinheiro(Number(c.valor_desconto||0))}</td><td className="p-2 text-right text-blue-700">{dinheiro(Number(c.valor_juros||0))}</td><td className="p-2 text-right text-blue-700">{dinheiro(Number(c.valor_multa||0))}</td><td className="p-2 text-right">{dinheiro(Number(c.valor_troco||0))}</td><td className="p-2 text-right font-semibold text-emerald-700">{dinheiro(Number(c.valor_pago||0))}</td><td className="p-2 text-right">{dinheiro(saldoContaPagar(c))}</td><td className="p-2"><span className={`rounded-full px-2 py-1 text-xs ${c.status==='pago'?'bg-emerald-100 text-emerald-700':c.status==='cancelado'?'bg-slate-100 text-slate-500':vencida?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{c.status.replace('_',' ')}</span></td><td className="no-print p-2 text-right">{c.status==='pago'?<div className="flex justify-end gap-1"><Link href={`/financeiro/recibo/pagar/${c.id}`} target="_blank" className="rounded-lg border px-2 py-1 text-xs font-semibold">Recibo</Link><button disabled={!!acao} onClick={()=>mudar(c.id,'reabrir')} className="rounded-lg border px-2 py-1 text-xs">Reabrir</button></div>:c.status!=='cancelado'?<div className="flex justify-end gap-1"><button disabled={!!acao} onClick={()=>abrirPagamento(c)} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"><CheckCircle2 size={13} className="mr-1 inline"/>Pagar</button><button disabled={!!acao} onClick={()=>mudar(c.id,'cancelar')} className="rounded-lg border px-2 py-1 text-xs">Cancelar</button></div>:null}</td></tr>})}</tbody><tfoot><tr className="bg-slate-50 font-bold"><td colSpan={6} className="p-3">TOTAL DO PERÍODO</td><td className="p-3 text-right">{dinheiro(resumo.total)}</td><td colSpan={4}/><td className="p-3 text-right">{dinheiro(resumo.pago)}</td><td className="p-3 text-right">{dinheiro(resumo.aberto)}</td><td colSpan={2}/></tr></tfoot></table>{!filtradas.length&&<div className="py-10 text-center text-slate-500"><WalletCards className="mx-auto mb-2"/>Nenhuma conta corresponde a esses filtros.</div>}</div>}</section>
 <p className="text-xs text-slate-500">Saldo = valor original − desconto + juros + multa − pagamento líquido. O troco é informativo e não integra o valor pago. Os relatórios consideram vencimento ou pagamento efetivo.</p>

 {modalPagamento && <div className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3">
  <section role="dialog" aria-modal="true" aria-label="Conferir pagamento do título" className="w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6" style={{maxHeight:'92vh'}}>
   <div className="flex items-start justify-between gap-3">
    <div>
     <h2 className="text-lg font-black text-slate-900">Conferir e baixar título</h2>
     <p className="mt-1 text-sm text-slate-600">{modalPagamento.fornecedor_nome||'Fornecedor'} · {modalPagamento.documento||modalPagamento.descricao||'Título'}</p>
     <p className="mt-1 text-xs text-slate-500">Os ajustes só serão aplicados após confirmar o pagamento.</p>
    </div>
    <button type="button" onClick={()=>setModalPagamento(null)} disabled={!!acao} className="rounded-lg border px-3 py-2 text-xs font-semibold">Fechar</button>
   </div>
   <div className="mt-4 rounded-xl bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor original</p>
    <p className="text-2xl font-black text-slate-900">{dinheiro(Number(modalPagamento.valor))}</p>
   </div>
   <div className="mt-4 grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-semibold text-slate-700">Data do pagamento
     <input type="date" value={formPagamento.dataPagamento} onChange={e=>alterarCampo('dataPagamento',e.target.value)} className={campoDinheiro}/>
    </label>
    <label className="text-sm font-semibold text-slate-700">Forma de pagamento
     <select value={formPagamento.formaPagamento} onChange={e=>alterarCampo('formaPagamento',e.target.value)} className={campoDinheiro}>
      {[['pix','PIX'],['boleto','Boleto'],['transferencia','Transferência'],['dinheiro','Dinheiro'],['cartao_credito','Cartão de crédito'],['cartao_debito','Cartão de débito'],['cheque','Cheque'],['outros','Outros']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
     </select>
    </label>
    {([
      ['valorDesconto','Valor desconto'],
      ['valorJuros','Valor juros'],
      ['valorMulta','Valor multa'],
      ['valorEntregue','Valor entregue ao fornecedor'],
      ['valorTroco','Valor troco recebido'],
    ] as Array<[keyof FormPagamento,string]>).map(([campo,rotulo])=><label key={campo} className="text-sm font-semibold text-slate-700">{rotulo}
      <input type="number" inputMode="decimal" min="0" step="0.01" value={formPagamento[campo]} onChange={e=>alterarCampo(campo,e.target.value)} className={campoDinheiro}/>
    </label>)}
   </div>
   {calculoPagamento && <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
    <div className="flex justify-between gap-3"><span>Valor ajustado do título</span><b>{dinheiro(calculoPagamento.totalDevido)}</b></div>
    <div className="flex justify-between gap-3"><span>Pagamento líquido (entregue − troco)</span><b>{dinheiro(calculoPagamento.valorLiquido)}</b></div>
    <div className="flex justify-between gap-3 border-t pt-2"><span>Diferença para quitar</span><b className={calculoPagamento.diferenca===0?'text-emerald-700':'text-red-700'}>{dinheiro(calculoPagamento.diferenca)}</b></div>
    <button type="button" className="text-xs font-bold text-blue-700 underline" onClick={()=>alterarCampo('valorEntregue',Math.max(0,calculoPagamento.totalDevido+Number(formPagamento.valorTroco||0)).toFixed(2))}>Usar valor calculado para quitação</button>
    {!calculoPagamento.ok && <p role="alert" className="text-xs font-semibold text-red-700">{calculoPagamento.erro}</p>}
   </div>}
   {erro && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{erro}</p>}
   <div className="mt-5 flex justify-end gap-2">
    <button type="button" disabled={!!acao} onClick={()=>setModalPagamento(null)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button>
    <button type="button" disabled={!!acao||!calculoPagamento?.ok||!formPagamento.dataPagamento} onClick={()=>void confirmarPagamento()} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">
     {acao?'Processando...':'Confirmar pagamento'}
    </button>
   </div>
  </section>
 </div>}
 </div></main>
}
function Card({t,v,destaque=false}:{t:string;v:string;destaque?:boolean}){return <div className="rounded-2xl border bg-white p-5"><div className="text-sm text-slate-500">{t}</div><div className={`mt-1 text-2xl font-bold ${destaque?'text-red-700':''}`}>{v}</div></div>}
