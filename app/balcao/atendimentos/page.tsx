'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, RefreshCw, Truck } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Origem = {
  localId: string
  localCodigo: string
  localNome: string
  unidadeId: string
  unidadeNome: string
  unidadeCodigo: string
}

type Venda = {
  id: string
  numero: number
  clienteNome: string
  vendedorNome: string
  atendimentoStatus: string
  previsaoEntrega?: string | null
  finalizadaEm: string
  unidadeNome?: string | null
  unidadeCodigo?: string | null
}

type Atendimento = {
  id: string
  venda_id: string
  produto_id: string
  produto_codigo?: string | null
  produto_nome: string
  unidade?: string | null
  quantidade: number
  atendimento_status: 'reservado_outra_unidade' | 'separando' | 'em_entrega'
  separado_em?: string | null
  separado_por_nome?: string | null
  enviado_em?: string | null
  enviado_por_nome?: string | null
  atendimento_observacoes?: string | null
  venda: Venda | null
  origem: Origem | null
}

type LocalFiltro = { id: string; codigo: string; nome: string; unidadeNome: string; unidadeCodigo: string }

const statusInfo: Record<string, { label: string; classe: string }> = {
  reservado_outra_unidade: { label: 'Aguardando separação', classe: 'bg-amber-50 text-amber-700 border-amber-200' },
  separando: { label: 'Separando', classe: 'bg-sky-50 text-sky-700 border-sky-200' },
  em_entrega: { label: 'Em entrega', classe: 'bg-violet-50 text-violet-700 border-violet-200' },
}

function dataHora(valor?: string | null) {
  if (!valor) return '—'
  return new Date(valor).toLocaleString('pt-BR')
}

export default function AtendimentosBalcaoPage() {
  const [lista, setLista] = useState<Atendimento[]>([])
  const [locais, setLocais] = useState<LocalFiltro[]>([])
  const [localId, setLocalId] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  async function api(url: string, init?: RequestInit) {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão expirada.')
    return fetch(url, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } })
  }

  async function carregar(filtro = localId) {
    setCarregando(true)
    setErro('')
    try {
      const sufixo = filtro ? `?localId=${encodeURIComponent(filtro)}` : ''
      const resp = await api(`/api/balcao/atendimentos${sufixo}`)
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Não foi possível carregar os atendimentos.')
      setLista(json.atendimentos || [])
      setLocais(json.locais || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar atendimentos.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar('') }, [])
  useEffect(() => { carregar(localId) }, [localId])

  async function avancar(item: Atendimento, acao: 'separar' | 'enviar' | 'entregar') {
    setProcessando(item.id)
    setErro('')
    setMensagem('')
    try {
      const resp = await api('/api/balcao/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, acao }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Não foi possível avançar o atendimento.')
      const texto = acao === 'separar'
        ? 'Item enviado para separação.'
        : acao === 'enviar'
          ? 'Item marcado como em entrega e estoque baixado da origem.'
          : 'Entrega confirmada.'
      setMensagem(`Venda #${item.venda?.numero || ''}: ${texto}`)
      await carregar(localId)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao avançar atendimento.')
    } finally {
      setProcessando(null)
    }
  }

  const contagens = useMemo(() => ({
    reservado: lista.filter(i => i.atendimento_status === 'reservado_outra_unidade').length,
    separando: lista.filter(i => i.atendimento_status === 'separando').length,
    entrega: lista.filter(i => i.atendimento_status === 'em_entrega').length,
  }), [lista])

  return <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/balcao" className="rounded-lg border bg-white p-2"><ArrowLeft size={18}/></Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.15em] text-slate-400">Venda Balcão</p>
            <h1 className="text-2xl font-bold">Atendimentos pendentes</h1>
            <p className="text-sm text-slate-500">Reservas em outra unidade: separar, enviar e confirmar a entrega sem baixar estoque duas vezes.</p>
          </div>
        </div>
        <button onClick={() => carregar(localId)} className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={16}/>Atualizar</button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Resumo titulo="Aguardando separação" valor={contagens.reservado} icone={<PackageCheck size={20}/>} />
        <Resumo titulo="Separando" valor={contagens.separando} icone={<PackageCheck size={20}/>} />
        <Resumo titulo="Em entrega" valor={contagens.entrega} icone={<Truck size={20}/>} />
      </section>

      <section className="rounded-2xl border bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtrar unidade / estoque de origem</label>
        <select value={localId} onChange={e => setLocalId(e.target.value)} className="mt-1 w-full max-w-xl rounded-xl border px-3 py-2.5 text-sm">
          <option value="">Todas as origens</option>
          {locais.map(l => <option key={l.id} value={l.id}>{l.unidadeNome} • {l.nome}</option>)}
        </select>
      </section>

      {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}
      {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{mensagem}</div>}

      <section className="rounded-2xl border bg-white p-4">
        {carregando ? <div className="py-12 text-center text-slate-400"><Loader2 className="mx-auto animate-spin"/><p className="mt-2 text-sm">Carregando fila...</p></div>
          : lista.length === 0 ? <div className="py-12 text-center"><CheckCircle2 size={42} className="mx-auto text-emerald-600"/><h2 className="mt-3 font-bold">Nenhum atendimento pendente</h2><p className="text-sm text-slate-500">Todas as vendas reservadas em outras unidades já foram concluídas.</p></div>
          : <div className="space-y-3">{lista.map(item => {
            const info = statusInfo[item.atendimento_status]
            return <article key={item.id} className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-lg">Venda #{item.venda?.numero || '—'}</strong>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${info.classe}`}>{info.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{item.venda?.clienteNome || 'Cliente balcão'} • vendedor {item.venda?.vendedorNome || '—'}</p>
                  <p className="text-xs text-slate-400">Venda em {item.venda?.unidadeNome || 'unidade não informada'} • {dataHora(item.venda?.finalizadaEm)}</p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-slate-700">Origem</div>
                  <div>{item.origem?.unidadeNome || '—'} • {item.origem?.localNome || '—'}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_auto]">
                <div>
                  <div className="font-semibold">{item.produto_codigo || '—'} — {item.produto_nome}</div>
                  <div className="mt-1 text-sm text-slate-500">Quantidade: <strong>{Number(item.quantidade)} {item.unidade || ''}</strong></div>
                  {item.separado_em && <div className="mt-1 text-xs text-slate-400">Separado: {dataHora(item.separado_em)} • {item.separado_por_nome || '—'}</div>}
                  {item.enviado_em && <div className="text-xs text-slate-400">Enviado: {dataHora(item.enviado_em)} • {item.enviado_por_nome || '—'}</div>}
                  {item.atendimento_observacoes && <div className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{item.atendimento_observacoes}</div>}
                </div>
                <div className="flex items-center">
                  {item.atendimento_status === 'reservado_outra_unidade' && <button disabled={processando === item.id} onClick={() => avancar(item, 'separar')} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><PackageCheck size={17}/>{processando === item.id ? 'Processando...' : 'Iniciar separação'}</button>}
                  {item.atendimento_status === 'separando' && <button disabled={processando === item.id} onClick={() => avancar(item, 'enviar')} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Truck size={17}/>{processando === item.id ? 'Processando...' : 'Marcar em entrega'}</button>}
                  {item.atendimento_status === 'em_entrega' && <button disabled={processando === item.id} onClick={() => avancar(item, 'entregar')} className="inline-flex min-w-48 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 size={17}/>{processando === item.id ? 'Processando...' : 'Confirmar entrega'}</button>}
                </div>
              </div>
            </article>
          })}</div>}
      </section>
    </div>
  </main>
}

function Resumo({ titulo, valor, icone }: { titulo: string; valor: number; icone: React.ReactNode }) {
  return <div className="rounded-2xl border bg-white p-4"><div className="text-emerald-700">{icone}</div><div className="mt-2 text-xs text-slate-500">{titulo}</div><div className="text-2xl font-bold">{valor}</div></div>
}
