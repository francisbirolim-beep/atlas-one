'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, LockKeyhole, Loader2, Search } from 'lucide-react'
import { carregarPrecificacaoOrcamento, gerarBasePrecificacao, salvarCustoComponente, type ComponentePrecificacao } from '@/lib/orcamentoPrecificacao'
import { supabase } from '@/lib/supabase'
import { usuarioAtual } from '@/lib/auth'

const GRUPOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'perfil', label: 'Perfis' },
  { id: 'acessorio', label: 'Acessórios' },
  { id: 'vidro', label: 'Vidros' },
  { id: 'outros', label: 'Outros' },
  { id: 'pendentes', label: 'Sem custo' },
] as const

function moeda(v: number) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function grupoComponente(c: ComponentePrecificacao) {
  if (c.categoria === 'perfil') return 'perfil'
  if (c.categoria === 'acessorio') return 'acessorio'
  if (c.categoria === 'vidro') return 'vidro'
  return 'outros'
}

export default function ConferenciaCustosPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const orcamentoId = String(params?.id || '')
  const [dados, setDados] = useState<any | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<(typeof GRUPOS)[number]['id']>('todos')
  const [editando, setEditando] = useState<Record<string, string>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvarCatalogo, setSalvarCatalogo] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [senha, setSenha] = useState('')
  const [liberando, setLiberando] = useState(false)
  const [erroSenha, setErroSenha] = useState('')
  const [liberadoPorSenha, setLiberadoPorSenha] = useState(false)

  useEffect(() => { if (orcamentoId) void carregar() }, [orcamentoId])

  async function carregar() {
    setCarregando(true)
    setErro('')
    try {
      let atual = await carregarPrecificacaoOrcamento(orcamentoId)
      if (!atual?.pacote || !atual.componentes.length) {
        setGerando(true)
        const gerado = await gerarBasePrecificacao(orcamentoId)
        setGerando(false)
        if (!gerado.ok) setErro(gerado.error || 'Não foi possível gerar a base de custos. As pendências técnicas continuam bloqueantes.')
        atual = await carregarPrecificacaoOrcamento(orcamentoId)
      }
      setDados(atual)
      const base: Record<string, string> = {}
      for (const c of atual?.componentes || []) base[c.id] = c.custo_unitario > 0 ? String(c.custo_unitario).replace('.', ',') : ''
      setEditando(base)
    } catch {
      setErro('Não foi possível carregar a conferência de custos.')
    } finally {
      setGerando(false)
      setCarregando(false)
    }
  }

  const componentes: ComponentePrecificacao[] = dados?.componentes || []
  const pendentes = componentes.filter(c => c.custo_pendente || Number(c.custo_unitario) <= 0)
  const preenchidos = componentes.length - pendentes.length
  const totalCusto = componentes.reduce((s, c) => s + Number(c.custo_total || 0), 0)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return componentes.filter(c => {
      const pendente = c.custo_pendente || Number(c.custo_unitario) <= 0
      if (filtro === 'pendentes' && !pendente) return false
      if (filtro !== 'todos' && filtro !== 'pendentes' && grupoComponente(c) !== filtro) return false
      if (!termo) return true
      return `${c.codigo || ''} ${c.descricao} ${c.unidade} ${c.categoria}`.toLowerCase().includes(termo)
    })
  }, [componentes, filtro, busca])

  async function salvarCusto(c: ComponentePrecificacao) {
    const valor = Number(String(editando[c.id] || '').replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um custo unitário maior que zero.')
      return
    }
    setSalvandoId(c.id)
    setErro('')
    const r = await salvarCustoComponente(c, valor, salvarCatalogo)
    if (!r.ok) setErro(r.error || 'Não foi possível salvar o custo.')
    else await carregar()
    setSalvandoId(null)
  }

  function avancar() {
    if (pendentes.length > 0 && !liberadoPorSenha) {
      setModalSenha(true)
      return
    }
    router.push(`/orcamento/${orcamentoId}/precificacao`)
  }

  async function liberarComSenha() {
    setLiberando(true)
    setErroSenha('')
    try {
      const usuario = await usuarioAtual()
      if (!usuario || usuario.role !== 'master') {
        setErroSenha('Somente usuário Master pode liberar orçamento com custo pendente.')
        return
      }
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email
      if (!email) {
        setErroSenha('Não foi possível confirmar o usuário atual.')
        return
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        setErroSenha('Senha incorreta.')
        return
      }
      setLiberadoPorSenha(true)
      setModalSenha(false)
      setSenha('')
    } finally {
      setLiberando(false)
    }
  }

  if (carregando) return <div className="min-h-screen bg-slate-50 grid place-items-center"><div className="flex items-center gap-2 text-slate-500"><Loader2 className="animate-spin" size={20}/>{gerando ? 'Gerando base de custos...' : 'Carregando custos...'}</div></div>

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-4 lg:px-6">
        <Link href="/orcamento/sob-medida" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20}/></Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cliente 360 · Orçamento</p>
          <h1 className="truncate text-xl font-bold">Conferência de Custos</h1>
          <p className="text-xs text-slate-500">Confira todos os custos antes de configurar e precificar.</p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">1 Dados</span><ChevronRight size={15} className="text-slate-300"/>
          <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">2 Tipologias</span><ChevronRight size={15} className="text-slate-300"/>
          <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">3 Custos</span><ChevronRight size={15} className="text-slate-300"/>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">4 Configurar</span><ChevronRight size={15} className="text-slate-300"/>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">5 Precificar</span>
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 pb-24 lg:px-6">
      {erro && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erro}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-400">Itens de custo</p><p className="mt-1 text-2xl font-bold">{componentes.length}</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Preenchidos</p><p className="mt-1 text-2xl font-bold text-emerald-800">{preenchidos}</p></div>
        <div className={`rounded-2xl border p-4 ${pendentes.length ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><p className="text-xs font-semibold uppercase">Pendentes</p><p className="mt-1 text-2xl font-bold">{pendentes.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase text-slate-400">Custo total atual</p><p className="mt-1 text-2xl font-bold">{moeda(totalCusto)}</p></div>
      </section>

      {pendentes.length > 0 ? <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><AlertTriangle size={22} className="mt-0.5 shrink-0"/><div><p className="font-bold">Existem {pendentes.length} custos pendentes.</p><p className="text-sm">Enquanto houver custo ausente, pendente ou igual a R$ 0,00 o Atlas bloqueia o avanço. Usuário Master pode liberar excepcionalmente informando a própria senha.</p></div></div> : <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"><CheckCircle2 size={22}/><div><p className="font-bold">Todos os custos estão preenchidos.</p><p className="text-sm">O orçamento está liberado para a próxima etapa.</p></div></div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">{GRUPOS.map(g => <button key={g.id} onClick={() => setFiltro(g.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${filtro === g.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{g.label}</button>)}</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={salvarCatalogo} onChange={e => setSalvarCatalogo(e.target.checked)}/>Salvar custo digitado também no catálogo oficial</label>
            <div className="relative min-w-[260px]"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código ou material..." className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm"/></div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Código / Material</th><th className="px-4 py-3 text-right">Qtd.</th><th className="px-4 py-3">Un.</th><th className="px-4 py-3 text-right">Custo unitário</th><th className="px-4 py-3 text-right">Custo total</th><th className="px-4 py-3">Origem</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.map(c => {
                const pendente = c.custo_pendente || Number(c.custo_unitario) <= 0
                return <tr key={c.id} className={pendente ? 'bg-amber-50/50' : ''}>
                  <td className="px-4 py-3">{pendente ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">Pendente</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">OK</span>}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{grupoComponente(c)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{c.codigo || 'Sem código'} · {c.descricao}</p>{c.item_ref && <p className="text-xs text-slate-400">Tipologia: {c.item_ref}</p>}</td>
                  <td className="px-4 py-3 text-right">{Number(c.quantidade || 0).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3">{c.unidade}</td>
                  <td className="px-4 py-3"><input inputMode="decimal" value={editando[c.id] ?? ''} onChange={e => setEditando(p => ({ ...p, [c.id]: e.target.value }))} className={`ml-auto block w-32 rounded-lg border px-2 py-2 text-right text-sm ${pendente ? 'border-amber-300 bg-white' : 'border-slate-200'}`} placeholder="0,00"/></td>
                  <td className="px-4 py-3 text-right font-semibold">{moeda(Number(c.custo_total || 0))}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.origem_custo || 'pendente'}</td>
                  <td className="px-4 py-3"><button disabled={salvandoId === c.id} onClick={() => void salvarCusto(c)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{salvandoId === c.id ? 'Salvando...' : 'Salvar custo'}</button></td>
                </tr>
              })}
              {filtrados.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">Nenhum custo encontrado neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/orcamento/sob-medida" className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Voltar às tipologias</Link>
        <button onClick={avancar} className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white ${pendentes.length && !liberadoPorSenha ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{pendentes.length && !liberadoPorSenha ? <><LockKeyhole size={17}/>Liberar com senha</> : <>Avançar para configurar <ChevronRight size={17}/></>}</button>
      </div>
    </main>

    {modalSenha && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start gap-3"><div className="rounded-xl bg-amber-100 p-2 text-amber-700"><LockKeyhole size={20}/></div><div><h2 className="font-bold">Liberar com custos pendentes</h2><p className="text-sm text-slate-500">Apenas usuário Master pode liberar esta exceção. Digite sua senha do Atlas.</p></div></div>{erroSenha && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroSenha}</div>}<input type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void liberarComSenha() }} placeholder="Senha" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"/><div className="mt-4 flex justify-end gap-2"><button onClick={() => { setModalSenha(false); setSenha(''); setErroSenha('') }} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={!senha || liberando} onClick={() => void liberarComSenha()} className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{liberando ? 'Confirmando...' : 'Liberar exceção'}</button></div></div></div>}
  </div>
}
