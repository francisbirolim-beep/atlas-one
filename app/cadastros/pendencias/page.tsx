'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GitMerge,
  Loader2,
  Search,
  UserCheck,
  UserRoundSearch,
  Users,
  XCircle,
} from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type ClienteResumo = {
  id: string
  nome: string
  apelido?: string | null
  cpf_cnpj?: string | null
  whatsapp?: string | null
  telefone?: string | null
  email?: string | null
  cidade?: string | null
  bairro?: string | null
}

type Pendencia = {
  id: string
  tipo: 'cadastro_incompleto' | 'possivel_duplicidade' | 'vinculo_wvetro'
  status: 'pendente' | 'em_analise' | 'resolvida' | 'ignorada'
  prioridade: string
  titulo: string
  descricao: string | null
  origem: string
  cliente_id: string | null
  dados: Record<string, any>
  criado_em: string
  cliente: ClienteResumo | null
}

type Resumo = {
  total: number
  cadastro_incompleto: number
  possivel_duplicidade: number
  vinculo_wvetro: number
}

const vazio: Resumo = { total: 0, cadastro_incompleto: 0, possivel_duplicidade: 0, vinculo_wvetro: 0 }

function contato(cliente: ClienteResumo | null) {
  if (!cliente) return 'Sem cliente Atlas vinculado'
  return [cliente.cpf_cnpj, cliente.whatsapp || cliente.telefone, cliente.cidade].filter(Boolean).join(' • ') || 'Cadastro sem dados adicionais'
}

function rotuloTipo(tipo: Pendencia['tipo']) {
  if (tipo === 'cadastro_incompleto') return 'Completar cadastro'
  if (tipo === 'possivel_duplicidade') return 'Possível duplicidade'
  return 'Vínculo W.Vetro'
}

function classeTipo(tipo: Pendencia['tipo']) {
  if (tipo === 'cadastro_incompleto') return 'border-amber-200 bg-amber-50 text-amber-800'
  if (tipo === 'possivel_duplicidade') return 'border-violet-200 bg-violet-50 text-violet-800'
  return 'border-blue-200 bg-blue-50 text-blue-800'
}

export default function PendenciasCadastroPage() {
  const [pendencias, setPendencias] = useState<Pendencia[]>([])
  const [resumo, setResumo] = useState<Resumo>(vazio)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todas' | Pendencia['tipo']>('todas')
  const [aberta, setAberta] = useState<string | null>(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientes, setClientes] = useState<ClienteResumo[]>([])
  const [clienteEscolhido, setClienteEscolhido] = useState<ClienteResumo | null>(null)
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [processando, setProcessando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')

  async function chamar(url: string, init?: RequestInit) {
    const token = await tokenAtual()
    if (!token) throw new Error('Sessão do Atlas não encontrada. Entre novamente.')
    const resp = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      },
      cache: 'no-store',
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) throw new Error(json?.error || 'Não foi possível concluir a operação.')
    return json
  }

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const json = await chamar('/api/cadastros/pendencias?status=abertas')
      setPendencias(json.pendencias || [])
      setResumo(json.resumo || vazio)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar as pendências.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  useEffect(() => {
    if (!aberta || buscaCliente.trim().length < 2) {
      setClientes([])
      return
    }
    let ativo = true
    const timer = window.setTimeout(async () => {
      setBuscandoCliente(true)
      try {
        const json = await chamar(`/api/cadastros/pendencias?modo=clientes&busca=${encodeURIComponent(buscaCliente.trim())}`)
        if (ativo) setClientes(json.clientes || [])
      } catch {
        if (ativo) setClientes([])
      } finally {
        if (ativo) setBuscandoCliente(false)
      }
    }, 250)
    return () => { ativo = false; window.clearTimeout(timer) }
  }, [aberta, buscaCliente])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return pendencias.filter(p => {
      if (filtro !== 'todas' && p.tipo !== filtro) return false
      if (!q) return true
      const texto = [p.titulo, p.descricao, p.origem, p.cliente?.nome, p.cliente?.cpf_cnpj, p.cliente?.whatsapp, p.cliente?.telefone, p.cliente?.cidade]
        .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR')
      return texto.includes(q)
    })
  }, [pendencias, busca, filtro])

  function abrirSelecao(p: Pendencia) {
    setAberta(p.id)
    setClienteEscolhido(null)
    setClientes([])
    setBuscaCliente(p.cliente?.nome || String(p.dados?.nome || p.dados?.cliente_nome || ''))
    setMensagem('')
  }

  async function acao(p: Pendencia, nomeAcao: 'assumir' | 'resolver' | 'ignorar') {
    setProcessando(p.id)
    setErro('')
    try {
      await chamar('/api/cadastros/pendencias', {
        method: 'POST',
        body: JSON.stringify({ acao: nomeAcao, pendenciaId: p.id }),
      })
      setMensagem(nomeAcao === 'assumir' ? 'Pendência marcada como em análise.' : 'Pendência atualizada.')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar pendência.')
    } finally {
      setProcessando(null)
    }
  }

  async function confirmarVinculo(p: Pendencia) {
    if (!clienteEscolhido) return
    const eMesclagem = Boolean(p.cliente_id)
    if (eMesclagem) {
      const ok = window.confirm(
        `Mesclar "${p.cliente?.nome || p.titulo}" em "${clienteEscolhido.nome}"? Todos os vínculos serão transferidos para o cadastro escolhido.`,
      )
      if (!ok) return
    }

    setProcessando(p.id)
    setErro('')
    try {
      const json = await chamar('/api/cadastros/pendencias', {
        method: 'POST',
        body: JSON.stringify({
          acao: eMesclagem ? 'mesclar' : 'vincular_wvetro',
          pendenciaId: p.id,
          origemClienteId: p.cliente_id,
          destinoClienteId: clienteEscolhido.id,
        }),
      })
      setMensagem(eMesclagem
        ? `Cadastros mesclados. ${Number(json?.resultado?.vinculos_movidos || 0)} vínculo(s) transferido(s).`
        : `W.Vetro vinculado a ${clienteEscolhido.nome}.`)
      setAberta(null)
      setClienteEscolhido(null)
      setBuscaCliente('')
      await carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao vincular/mesclar.')
    } finally {
      setProcessando(null)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href="/clientes" className="mt-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50">
              <ArrowLeft size={18}/>
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-amber-600">Cadastro compartilhado</p>
              <h1 className="text-2xl font-bold text-slate-900">Pendências de clientes</h1>
              <p className="mt-1 text-sm text-slate-500">Fila da equipe para completar cadastro, validar duplicidade e vincular clientes do W.Vetro.</p>
            </div>
          </div>
          <button onClick={() => void carregar()} disabled={carregando} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            {carregando ? 'Atualizando...' : 'Atualizar'}
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Total aberto', resumo.total, 'todas' as const, Users],
            ['Completar cadastro', resumo.cadastro_incompleto, 'cadastro_incompleto' as const, UserCheck],
            ['Duplicidades', resumo.possivel_duplicidade, 'possivel_duplicidade' as const, GitMerge],
            ['Vínculos W.Vetro', resumo.vinculo_wvetro, 'vinculo_wvetro' as const, UserRoundSearch],
          ].map(([label, valor, tipo, Icon]: any) => (
            <button key={label} onClick={() => setFiltro(tipo)} className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:border-slate-300 ${filtro === tipo ? 'ring-2 ring-brand-navy/20' : ''}`}>
              <div className="flex items-center justify-between"><Icon size={18} className="text-brand-navy"/><strong className="text-2xl text-slate-900">{carregando ? '—' : valor}</strong></div>
              <p className="mt-2 text-sm font-semibold text-slate-700">{label}</p>
            </button>
          ))}
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente, telefone, CPF/CNPJ, cidade..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/>
            </div>
            <select value={filtro} onChange={e => setFiltro(e.target.value as any)} className="rounded-xl border px-3 py-2.5 text-sm">
              <option value="todas">Todas as pendências</option>
              <option value="cadastro_incompleto">Completar cadastro</option>
              <option value="possivel_duplicidade">Possível duplicidade</option>
              <option value="vinculo_wvetro">Vínculo W.Vetro</option>
            </select>
          </div>
        </section>

        {erro && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{erro}</div>}
        {mensagem && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{mensagem}</div>}

        {carregando ? (
          <div className="rounded-2xl border bg-white p-12 text-center text-slate-400"><Loader2 className="mx-auto mb-3 animate-spin" size={24}/>Carregando pendências...</div>
        ) : filtradas.length === 0 ? (
          <div className="rounded-2xl border bg-white p-12 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-emerald-500" size={32}/>
            <p className="font-semibold text-slate-700">Nenhuma pendência nesse filtro.</p>
            <p className="mt-1 text-sm text-slate-400">Quando o W.Vetro enviar dados incompletos ou surgir uma duplicidade, ela aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map(p => {
              const analisando = p.status === 'em_analise'
              const analisandoPor = String(p.dados?.analisando_por_nome || '')
              const ocupado = processando === p.id
              return (
                <article key={p.id} className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${classeTipo(p.tipo)}`}>{rotuloTipo(p.tipo)}</span>
                        {analisando && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{analisandoPor ? `Em análise por ${analisandoPor}` : 'Em análise'}</span>}
                        <span className="text-xs text-slate-400">{p.origem === 'W.Vetro' || p.origem === 'wvetro' ? 'Origem: W.Vetro' : `Origem: ${p.origem}`}</span>
                      </div>
                      <h2 className="mt-3 font-bold text-slate-900">{p.titulo}</h2>
                      {p.descricao && <p className="mt-1 text-sm text-slate-500">{p.descricao}</p>}

                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-800">{p.cliente?.nome || String(p.dados?.nome || p.dados?.cliente_nome || 'Cliente W.Vetro ainda sem vínculo')}</p>
                        <p className="mt-1 text-xs text-slate-500">{contato(p.cliente)}</p>
                        {p.dados?.numero_wvetro && <p className="mt-1 text-xs text-blue-600">Orçamento W.Vetro #{String(p.dados.numero_wvetro)}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                      {p.cliente_id && <Link href={`/clientes/${p.cliente_id}`} className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Abrir cadastro</Link>}
                      {!analisando && <button disabled={ocupado} onClick={() => void acao(p, 'assumir')} className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Vou validar</button>}
                      <button disabled={ocupado} onClick={() => abrirSelecao(p)} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                        {p.cliente_id ? <GitMerge size={13}/> : <UserRoundSearch size={13}/>}
                        {p.cliente_id ? 'Mesclar / vincular' : 'Vincular cliente'}
                      </button>
                      <button disabled={ocupado} onClick={() => void acao(p, 'resolver')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40">Revisado</button>
                      <button disabled={ocupado} onClick={() => void acao(p, 'ignorar')} title="Não mostrar novamente esta pendência" className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:text-red-600 disabled:opacity-40"><XCircle size={15}/></button>
                    </div>
                  </div>

                  {aberta === p.id && (
                    <div className="mt-4 border-t pt-4">
                      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                        {p.cliente_id
                          ? 'Escolha o cadastro principal. O Atlas transferirá orçamentos, obras, financeiro e demais vínculos antes de retirar o cadastro duplicado.'
                          : 'Procure o cliente correto no Atlas. O orçamento W.Vetro será vinculado a esse cadastro.'}
                      </div>
                      <div className="relative mt-3">
                        <Search size={15} className="absolute left-3 top-3 text-slate-400"/>
                        <input autoFocus value={buscaCliente} onChange={e => { setBuscaCliente(e.target.value); setClienteEscolhido(null) }} placeholder="Digite nome, CPF/CNPJ ou telefone..." className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm"/>
                        {buscandoCliente && <Loader2 size={15} className="absolute right-3 top-3 animate-spin text-slate-400"/>}
                      </div>

                      {clientes.length > 0 && !clienteEscolhido && (
                        <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border bg-white">
                          {clientes.filter(c => c.id !== p.cliente_id).map(c => (
                            <button key={c.id} onClick={() => setClienteEscolhido(c)} className="block w-full border-b px-3 py-3 text-left last:border-b-0 hover:bg-slate-50">
                              <strong className="block text-sm text-slate-800">{c.nome}</strong>
                              <span className="mt-0.5 block text-xs text-slate-400">{contato(c)}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {clienteEscolhido && (
                        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div><p className="text-xs font-semibold text-emerald-700">Cadastro principal escolhido</p><strong className="text-sm text-slate-900">{clienteEscolhido.nome}</strong><p className="text-xs text-slate-500">{contato(clienteEscolhido)}</p></div>
                          <div className="flex gap-2">
                            <button onClick={() => setClienteEscolhido(null)} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold">Trocar</button>
                            <button disabled={ocupado} onClick={() => void confirmarVinculo(p)} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">
                              {ocupado ? 'Processando...' : p.cliente_id ? 'Confirmar mesclagem' : 'Confirmar vínculo'}
                            </button>
                          </div>
                        </div>
                      )}

                      <button onClick={() => { setAberta(null); setClienteEscolhido(null); setClientes([]) }} className="mt-3 text-xs font-semibold text-slate-500">Cancelar</button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          <div className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0"/><p><strong>Regra:</strong> o Atlas não mescla pessoas só porque o nome é parecido. CPF/CNPJ ou contato confiável podem gerar vínculo seguro; casos duvidosos ficam nesta fila para validação humana.</p></div>
        </div>
      </div>
    </main>
  )
}
