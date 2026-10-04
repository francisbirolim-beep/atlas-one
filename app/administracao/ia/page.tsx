'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldX,
  Users,
} from 'lucide-react'
import { tokenAtual, usuarioAtual } from '@/lib/auth'

type Escopo = 'herdado' | 'nenhum' | 'proprio' | 'setor' | 'empresa'

type UsuarioResumo = {
  id: string
  nome: string
  email: string
  role: string
  perguntas30d: number
  sucessos30d: number
  erros30d: number
  bloqueios30d: number
  tokensEntrada30d: number
  tokensSaida30d: number
  custo30d: number
  contextos: Record<string, number>
  ultimaPerguntaEm: string | null
}

type Dados = {
  periodoDias: number
  resumo: {
    perguntas: number
    usuariosAtivos: number
    bloqueios: number
    erros: number
    custoEstimado: number
  }
  usuarios: UsuarioResumo[]
  acessos: Array<{ id: string; usuario_id: string; dominio: string; escopo: string; permitido: boolean }>
  interacoesRecentes: Array<{
    id: string
    usuario_id: string
    usuario_nome: string
    contexto: string
    pergunta: string
    modelo: string | null
    status: string
    created_at: string
  }>
  auditoria: Array<{
    id: string
    usuario_id: string
    usuario_nome: string
    dominio: string
    escopo_aplicado: string | null
    acao: 'permitido' | 'bloqueado'
    motivo: string | null
    contexto: string | null
    created_at: string
  }>
  feedback: Array<{
    id: string
    autor: string
    modo_identidade: string
    origem: string
    categoria: string | null
    texto: string
    deseja_contato: boolean
    status: string
    created_at: string
  }>
  campanhas: Array<{
    id: string
    titulo: string
    descricao: string | null
    ativo: boolean
    created_at: string
    qtdRespostas: number
    perguntas: Array<{ id: string; texto: string; tipo: string; ordem: number }>
  }>
}

const DOMINIOS = [
  ['gestao', 'Gestão'],
  ['comercial', 'Comercial'],
  ['vendas_empresa', 'Vendas da empresa'],
  ['orcamento', 'Orçamentos'],
  ['custos_precos', 'Custos e preços'],
  ['medicao_final', 'Medição final'],
  ['engenharia', 'Engenharia'],
  ['compras', 'Compras'],
  ['fornecedores', 'Fornecedores'],
  ['estoque', 'Estoque'],
  ['producao', 'Produção'],
  ['instalacao', 'Instalação'],
  ['financeiro', 'Financeiro'],
  ['rh', 'RH'],
  ['marketing', 'Marketing'],
  ['qualidade', 'Qualidade'],
  ['pd', 'P&D'],
  ['pessoas_gestao', 'Atlas Pessoas · gestão'],
] as const

const LABEL_ESCOPO: Record<Escopo, string> = {
  herdado: 'Herdar setor',
  nenhum: 'Sem acesso',
  proprio: 'Somente próprios dados',
  setor: 'Dados do setor',
  empresa: 'Empresa inteira',
}

function fmtData(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtNum(v: number) {
  return new Intl.NumberFormat('pt-BR').format(v || 0)
}

export default function AdminIAPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<'visao' | 'permissoes' | 'perguntas' | 'pessoas' | 'pesquisas'>('visao')
  const [salvando, setSalvando] = useState<string | null>(null)
  const [tituloPesquisa, setTituloPesquisa] = useState('')
  const [descricaoPesquisa, setDescricaoPesquisa] = useState('')
  const [perguntasPesquisa, setPerguntasPesquisa] = useState<Array<{ texto: string; tipo: string; obrigatoria: boolean }>>([
    { texto: 'Como você avalia seu ambiente de trabalho hoje?', tipo: 'escala_1_5', obrigatoria: true },
    { texto: 'O que você mudaria para melhorar seu trabalho?', tipo: 'texto', obrigatoria: false },
  ])

  async function api(body?: any) {
    const token = await tokenAtual()
    const r = await fetch('/api/ia/admin', {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token || ''}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Não foi possível concluir.')
    return j
  }

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      const u = await usuarioAtual()
      if (!u || u.role !== 'master') throw new Error('Acesso restrito ao Master.')
      setDados(await api())
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { void carregar() }, [])

  const acessoMap = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const a of dados?.acessos || []) mapa.set(`${a.usuario_id}:${a.dominio}`, a.escopo)
    return mapa
  }, [dados])

  async function salvarPermissao(usuarioId: string, dominio: string, escopo: Escopo) {
    const chave = `${usuarioId}:${dominio}`
    setSalvando(chave)
    setErro('')
    try {
      await api({ acao: 'salvar_permissao', usuarioId, dominio, escopo })
      await carregar()
      setAba('permissoes')
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar permissão.')
    } finally {
      setSalvando(null)
    }
  }

  async function atualizarFeedback(id: string, status: string) {
    setSalvando(id)
    try {
      await api({ acao: 'atualizar_feedback', id, status })
      await carregar()
      setAba('pessoas')
    } catch (e: any) {
      setErro(e.message || 'Erro ao atualizar.')
    } finally {
      setSalvando(null)
    }
  }

  async function criarPesquisa() {
    const perguntas = perguntasPesquisa.filter(p => p.texto.trim())
    if (!tituloPesquisa.trim() || !perguntas.length) return
    setSalvando('pesquisa')
    setErro('')
    try {
      await api({
        acao: 'criar_pesquisa',
        titulo: tituloPesquisa,
        descricao: descricaoPesquisa,
        perguntas,
      })
      setTituloPesquisa('')
      setDescricaoPesquisa('')
      setPerguntasPesquisa([
        { texto: 'Como você avalia seu ambiente de trabalho hoje?', tipo: 'escala_1_5', obrigatoria: true },
        { texto: 'O que você mudaria para melhorar seu trabalho?', tipo: 'texto', obrigatoria: false },
      ])
      await carregar()
      setAba('pesquisas')
    } catch (e: any) {
      setErro(e.message || 'Erro ao criar pesquisa.')
    } finally {
      setSalvando(null)
    }
  }

  async function alternarPesquisa(id: string, ativo: boolean) {
    setSalvando(id)
    try {
      await api({ acao: 'alternar_pesquisa', id, ativo })
      await carregar()
      setAba('pesquisas')
    } catch (e: any) {
      setErro(e.message || 'Erro ao atualizar pesquisa.')
    } finally {
      setSalvando(null)
    }
  }

  if (carregando) {
    return <div className="min-h-screen grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>
  }

  if (erro && !dados) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-2xl border bg-white p-6 text-center shadow-sm">
          <ShieldX className="mx-auto mb-3 text-red-500" />
          <p className="text-sm text-red-700">{erro}</p>
          <Link href="/administracao" className="mt-4 inline-block text-sm font-semibold text-slate-700 underline">Voltar</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/administracao" className="rounded-lg p-2 hover:bg-slate-100"><ArrowLeft size={20} /></Link>
            <div>
              <h1 className="font-semibold">Controle Master · Atlas IA</h1>
              <p className="text-xs text-slate-500">Uso, permissões, auditoria e Atlas Pessoas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/administracao/ia/whatsapp" className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
              <Bot size={17} /> Assistente WhatsApp
            </Link>
            <button onClick={() => void carregar()} className="rounded-xl border bg-white p-2 text-slate-500 hover:bg-slate-50" title="Atualizar">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {erro && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: 'Perguntas · 30 dias', valor: fmtNum(dados?.resumo.perguntas || 0), icon: MessageSquareText },
            { label: 'Usuários ativos', valor: fmtNum(dados?.resumo.usuariosAtivos || 0), icon: Users },
            { label: 'Bloqueios de acesso', valor: fmtNum(dados?.resumo.bloqueios || 0), icon: LockKeyhole },
            { label: 'Erros de IA', valor: fmtNum(dados?.resumo.erros || 0), icon: ShieldX },
            { label: 'Custo estimado', valor: `US$ ${Number(dados?.resumo.custoEstimado || 0).toFixed(4)}`, icon: CircleDollarSign },
          ].map(card => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{card.label}</span>
                  <Icon size={17} className="text-emerald-600" />
                </div>
                <div className="mt-2 text-2xl font-semibold">{card.valor}</div>
              </div>
            )
          })}
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          {[
            ['visao', 'Visão geral'],
            ['permissoes', 'Permissões por usuário'],
            ['perguntas', 'Perguntas e auditoria'],
            ['pessoas', 'Voz do colaborador'],
            ['pesquisas', 'Pesquisas de clima'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setAba(id as any)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${aba === id ? 'bg-[#182444] text-white' : 'border bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {aba === 'visao' && (
          <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><BarChart3 size={18} /><h2 className="font-semibold">Uso por usuário</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead><tr className="border-b text-left text-xs text-slate-400"><th className="pb-2">Usuário</th><th>Perguntas</th><th>Bloqueios</th><th>Erros</th><th>Principais áreas</th><th>Último uso</th></tr></thead>
                  <tbody>
                    {(dados?.usuarios || []).map(u => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-3"><div className="font-medium">{u.nome}</div><div className="text-xs text-slate-400">{u.role}</div></td>
                        <td>{u.perguntas30d}</td>
                        <td>{u.bloqueios30d}</td>
                        <td>{u.erros30d}</td>
                        <td className="max-w-[280px]">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(u.contextos).sort((a,b) => b[1]-a[1]).slice(0,4).map(([k,v]) => (
                              <span key={k} className="rounded-full bg-slate-100 px-2 py-1 text-[11px]">{k} · {v}</span>
                            ))}
                          </div>
                        </td>
                        <td className="text-xs text-slate-500">{fmtData(u.ultimaPerguntaEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><Bot size={18} /><h2 className="font-semibold">Últimas perguntas</h2></div>
              <div className="space-y-3">
                {(dados?.interacoesRecentes || []).slice(0,10).map(i => (
                  <div key={i.id} className="rounded-xl border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-slate-700">{i.usuario_nome} · {i.contexto}</div>
                      <div className="text-[10px] text-slate-400">{fmtData(i.created_at)}</div>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">{i.pergunta}</p>
                  </div>
                ))}
                {!dados?.interacoesRecentes?.length && <p className="text-sm text-slate-400">Nenhuma interação registrada.</p>}
              </div>
            </section>
          </div>
        )}

        {aba === 'permissoes' && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2"><ShieldCheck size={18} /><h2 className="font-semibold">Permissões de dados da IA</h2></div>
            <p className="mb-5 max-w-4xl text-xs leading-5 text-slate-500">
              Esta camada controla o que a IA pode consultar. “Herdar setor” usa a permissão normal do Atlas. O Master continua com acesso total. Para vendedores, use “Somente próprios dados” quando não quiser expor números da empresa.
            </p>
            <div className="space-y-5">
              {(dados?.usuarios || []).map(u => (
                <div key={u.id} className="rounded-2xl border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div><div className="font-semibold">{u.nome}</div><div className="text-xs text-slate-400">{u.email} · {u.role}</div></div>
                    {u.role === 'master' && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Master · empresa inteira</span>}
                  </div>
                  {u.role !== 'master' && (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {DOMINIOS.map(([dominio, label]) => {
                        const valor = (acessoMap.get(`${u.id}:${dominio}`) || 'herdado') as Escopo
                        const chave = `${u.id}:${dominio}`
                        return (
                          <label key={dominio} className="rounded-xl bg-slate-50 p-3">
                            <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
                            <select
                              value={valor}
                              disabled={salvando === chave}
                              onChange={e => void salvarPermissao(u.id, dominio, e.target.value as Escopo)}
                              className="w-full rounded-lg border bg-white px-2 py-2 text-xs"
                            >
                              {Object.entries(LABEL_ESCOPO).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {aba === 'perguntas' && (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><MessageSquareText size={18} /><h2 className="font-semibold">Perguntas registradas</h2></div>
              <div className="space-y-2">
                {(dados?.interacoesRecentes || []).map(i => (
                  <div key={i.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-semibold">{i.usuario_nome}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">{i.contexto}</span>
                      <span className={i.status === 'ok' ? 'text-emerald-700' : 'text-red-600'}>{i.status}</span>
                      <span className="ml-auto text-slate-400">{fmtData(i.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{i.pergunta}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><Eye size={18} /><h2 className="font-semibold">Auditoria de acesso</h2></div>
              <div className="space-y-2">
                {(dados?.auditoria || []).map(a => (
                  <div key={a.id} className={`rounded-xl border p-3 ${a.acao === 'bloqueado' ? 'border-red-200 bg-red-50' : ''}`}>
                    <div className="flex items-center gap-2 text-xs">
                      {a.acao === 'bloqueado' ? <ShieldX size={14} className="text-red-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
                      <span className="font-semibold">{a.usuario_nome}</span>
                      <span>· {a.dominio}</span>
                      <span className="ml-auto text-[10px] text-slate-400">{fmtData(a.created_at)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{a.motivo || `Escopo: ${a.escopo_aplicado || '—'}`}</p>
                  </div>
                ))}
                {!dados?.auditoria?.length && <p className="text-sm text-slate-400">A auditoria fina começará a aparecer quando as novas permissões entrarem em uso.</p>}
              </div>
            </section>
          </div>
        )}

        {aba === 'pessoas' && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2"><Users size={18} /><h2 className="font-semibold">Voz do colaborador</h2></div>
            <p className="mb-5 text-xs leading-5 text-slate-500">
              Aqui aparecem somente conteúdos que o colaborador compartilhou voluntariamente com a empresa. O diário e a conversa privada não são lidos por esta tela.
            </p>
            <div className="space-y-3">
              {(dados?.feedback || []).map(f => (
                <div key={f.id} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">{f.autor}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-1">{f.origem}</span>
                    {f.deseja_contato && <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Pediu contato</span>}
                    <span className="ml-auto text-slate-400">{fmtData(f.created_at)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{f.texto}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <select value={f.status} disabled={salvando === f.id} onChange={e => void atualizarFeedback(f.id, e.target.value)} className="rounded-lg border px-2 py-1.5 text-xs">
                      <option value="recebido">Recebido</option>
                      <option value="em_analise">Em análise</option>
                      <option value="encaminhado">Encaminhado</option>
                      <option value="concluido">Concluído</option>
                      <option value="arquivado">Arquivado</option>
                    </select>
                  </div>
                </div>
              ))}
              {!dados?.feedback?.length && <p className="text-sm text-slate-400">Nenhum compartilhamento com a empresa ainda.</p>}
            </div>
          </section>
        )}

        {aba === 'pesquisas' && (
          <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><Plus size={18} /><h2 className="font-semibold">Nova pesquisa de clima</h2></div>
              <input value={tituloPesquisa} onChange={e => setTituloPesquisa(e.target.value)} placeholder="Título da pesquisa" className="w-full rounded-xl border px-3 py-2 text-sm" />
              <textarea value={descricaoPesquisa} onChange={e => setDescricaoPesquisa(e.target.value)} rows={2} placeholder="Descrição opcional" className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" />
              <div className="mt-4 space-y-3">
                {perguntasPesquisa.map((p, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-50 p-3">
                    <input value={p.texto} onChange={e => setPerguntasPesquisa(lista => lista.map((x,i) => i === idx ? { ...x, texto: e.target.value } : x))} placeholder="Pergunta" className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
                    <div className="mt-2 flex gap-2">
                      <select value={p.tipo} onChange={e => setPerguntasPesquisa(lista => lista.map((x,i) => i === idx ? { ...x, tipo: e.target.value } : x))} className="flex-1 rounded-lg border bg-white px-2 py-2 text-xs">
                        <option value="texto">Texto</option>
                        <option value="escala_1_5">Escala 1 a 5</option>
                        <option value="sim_nao">Sim / Não</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-slate-500"><input type="checkbox" checked={p.obrigatoria} onChange={e => setPerguntasPesquisa(lista => lista.map((x,i) => i === idx ? { ...x, obrigatoria: e.target.checked } : x))} /> Obrigatória</label>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setPerguntasPesquisa(p => [...p, { texto: '', tipo: 'texto', obrigatoria: false }])} className="mt-3 text-xs font-semibold text-slate-600 underline">+ Adicionar pergunta</button>
              <button disabled={salvando === 'pesquisa' || !tituloPesquisa.trim()} onClick={() => void criarPesquisa()} className="mt-4 w-full rounded-xl bg-[#182444] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                {salvando === 'pesquisa' ? 'Criando...' : 'Publicar pesquisa'}
              </button>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2"><BarChart3 size={18} /><h2 className="font-semibold">Pesquisas criadas</h2></div>
              <div className="space-y-3">
                {(dados?.campanhas || []).map(c => (
                  <div key={c.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="font-semibold">{c.titulo}</div>{c.descricao && <p className="mt-1 text-xs text-slate-500">{c.descricao}</p>}</div>
                      <button disabled={salvando === c.id} onClick={() => void alternarPesquisa(c.id, !c.ativo)} className={`rounded-full px-2 py-1 text-xs font-semibold ${c.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{c.ativo ? 'Ativa' : 'Encerrada'}</button>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">{c.perguntas.length} perguntas · {c.qtdRespostas} respostas registradas</div>
                  </div>
                ))}
                {!dados?.campanhas?.length && <p className="text-sm text-slate-400">Nenhuma pesquisa criada.</p>}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}