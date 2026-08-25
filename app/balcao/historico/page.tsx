'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, RotateCcw, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Venda = {
  id: string
  numero: number
  status: string
  atendimento_status?: string | null
  cliente_nome?: string | null
  vendedor_nome: string
  subtotal: number
  desconto: number
  total: number
  finalizada_em: string
  local_estoque_id?: string | null
}

type ItemVenda = {
  id: string
  produto_codigo?: string | null
  produto_nome: string
  unidade?: string | null
  quantidade: number
  preco_unitario: number
  total_item: number
  local_origem_id?: string | null
  atendimento_status?: string | null
  atendimento_observacoes?: string | null
}

type Pagamento = { id: string; forma: string; valor: number; parcelas: number }
type Evento = {
  id: string
  tipo: string
  status: string
  motivo: string
  observacoes?: string | null
  valor: number
  usuario_nome: string
  created_at: string
}
type EventoItem = { evento_id: string; venda_item_id: string; quantidade: number }
type LocalRetorno = { id: string; codigo?: string | null; nome: string }
type Detalhe = {
  venda: Venda
  itens: ItemVenda[]
  pagamentos: Pagamento[]
  eventos: Evento[]
  eventoItens: EventoItem[]
  locaisRetorno: LocalRetorno[]
  podeGerenciar: boolean
  caixaAbertoId?: string | null
}
type SelecaoItem = { quantidade: number; localRetornoId: string }
type TipoOperacao = 'cancelamento_total' | 'devolucao_parcial'

function moeda(n: number) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusAtendimento(s?: string | null): [string, string] {
  if (s === 'aguardando_separacao') return ['Aguardando separação', 'bg-amber-50 text-amber-700 border-amber-200']
  if (s === 'parcial') return ['Parcial', 'bg-sky-50 text-sky-700 border-sky-200']
  if (s === 'entregue') return ['Entregue', 'bg-emerald-50 text-emerald-700 border-emerald-200']
  if (s === 'cancelado') return ['Cancelado', 'bg-red-50 text-red-700 border-red-200']
  return [s || '—', 'bg-slate-50 text-slate-600 border-slate-200']
}

function statusVenda(s?: string | null) {
  if (s === 'cancelada') return 'Cancelada'
  if (s === 'devolvida_parcial') return 'Devolvida parcialmente'
  return 'Finalizada'
}

function statusItem(s?: string | null) {
  if (s === 'reservado_outra_unidade') return 'Aguardando separação'
  if (s === 'separando') return 'Separando'
  if (s === 'em_entrega') return 'Em entrega'
  if (s === 'entregue') return 'Entregue'
  if (s === 'cancelado') return 'Cancelado'
  return s || '—'
}

function tipoEvento(t: string) {
  const nomes: Record<string, string> = {
    cancelamento_total: 'Cancelamento total',
    devolucao_parcial: 'Devolução parcial',
    reembolso_pendente: 'Reembolso pendente',
    reembolso_concluido: 'Reembolso concluído',
  }
  return nomes[t] || t
}

export default function Historico() {
  const [q, setQ] = useState('')
  const [vendas, setVendas] = useState<Venda[]>([])
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
  const [erro, setErro] = useState('')
  const [operando, setOperando] = useState(false)
  const [abrirOperacao, setAbrirOperacao] = useState(false)
  const [tipo, setTipo] = useState<TipoOperacao>('devolucao_parcial')
  const [motivo, setMotivo] = useState('')
  const [obs, setObs] = useState('')
  const [reembolsarCaixa, setReembolsarCaixa] = useState(false)
  const [selecionados, setSelecionados] = useState<Record<string, SelecaoItem>>({})
  const [chaveOperacao, setChaveOperacao] = useState('')

  async function api(url: string, init?: RequestInit) {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão expirada.')
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init?.body) headers.set('Content-Type', 'application/json')
    return fetch(url, { ...init, headers, cache: 'no-store' })
  }

  async function carregar(busca = '') {
    try {
      const r = await api(`/api/balcao/vendas?q=${encodeURIComponent(busca)}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setVendas(j.vendas || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar vendas.')
    }
  }

  async function abrir(id: string) {
    try {
      setErro('')
      const r = await api(`/api/balcao/vendas?id=${id}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setDetalhe({
        ...j,
        itens: j.itens || [],
        pagamentos: j.pagamentos || [],
        eventos: j.eventos || [],
        eventoItens: j.eventoItens || [],
        locaisRetorno: j.locaisRetorno || [],
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar venda.')
    }
  }

  useEffect(() => { carregar() }, [])
  useEffect(() => {
    const h = setTimeout(() => carregar(q), 300)
    return () => clearTimeout(h)
  }, [q])

  const eventoValidoIds = useMemo(() => new Set(
    (detalhe?.eventos || [])
      .filter(e => e.status === 'concluido' && ['cancelamento_total', 'devolucao_parcial'].includes(e.tipo))
      .map(e => e.id),
  ), [detalhe])

  const devolvidoPorItem = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const item of detalhe?.eventoItens || []) {
      if (eventoValidoIds.has(item.evento_id)) {
        mapa[item.venda_item_id] = (mapa[item.venda_item_id] || 0) + Number(item.quantidade || 0)
      }
    }
    return mapa
  }, [detalhe, eventoValidoIds])

  const fatorLiquido = detalhe && Number(detalhe.venda.subtotal) > 0
    ? Number(detalhe.venda.total) / Number(detalhe.venda.subtotal)
    : 1

  const valorPrevisto = detalhe
    ? Object.entries(selecionados).reduce((soma, [id, selecao]) => {
        const item = detalhe.itens.find(i => i.id === id)
        return soma + (item ? Number(selecao.quantidade || 0) * Number(item.preco_unitario || 0) * fatorLiquido : 0)
      }, 0)
    : 0

  function iniciarOperacao() {
    if (!detalhe) return
    const base: Record<string, SelecaoItem> = {}
    for (const item of detalhe.itens) {
      base[item.id] = {
        quantidade: 0,
        localRetornoId: item.local_origem_id || detalhe.venda.local_estoque_id || detalhe.locaisRetorno[0]?.id || '',
      }
    }
    setSelecionados(base)
    setTipo('devolucao_parcial')
    setMotivo('')
    setObs('')
    setReembolsarCaixa(false)
    setChaveOperacao(globalThis.crypto?.randomUUID?.() || '')
    setAbrirOperacao(true)
  }

  async function confirmar() {
    if (!detalhe || operando) return
    try {
      setOperando(true)
      setErro('')
      const itens = Object.entries(selecionados)
        .filter(([, x]) => x.quantidade > 0)
        .map(([itemId, x]) => ({ itemId, ...x }))
      const r = await api('/api/balcao/vendas/cancelar-devolver', {
        method: 'POST',
        body: JSON.stringify({
          acao: 'cancelar_devolver',
          vendaId: detalhe.venda.id,
          tipo,
          motivo,
          observacoes: obs,
          itens,
          reembolsarCaixa,
          caixaId: detalhe.caixaAbertoId,
          chaveIdempotencia: chaveOperacao,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setAbrirOperacao(false)
      await abrir(detalhe.venda.id)
      await carregar(q)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao processar operação.')
    } finally {
      setOperando(false)
    }
  }

  async function concluirReembolso(evento: Evento, movimentarCaixa: boolean) {
    if (!detalhe || operando) return
    try {
      setOperando(true)
      setErro('')
      const r = await api('/api/balcao/vendas/cancelar-devolver', {
        method: 'POST',
        body: JSON.stringify({
          acao: 'concluir_reembolso',
          eventoId: evento.id,
          movimentarCaixa,
          caixaId: detalhe.caixaAbertoId,
          observacoes: movimentarCaixa ? 'Reembolso confirmado pelo caixa.' : 'Reembolso externo confirmado.',
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      await abrir(detalhe.venda.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao confirmar reembolso.')
    } finally {
      setOperando(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center gap-3">
          <Link href="/balcao" className="rounded-lg border bg-white p-2"><ArrowLeft size={18} /></Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p>
            <h1 className="text-2xl font-bold">Histórico de vendas</h1>
            <p className="text-sm text-slate-500">Consulta, atendimento, cancelamentos, devoluções e reembolsos.</p>
          </div>
        </header>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

        <section className="rounded-2xl border bg-white p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por número, cliente ou vendedor..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm" />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">Venda</th><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Status</th><th>Atendimento</th><th>Desconto</th><th>Total</th><th /></tr></thead>
              <tbody>{vendas.map(v => {
                const st = statusAtendimento(v.atendimento_status)
                return <tr key={v.id} className="border-t"><td className="p-3 font-bold">#{v.numero}</td><td>{new Date(v.finalizada_em).toLocaleString('pt-BR')}</td><td>{v.cliente_nome || 'Cliente balcão'}</td><td>{v.vendedor_nome}</td><td className="font-semibold">{statusVenda(v.status)}</td><td><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${st[1]}`}>{st[0]}</span></td><td>{moeda(v.desconto)}</td><td className="font-bold text-emerald-700">{moeda(v.total)}</td><td><button onClick={() => abrir(v.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Detalhes</button></td></tr>
              })}</tbody>
            </table>
          </div>
        </section>

        {detalhe && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetalhe(null)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between gap-3">
              <div><h2 className="text-xl font-bold">Venda #{detalhe.venda.numero}</h2><p className="text-sm text-slate-500">{detalhe.venda.cliente_nome || 'Cliente balcão'} • {new Date(detalhe.venda.finalizada_em).toLocaleString('pt-BR')}</p><div className="mt-2 flex gap-2"><span className="rounded-full border px-2 py-1 text-xs font-semibold">{statusVenda(detalhe.venda.status)}</span>{(() => { const st = statusAtendimento(detalhe.venda.atendimento_status); return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${st[1]}`}>{st[0]}</span> })()}</div></div>
              <div className="flex gap-2">{detalhe.podeGerenciar && detalhe.venda.status !== 'cancelada' && <button onClick={iniciarOperacao} className="inline-flex h-fit items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white"><RotateCcw size={16} />Cancelar / Devolver</button>}<button onClick={() => setDetalhe(null)} className="h-fit rounded-lg border px-3 py-2 text-sm">Fechar</button></div>
            </div>

            <div className="mt-4 space-y-2">{detalhe.itens.map(item => {
              const devolvido = Number(devolvidoPorItem[item.id] || 0)
              const restante = Math.max(0, Number(item.quantidade) - devolvido)
              return <div key={item.id} className="grid grid-cols-[1fr_auto] rounded-xl bg-slate-50 p-3 text-sm"><div><strong>{item.produto_codigo}</strong> — {item.produto_nome}<div className="text-xs text-slate-400">{item.quantidade} {item.unidade} × {moeda(item.preco_unitario)}</div><div className="mt-1 text-xs font-semibold text-slate-600">Atendimento: {statusItem(item.atendimento_status)}</div>{devolvido > 0 && <div className="mt-1 text-xs font-semibold text-amber-700">Devolvido/cancelado: {devolvido} • saldo líquido: {restante}</div>}{item.atendimento_observacoes && <div className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{item.atendimento_observacoes}</div>}</div><strong>{moeda(item.total_item)}</strong></div>
            })}</div>

            <div className="mt-4 rounded-xl border p-3"><div className="font-semibold">Pagamentos</div>{detalhe.pagamentos.map(p => <div key={p.id} className="mt-2 flex justify-between text-sm"><span className="capitalize">{String(p.forma).replaceAll('_', ' ')}{p.parcelas > 1 ? ` • ${p.parcelas}x` : ''}</span><strong>{moeda(p.valor)}</strong></div>)}</div>

            {detalhe.eventos.length > 0 && <div className="mt-4 rounded-xl border p-3"><div className="font-semibold">Eventos e devoluções</div><div className="mt-2 space-y-2">{detalhe.eventos.map(evento => <div key={evento.id} className={`rounded-lg border p-3 text-sm ${evento.status === 'pendente' ? 'border-amber-200 bg-amber-50' : 'bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><div><strong>{tipoEvento(evento.tipo)}</strong> • {evento.status}<div className="text-xs text-slate-500">{new Date(evento.created_at).toLocaleString('pt-BR')} • {evento.usuario_nome}</div><div className="mt-1">{evento.motivo}</div>{evento.observacoes && <div className="mt-1 text-xs text-slate-500">{evento.observacoes}</div>}</div><strong>{moeda(evento.valor)}</strong></div>{evento.tipo === 'reembolso_pendente' && evento.status === 'pendente' && detalhe.podeGerenciar && <div className="mt-3 flex flex-wrap gap-2"><button disabled={operando} onClick={() => concluirReembolso(evento, false)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold">Confirmar reembolso externo</button><button disabled={operando || !detalhe.caixaAbertoId} onClick={() => concluirReembolso(evento, true)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Reembolsar pelo caixa</button></div>}</div>)}</div></div>}

            <div className="mt-4 flex justify-between border-t pt-3 text-lg"><strong>Total original</strong><strong className="text-emerald-700">{moeda(detalhe.venda.total)}</strong></div>
          </div>
        </div>}

        {detalhe && abrirOperacao && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">Cancelar / Devolver venda #{detalhe.venda.numero}</h2><p className="text-sm text-slate-500">A venda original será preservada e todos os efeitos serão registrados.</p></div><button onClick={() => setAbrirOperacao(false)} className="rounded-lg border px-3 py-1.5 text-sm">Fechar</button></div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={() => setTipo('devolucao_parcial')} className={`rounded-xl border p-3 text-left ${tipo === 'devolucao_parcial' ? 'border-slate-900 bg-slate-50' : ''}`}><strong>Devolução parcial</strong><div className="text-xs text-slate-500">Escolha item e quantidade.</div></button><button onClick={() => setTipo('cancelamento_total')} className={`rounded-xl border p-3 text-left ${tipo === 'cancelamento_total' ? 'border-red-400 bg-red-50' : ''}`}><strong>Cancelamento total</strong><div className="text-xs text-slate-500">Cancela todo o saldo ainda ativo da venda.</div></button></div>

            {tipo === 'devolucao_parcial' && <div className="mt-4 space-y-2">{detalhe.itens.map(item => {
              const restante = Math.max(0, Number(item.quantidade) - Number(devolvidoPorItem[item.id] || 0))
              const bloqueado = ['reservado_outra_unidade', 'separando'].includes(String(item.atendimento_status || '')) || restante <= 0
              const x = selecionados[item.id] || { quantidade: 0, localRetornoId: '' }
              return <div key={item.id} className={`rounded-xl border p-3 ${bloqueado ? 'opacity-50' : ''}`}><div className="font-semibold">{item.produto_codigo} — {item.produto_nome}</div><div className="text-xs text-slate-500">Disponível para devolver: {restante} {item.unidade} • {statusItem(item.atendimento_status)}</div>{bloqueado ? <div className="mt-2 text-xs text-amber-700">Item reservado/separando: use cancelamento total ou conclua o atendimento.</div> : <div className="mt-2 grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-600">Quantidade<input type="number" min="0" max={restante} step="0.001" value={x.quantidade || ''} onChange={e => setSelecionados(s => ({ ...s, [item.id]: { ...x, quantidade: Math.min(restante, Math.max(0, Number(e.target.value || 0))) } }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><label className="text-xs text-slate-600">Local de retorno<select value={x.localRetornoId} onChange={e => setSelecionados(s => ({ ...s, [item.id]: { ...x, localRetornoId: e.target.value } }))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm">{detalhe.locaisRetorno.map(local => <option key={local.id} value={local.id}>{local.codigo ? `${local.codigo} — ` : ''}{local.nome}</option>)}</select></label></div>}</div>
            })}</div>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Motivo *<input value={motivo} onChange={e => setMotivo(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Ex.: cliente desistiu, produto incorreto..." /></label><label className="text-sm font-medium">Observações<textarea value={obs} onChange={e => setObs(e.target.value)} className="mt-1 min-h-20 w-full rounded-lg border px-3 py-2" /></label></div>

            <label className="mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={reembolsarCaixa} disabled={!detalhe.caixaAbertoId} onChange={e => setReembolsarCaixa(e.target.checked)} className="mt-1" /><span><strong>Efetuar agora o reembolso possível pelo caixa</strong><br /><span className="text-xs text-slate-500">Dinheiro/PIX/outros recebimentos elegíveis geram saída no caixa. Cartão ou saldo não reembolsável fica pendente para confirmação.</span>{!detalhe.caixaAbertoId && <span className="block text-xs text-amber-700">Não há caixa aberto para este usuário.</span>}</span></label>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><div className="flex gap-2"><AlertTriangle size={18} /><div><strong>Impacto antes de confirmar</strong><div className="mt-1">Estoque: mercadoria física retorna ao local escolhido; reservas ainda não baixadas são liberadas. Financeiro: títulos abertos são reduzidos/cancelados primeiro; valores já recebidos viram reembolso.</div>{tipo === 'devolucao_parcial' && <div className="mt-1 font-semibold">Valor líquido estimado da devolução: {moeda(valorPrevisto)}</div>}</div></div></div>

            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setAbrirOperacao(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button><button disabled={operando || !motivo.trim() || (tipo === 'devolucao_parcial' && valorPrevisto <= 0)} onClick={confirmar} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{operando ? 'Processando...' : 'Confirmar operação'}</button></div>
          </div>
        </div>}
      </div>
    </main>
  )
}
