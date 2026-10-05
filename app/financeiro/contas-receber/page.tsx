'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Search, WalletCards } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ContaReceberCliente360 } from '@/lib/cliente360'
import { saldoParcela } from '@/lib/cliente360Recebimentos'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return 'Sem vencimento'
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR')
}

export default function ContasReceberPage() {
  const [contas, setContas] = useState<ContaReceberCliente360[]>([])
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'aberto' | 'vencido' | 'pago' | 'todos'>('aberto')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    setErro('')
    const { data, error } = await supabase
      .from('financeiro_contas_receber')
      .select('*')
      .order('vencimento', { ascending: true, nullsFirst: false })
      .limit(1500)

    if (error) {
      setErro('Não foi possível carregar as contas a receber.')
      setContas([])
    } else {
      setContas((data || []) as ContaReceberCliente360[])
    }
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [])

  const hoje = new Date().toISOString().slice(0, 10)

  const resumo = useMemo(() => {
    const abertas = contas.filter(c => c.status !== 'pago' && c.status !== 'cancelado')
    const recebido = contas.reduce((s, c) => s + Number(c.valor_pago || 0), 0)
    const aberto = abertas.reduce((s, c) => s + saldoParcela(c), 0)
    const vencido = abertas
      .filter(c => c.vencimento && c.vencimento < hoje)
      .reduce((s, c) => s + saldoParcela(c), 0)
    return { aberto, vencido, recebido }
  }, [contas, hoje])

  const filtradas = useMemo(() => contas.filter(conta => {
    const saldo = saldoParcela(conta)
    const vencida = conta.status !== 'pago' && conta.status !== 'cancelado' && !!conta.vencimento && conta.vencimento < hoje
    const bateFiltro =
      filtro === 'todos' ||
      (filtro === 'pago' && (conta.status === 'pago' || saldo <= 0.009)) ||
      (filtro === 'vencido' && vencida) ||
      (filtro === 'aberto' && conta.status !== 'pago' && conta.status !== 'cancelado' && saldo > 0.009)

    return bateFiltro && correspondeBuscaAtlas(busca, conta.cliente_nome, conta.documento, conta.forma, conta.observacoes, conta.status)
  }), [busca, contas, filtro, hoje])

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">Financeiro</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Contas a Receber</h1>
            <p className="mt-1 text-sm text-slate-600">Parcelas de clientes, obras e vendas registradas no Atlas.</p>
          </div>
          <button onClick={() => void carregar()} className="rounded-xl border bg-white p-2.5 text-slate-600" title="Atualizar"><RefreshCw size={18}/></button>
        </header>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div>}

        <section className="grid gap-3 sm:grid-cols-3">
          <Card titulo="Em aberto" valor={moeda(resumo.aberto)} />
          <Card titulo="Vencido" valor={moeda(resumo.vencido)} destaque />
          <Card titulo="Já recebido" valor={moeda(resumo.recebido)} />
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
                    <th className="p-3">Cliente</th><th className="p-3">Documento</th><th className="p-3">Parcela</th><th className="p-3">Vencimento</th><th className="p-3">Forma</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">Saldo</th><th className="p-3">Status</th><th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(conta => {
                    const saldo = saldoParcela(conta)
                    const vencida = conta.status !== 'pago' && conta.status !== 'cancelado' && !!conta.vencimento && conta.vencimento < hoje
                    return (
                      <tr key={conta.id} className="border-b last:border-0">
                        <td className="p-3 font-semibold text-slate-800">{conta.cliente_nome || 'Cliente'}</td>
                        <td className="p-3 text-slate-600">{conta.documento || '—'}</td>
                        <td className="p-3">{conta.parcela}/{conta.total_parcelas}</td>
                        <td className={`p-3 ${vencida ? 'font-semibold text-red-600' : ''}`}>{dataBR(conta.vencimento)}</td>
                        <td className="p-3 capitalize">{(conta.forma || '—').replaceAll('_',' ')}</td>
                        <td className="p-3 text-right font-semibold">{moeda(Number(conta.valor || 0))}</td>
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
              </table>
              {!filtradas.length && <div className="py-10 text-center text-sm text-slate-400"><WalletCards className="mx-auto mb-2"/>Nenhuma conta encontrada neste filtro.</div>}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Card({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-5 ${destaque ? 'border-red-200' : ''}`}><div className="text-sm text-slate-500">{titulo}</div><div className={`mt-1 text-2xl font-bold ${destaque ? 'text-red-600' : 'text-slate-900'}`}>{valor}</div></div>
}
