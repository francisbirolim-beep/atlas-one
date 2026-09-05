'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Receipt, Wallet } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { listarContasReceberCliente, listarObrasCliente, type ContaReceberCliente360, type ObraCliente360 } from '@/lib/cliente360'
import { registrarRecebimentoPorParcelas, saldoParcela } from '@/lib/cliente360Recebimentos'
import type { Cliente } from '@/lib/tipos'

function moeda(valor: number) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBR(valor?: string | null) {
  if (!valor) return '—'
  const data = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor)
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleDateString('pt-BR')
}

export default function RecebimentoPorParcelasPage() {
  const params = useParams()
  const clienteId = params?.id as string
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [contas, setContas] = useState<ContaReceberCliente360[]>([])
  const [obras, setObras] = useState<ObraCliente360[]>([])
  const [selecionadas, setSelecionadas] = useState<Record<string, string>>({})
  const [forma, setForma] = useState('pix')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [referencia, setReferencia] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  async function carregar() {
    if (!clienteId) return
    setCarregando(true)
    setErro('')
    const [c, cr, os] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', clienteId).maybeSingle(),
      listarContasReceberCliente(clienteId),
      listarObrasCliente(clienteId),
    ])
    if (c.error || !c.data) {
      setErro('Cliente não encontrado.')
      setCarregando(false)
      return
    }
    setCliente(c.data as Cliente)
    setContas(cr.filter(item => item.status !== 'cancelado' && saldoParcela(item) > 0.009))
    setObras(os)
    setCarregando(false)
  }

  useEffect(() => { void carregar() }, [clienteId])

  const obraPorId = useMemo(() => Object.fromEntries(obras.map(o => [o.id, o.nome])), [obras])
  const total = useMemo(() => Object.values(selecionadas).reduce((s, valor) => s + (Number(String(valor).replace(',', '.')) || 0), 0), [selecionadas])
  const vencidas = contas.filter(c => c.vencimento && c.vencimento < new Date().toISOString().slice(0, 10))

  function alternar(conta: ContaReceberCliente360) {
    setSelecionadas(atual => {
      const proximo = { ...atual }
      if (conta.id in proximo) delete proximo[conta.id]
      else proximo[conta.id] = saldoParcela(conta).toFixed(2).replace('.', ',')
      return proximo
    })
  }

  function selecionar(lista: ContaReceberCliente360[]) {
    const valores: Record<string, string> = {}
    lista.forEach(c => { valores[c.id] = saldoParcela(c).toFixed(2).replace('.', ',') })
    setSelecionadas(valores)
  }

  async function salvar() {
    if (!cliente) return
    setErro('')
    setSucesso('')

    const alocacoes = Object.entries(selecionadas).map(([conta_receber_id, valorTexto]) => ({
      conta_receber_id,
      valor: Number(valorTexto.replace(',', '.')),
    }))

    for (const item of alocacoes) {
      const conta = contas.find(c => c.id === item.conta_receber_id)
      if (!conta || !Number.isFinite(item.valor) || item.valor <= 0 || item.valor > saldoParcela(conta) + 0.009) {
        setErro('Revise os valores das parcelas selecionadas.')
        return
      }
    }

    setSalvando(true)
    const resultado = await registrarRecebimentoPorParcelas({
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      dataRecebimento: data,
      forma,
      referencia,
      observacoes,
      alocacoes,
    })
    setSalvando(false)

    if (!resultado.ok) {
      setErro(resultado.error || 'Não foi possível registrar o recebimento.')
      return
    }

    setSucesso(`Recebimento de ${moeda(resultado.valor || total)} registrado em ${resultado.parcelas || alocacoes.length} parcela(s).`)
    setSelecionadas({})
    setReferencia('')
    setObservacoes('')
    await carregar()
  }

  if (carregando) return <div className="min-h-screen bg-slate-50 p-8 text-slate-400">Carregando financeiro do cliente...</div>

  return <div className="min-h-screen bg-slate-50">
    <header className="border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-5">
        <Link href={`/clientes/${clienteId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft size={16}/> Voltar ao Cliente 360</Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Wallet size={22}/></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Receber por parcelas</h1><p className="text-sm text-slate-500">{cliente?.nome}</p></div>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}
      {sucesso && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 size={17}/>{sucesso}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Data<input type="date" value={data} onChange={e => setData(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
          <label className="text-sm font-medium text-slate-700">Forma<select value={forma} onChange={e => setForma(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option><option value="outro">Outro</option></select></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Referência / comprovante<input value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="Ex.: PIX 05/09 ou nº do comprovante" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Observações<textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"/></label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-slate-900">Parcelas em aberto</h2><p className="text-xs text-slate-500">Escolha uma ou várias parcelas e informe quanto entrou em cada uma.</p></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => selecionar(vencidas)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar vencidas</button><button onClick={() => selecionar(contas)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Selecionar todas</button><button onClick={() => setSelecionadas({})} className="rounded-lg border px-3 py-2 text-xs font-semibold">Limpar</button></div>
        </div>

        <div className="divide-y divide-slate-100">
          {contas.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Este cliente não possui parcelas em aberto.</p>}
          {contas.map(conta => {
            const marcada = conta.id in selecionadas
            const valorSaldo = saldoParcela(conta)
            return <div key={conta.id} className={`grid gap-3 p-4 md:grid-cols-[28px_1fr_170px] md:items-center ${marcada ? 'bg-blue-50/40' : ''}`}>
              <input type="checkbox" checked={marcada} onChange={() => alternar(conta)} className="h-4 w-4"/>
              <button type="button" onClick={() => alternar(conta)} className="text-left">
                <p className="font-semibold text-slate-800">{conta.documento || `Parcela ${conta.parcela}/${conta.total_parcelas}`}</p>
                <p className="mt-1 text-xs text-slate-500">Vence {dataBR(conta.vencimento)} · {conta.obra_id && obraPorId[conta.obra_id] ? obraPorId[conta.obra_id] : 'Sem obra'} · saldo {moeda(valorSaldo)}</p>
              </button>
              <div><label className="text-[11px] font-bold uppercase text-slate-400">Valor recebido</label><input disabled={!marcada} value={selecionadas[conta.id] || ''} onChange={e => setSelecionadas(s => ({ ...s, [conta.id]: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-right font-semibold disabled:bg-slate-100"/></div>
            </div>
          })}
        </div>
      </section>

      <section className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase text-slate-400">Total deste recebimento</p><p className="text-2xl font-bold text-emerald-700">{moeda(total)}</p><p className="text-xs text-slate-500">{Object.keys(selecionadas).length} parcela(s) selecionada(s)</p></div><button disabled={salvando || total <= 0 || !Object.keys(selecionadas).length} onClick={salvar} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-5 py-3 font-bold text-white disabled:opacity-40"><Receipt size={18}/>{salvando ? 'Registrando...' : 'Confirmar recebimento'}</button></div>
      </section>
    </main>
  </div>
}
