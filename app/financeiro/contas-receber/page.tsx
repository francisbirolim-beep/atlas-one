'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, WalletCards } from 'lucide-react'
import BarraFiltrosPeriodo from '@/components/financeiro/BarraFiltrosPeriodo'
import FormLancamentoManual from '@/components/financeiro/FormLancamentoManual'
import {baixarCSV,csvFinanceiro,isoLocal,noPeriodo,periodoRapido,type PeriodoFinanceiro} from '@/lib/financeiroPeriodo'
import { tokenAtual } from '@/lib/auth'
import type { ContaReceberCliente360 } from '@/lib/cliente360'
import { saldoParcela } from '@/lib/cliente360Recebimentos'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

type RecebimentoGeral = { id:string; cliente_id?:string|null; cliente_nome?:string|null; obra_id?:string|null; data_recebimento?:string|null; valor?:number|null; valor_desconto?:number|null; forma?:string|null; referencia?:string|null; observacoes?:string|null; status?:string|null; criado_por_nome?:string|null; created_at?:string|null; desconto?:number }

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return '—'
  const base = valor.length === 10 ? `${valor}T12:00:00` : valor
  const d = new Date(base)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function dataHoraBR(valor?: string | null) {
  if (!valor) return '—'
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceberCliente360[]>([])
  const [recebimentos, setRecebimentos] = useState<RecebimentoGeral[]>([])
  const [nomesObras,setNomesObras]=useState<Record<string,string>>({})
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'aberto' | 'vencido' | 'pago' | 'todos'>('aberto')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [periodo,setPeriodo]=useState<PeriodoFinanceiro>(()=>periodoRapido('todos'))
  const [clienteFiltro,setClienteFiltro]=useState('')
  const [obraFiltro,setObraFiltro]=useState('')
  const [dataBase,setDataBase]=useState<'vencimento'|'pagamento'>('vencimento')
  const [agrupar,setAgrupar]=useState(false)

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const token=await tokenAtual()
      if(!token)throw new Error('Sessão expirada. Entre novamente no Atlas.')
      const r=await fetch('/api/financeiro/contas-receber',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'})
      const dados=await r.json()
      if(!r.ok)throw new Error(dados.error||'Erro ao consultar os títulos.')
      setContas((dados.contas||[]) as ContaReceberCliente360[])
      setRecebimentos((dados.recebimentos||[]) as RecebimentoGeral[])
      setNomesObras(dados.nomesObras||{})
    } catch(e){
      setErro(e instanceof Error?e.message:'Não foi possível carregar as contas a receber.')
      setContas([])
      setRecebimentos([])
    } finally{setCarregando(false)}
  }

  useEffect(() => { void carregar() }, [])

  const hoje = isoLocal(new Date())
  const clientesDisponiveis=[...new Map(contas.filter(c=>c.cliente_id).map(c=>[c.cliente_id!,c.cliente_nome||'Cliente'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'))
  const obrasDisponiveis=[...new Set(contas.filter(c=>!clienteFiltro||c.cliente_id===clienteFiltro).map(c=>c.obra_id).filter((v):v is string=>!!v))]

  const resumo = useMemo(() => {
    const base=contas.filter(c=>(!clienteFiltro||c.cliente_id===clienteFiltro)&&(!obraFiltro||c.obra_id===obraFiltro)&&noPeriodo(dataBase==='pagamento'?c.data_pagamento:c.vencimento,periodo.inicio,periodo.fim))
    const abertas = base.filter(c => c.status !== 'pago' && c.status !== 'cancelado')
    const recebido = base.reduce((s, c) => s + Number(c.valor_pago || 0), 0)
    const aberto = abertas.reduce((s, c) => s + saldoParcela(c), 0)
    const vencido = abertas
      .filter(c => c.vencimento && c.vencimento < hoje)
      .reduce((s, c) => s + saldoParcela(c), 0)
    return { aberto, vencido, recebido }
  }, [contas, hoje,clienteFiltro,obraFiltro,periodo,dataBase])

  const filtradas = useMemo(() => contas.filter(conta => {
    const saldo = saldoParcela(conta)
    const vencida = conta.status !== 'pago' && conta.status !== 'cancelado' && !!conta.vencimento && conta.vencimento < hoje
    const bateFiltro =
      filtro === 'todos' ||
      (filtro === 'pago' && (conta.status === 'pago' || saldo <= 0.009)) ||
      (filtro === 'vencido' && vencida) ||
      (filtro === 'aberto' && conta.status !== 'pago' && conta.status !== 'cancelado' && saldo > 0.009)

    return bateFiltro && (!clienteFiltro||conta.cliente_id===clienteFiltro) && (!obraFiltro||conta.obra_id===obraFiltro) && noPeriodo(dataBase==='pagamento'?conta.data_pagamento:conta.vencimento,periodo.inicio,periodo.fim) && correspondeBuscaAtlas(busca, conta.cliente_nome, conta.documento, conta.forma, conta.observacoes, conta.status)
  }), [busca, contas, filtro, hoje, clienteFiltro,obraFiltro,periodo,dataBase])

  const recebimentosFiltrados = useMemo(() => recebimentos.filter(r =>
    (!clienteFiltro||r.cliente_id===clienteFiltro) && (!obraFiltro||r.obra_id===obraFiltro) && noPeriodo(r.data_recebimento,periodo.inicio,periodo.fim) &&
    correspondeBuscaAtlas(busca, r.cliente_nome, r.forma, r.referencia, r.observacoes, r.criado_por_nome, r.status)
  ), [busca, recebimentos,clienteFiltro,obraFiltro,periodo])
  const exibidas=useMemo(()=>agrupar?[...filtradas].sort((a,b)=>(a.cliente_nome||'').localeCompare(b.cliente_nome||'','pt-BR')||(a.vencimento||'').localeCompare(b.vencimento||'')):filtradas,[filtradas,agrupar])
  const valorFiltrado=filtradas.reduce((s,c)=>s+Number(c.valor||0),0)
  const saldoFiltrado=filtradas.reduce((s,c)=>s+saldoParcela(c),0)
  const exportar=()=>baixarCSV('atlas-contas-a-receber.csv',csvFinanceiro([
    ['Contas a receber','De',periodo.inicio||'Todos','Até',periodo.fim||'Todos'],
    ['Cliente','Obra ID','Documento','Parcela','Total parcelas','Vencimento','Data pagamento','Forma','Valor','Desconto','Saldo','Status'],
    ...filtradas.map(c=>[c.cliente_nome,c.obra_id?(nomesObras[c.obra_id]||c.obra_id):'',c.documento,c.parcela,c.total_parcelas,dataBR(c.vencimento),dataBR(c.data_pagamento),c.forma,Number(c.valor||0),Number(c.valor_desconto||0),saldoParcela(c),c.status]),
    ['TOTAL','','','','','','','',valorFiltrado,'',saldoFiltrado,''],
    [],['RECEBIMENTOS REGISTRADOS NO PERÍODO'],
    ['Data recebimento','Cliente','Forma','Valor efetivo','Desconto','Referência'],
    ...recebimentosFiltrados.map(r=>[dataBR(r.data_recebimento),r.cliente_nome,r.forma,Number(r.valor||0),Number(r.desconto||0),r.referencia]),
    ['TOTAL RECEBIDO','','',recebimentosFiltrados.reduce((a,r)=>a+Number(r.valor||0),0)]
  ]))

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <style jsx global>{`@media print{@page{size:A4 landscape;margin:10mm}nav,aside,.no-print{display:none!important}main{padding:0!important;background:white!important}table{font-size:10px!important}}`}</style>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Financeiro</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Contas a Receber</h1>
            <p className="mt-1 text-sm text-slate-600">Parcelas de clientes, obras e vendas registradas no Atlas.</p>
          </div>
          <div className="no-print flex flex-wrap items-center gap-2"><FormLancamentoManual tipo="receber" onSalvo={()=>void carregar()}/><button onClick={() => void carregar()} className="rounded-xl border bg-white p-2.5 text-slate-600" title="Atualizar"><RefreshCw size={18}/></button></div>
        </header>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

        <BarraFiltrosPeriodo periodo={periodo} onPeriodo={setPeriodo} onExportar={exportar} adicional={<>
          <label className="text-xs font-semibold text-slate-600">Cliente<select className="mt-1 block max-w-[220px] rounded-lg border p-2.5 text-sm" value={clienteFiltro} onChange={e=>{setClienteFiltro(e.target.value);setObraFiltro('')}}><option value="">Todos os clientes</option>{clientesDisponiveis.map(([id,nome])=><option key={id} value={id}>{nome}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Obra<select className="mt-1 block max-w-[180px] rounded-lg border p-2.5 text-sm" value={obraFiltro} onChange={e=>setObraFiltro(e.target.value)}><option value="">Todas as obras</option>{obrasDisponiveis.map(id=><option key={id} value={id}>{nomesObras[id]||`Obra ${id.slice(0,8)}`}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Data do período<select className="mt-1 block rounded-lg border p-2.5 text-sm" value={dataBase} onChange={e=>setDataBase(e.target.value as 'vencimento'|'pagamento')}><option value="vencimento">Vencimento</option><option value="pagamento">Pagamento efetivo</option></select></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><input type="checkbox" checked={agrupar} onChange={e=>setAgrupar(e.target.checked)}/>Agrupar por cliente</label>
        </>}/>
        <section className="grid gap-3 sm:grid-cols-3">
          <Card titulo="Em aberto no período" valor={moeda(resumo.aberto)} />
          <Card titulo="Vencido no período" valor={moeda(resumo.vencido)} destaque />
          <Card titulo={dataBase==='pagamento'?'Recebido efetivamente no período':'Recebido nos títulos filtrados'} valor={moeda(dataBase==='pagamento'?recebimentosFiltrados.reduce((s,r)=>s+Number(r.valor||0),0):resumo.recebido)} />
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, documento, forma de pagamento..." className="w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"/>
            </div>
            <div className="flex flex-wrap gap-2">
              {([['aberto','Em aberto'],['vencido','Vencidas'],['pago','Pagas'],['todos','Todas']] as const).map(([id,label]) => (
                <button key={id} onClick={() => setFiltro(id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filtro === id ? 'bg-slate-900 text-white' : 'border bg-white text-slate-600'}`}>{label}</button>
              ))}
            </div>
          </div>

          {carregando ? (
            <div className="py-12 text-center text-sm text-slate-400">Carregando contas a receber...</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                    <th className="p-3">Cliente</th><th className="p-3">Documento</th><th className="p-3">Parcela</th><th className="p-3">Vencimento</th><th className="p-3">Forma</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">Desconto</th><th className="p-3 text-right">Saldo</th><th className="p-3">Status</th><th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {exibidas.map((conta,i) => {
                    const saldo = saldoParcela(conta)
                    const vencida = conta.status !== 'pago' && conta.status !== 'cancelado' && !!conta.vencimento && conta.vencimento < hoje
                    return (
                      <tr key={conta.id} className="border-b last:border-0">
                        <td className="p-3 font-semibold text-slate-800">{conta.cliente_nome || 'Cliente'}{agrupar&&exibidas.findIndex(c=>c.cliente_id===conta.cliente_id)===i&&<span className="block text-[10px] font-semibold text-blue-700">Subtotal do cliente: {moeda(exibidas.filter(c=>c.cliente_id===conta.cliente_id).reduce((s,c)=>s+Number(c.valor||0),0))}</span>}{conta.obra_id&&<span className="block text-[10px] text-slate-500">{nomesObras[conta.obra_id]||`Obra ${conta.obra_id.slice(0,8)}`}</span>}</td>
                        <td className="p-3 text-slate-600">{conta.documento || '—'}</td>
                        <td className="p-3">{conta.parcela}/{conta.total_parcelas}</td>
                        <td className={`p-3 ${vencida ? 'font-semibold text-red-600' : ''}`}>{dataBR(conta.vencimento)}</td>
                        <td className="p-3 capitalize">{(conta.forma || '—').replaceAll('_',' ')}</td>
                        <td className="p-3 text-right font-semibold">{moeda(Number(conta.valor || 0))}</td>
                        <td className="p-3 text-right font-semibold text-amber-700">{moeda(Number(conta.valor_desconto || 0))}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{moeda(saldo)}</td>
                        <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${conta.status === 'pago' || saldo <= 0.009 ? 'bg-emerald-100 text-emerald-700' : vencida ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{conta.status === 'pago' || saldo <= 0.009 ? 'pago' : vencida ? 'vencido' : conta.status}</span></td>
                        <td className="p-3 text-right">
                          {conta.cliente_id && saldo > 0.009 && conta.status !== 'cancelado' ? (
                            <Link href={`/clientes/${conta.cliente_id}/financeiro/recebimento`} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">Receber</Link>
                          ) : conta.cliente_id ? (
                            <Link href={`/clientes/${conta.cliente_id}`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600">Cliente</Link>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              <tfoot><tr className="bg-slate-50 font-bold"><td colSpan={5} className="p-3">TOTAL DO RELATÓRIO</td><td className="p-3 text-right">{moeda(valorFiltrado)}</td><td colSpan={1}/><td className="p-3 text-right">{moeda(saldoFiltrado)}</td><td colSpan={2}/></tr></tfoot></table>
              {!filtradas.length && <div className="py-10 text-center text-sm text-slate-400"><WalletCards className="mx-auto mb-2"/>Nenhuma conta encontrada neste filtro.</div>}
            </div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">Financeiro geral</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Histórico de recebimentos</h2>
            <p className="mt-1 text-sm text-slate-500">Entradas registradas no Atlas, com data real do recebimento, forma de pagamento e descontos separados do caixa.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs text-slate-500">
                  <th className="p-3">Data recebimento</th><th className="p-3">Cliente</th><th className="p-3">Forma</th><th className="p-3 text-right">Recebido</th><th className="p-3 text-right">Desconto</th><th className="p-3 text-right">Total baixado</th><th className="p-3">Referência</th><th className="p-3">Registrado no Atlas</th><th className="p-3">Responsável</th><th className="no-print p-3">Recibo</th>
                </tr>
              </thead>
              <tbody>
                {recebimentosFiltrados.map(r => {
                  const desconto=Number(r.desconto||0)
                  return <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-semibold text-slate-800">{dataBR(r.data_recebimento)}</td>
                    <td className="p-3">{r.cliente_id?<Link href={`/clientes/${r.cliente_id}`} className="font-semibold text-brand-navy hover:underline">{r.cliente_nome||'Cliente'}</Link>:(r.cliente_nome||'Cliente')}</td>
                    <td className="p-3 uppercase">{r.forma||'—'}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700">{moeda(Number(r.valor||0))}</td>
                    <td className="p-3 text-right font-semibold text-amber-700">{moeda(desconto)}</td>
                    <td className="p-3 text-right font-bold text-slate-900">{moeda(Number(r.valor||0)+desconto)}</td>
                    <td className="p-3 text-slate-600">{r.referencia||'—'}</td>
                    <td className="p-3 text-slate-500">{dataHoraBR(r.created_at)}</td>
                    <td className="p-3 text-slate-600">{r.criado_por_nome||'—'}</td><td className="no-print p-3"><Link target="_blank" href={`/financeiro/recibo/receber/${r.id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold">Imprimir recibo</Link></td>
                  </tr>
                })}
              </tbody>
            </table>
            {!recebimentosFiltrados.length && <div className="py-10 text-center text-sm text-slate-400"><WalletCards className="mx-auto mb-2"/>Nenhum recebimento encontrado.</div>}
          </div>
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-5 ${destaque ? 'border-red-200' : ''}`}><div className="text-sm text-slate-500">{titulo}</div><div className={`mt-1 text-2xl font-bold ${destaque ? 'text-red-600' : 'text-slate-900'}`}>{valor}</div></div>
}
