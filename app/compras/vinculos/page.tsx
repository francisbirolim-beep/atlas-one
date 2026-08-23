'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Link2, Loader2, Search } from 'lucide-react'
import { tokenAtual } from '@/lib/auth'

type Produto = { id: string; codigo: string; nome: string; custo: number | null }
type Item = {
  id: string
  nf_id: string
  codigo_fornecedor: string | null
  descricao: string
  unidade: string | null
  quantidade: number
  valor_unitario: number | null
  vinculo_status: string
  nf: { id: string; numero: string | null; fornecedor_nome: string | null; data_emissao: string | null; data_entrada: string } | null
}

function moeda(valor: number | null) {
  if (valor == null) return '—'
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function VinculosComprasPage() {
  const [itens, setItens] = useState<Item[]>([])
  const [catalogo, setCatalogo] = useState<Produto[]>([])
  const [busca, setBusca] = useState('')
  const [selecoes, setSelecoes] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const headers = { Authorization: `Bearer ${token}` }
      const [r1, r2] = await Promise.all([
        fetch('/api/compras/vinculos?limit=300', { headers, cache: 'no-store' }),
        fetch('/api/compras/nf-entrada/catalogo', { headers, cache: 'no-store' }),
      ])
      const [j1, j2] = await Promise.all([r1.json(), r2.json()])
      if (!r1.ok) throw new Error(j1?.error || 'Erro ao carregar pendências.')
      if (!r2.ok) throw new Error(j2?.error || 'Erro ao carregar catálogo.')
      setItens(j1.itens || [])
      setCatalogo(j2.produtos || [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar pendências.')
    } finally {
      setCarregando(false)
    }
  }

  async function salvar(itemId: string) {
    const produtoId = selecoes[itemId]
    if (!produtoId) return setErro('Selecione o produto correto antes de salvar o vínculo.')
    setSalvando(itemId)
    setErro('')
    setMensagem('')
    try {
      const token = await tokenAtual()
      if (!token) throw new Error('Sessão do Atlas não encontrada.')
      const resp = await fetch(`/api/compras/vinculos/${itemId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ produtoId }),
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json?.error || 'Erro ao salvar vínculo.')
      setItens(prev => prev.filter(item => item.id !== itemId))
      setMensagem(json.aviso || 'Vínculo salvo. Nenhum custo foi alterado.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar vínculo.')
    } finally {
      setSalvando(null)
    }
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return itens
    return itens.filter(item => `${item.codigo_fornecedor || ''} ${item.descricao} ${item.nf?.numero || ''} ${item.nf?.fornecedor_nome || ''}`.toLowerCase().includes(t))
  }, [itens, busca])

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header>
          <Link href="/compras" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"><ArrowLeft size={16} /> Compras</Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Itens pendentes de vínculo</h1>
          <p className="mt-1 text-sm text-slate-600">Associe o código recebido na NF ao produto correto do Atlas. O custo não é alterado nesta tela.</p>
        </header>

        <div className="relative max-w-lg"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar código, item, NF ou fornecedor..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-400" /></div>

        {erro ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{erro}</div> : null}
        {mensagem ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{mensagem}</div> : null}

        {carregando ? <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Carregando pendências...</div> : null}

        {!carregando && !filtrados.length ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center"><CheckCircle2 size={36} className="mx-auto text-emerald-600" /><h2 className="mt-3 font-bold text-emerald-900">Nenhum item pendente</h2><p className="mt-1 text-sm text-emerald-800">Todos os itens recebidos estão vinculados ao catálogo.</p></div> : null}

        <section className="space-y-3">
          {filtrados.map(item => {
            const termo = `${item.codigo_fornecedor || ''} ${item.descricao}`.toLowerCase()
            const sugestoes = catalogo.filter(p => `${p.codigo} ${p.nome}`.toLowerCase().includes((item.codigo_fornecedor || '').toLowerCase()) || `${p.codigo} ${p.nome}`.toLowerCase().includes(item.descricao.toLowerCase().slice(0, 18))).slice(0, 20)
            const opcoes = sugestoes.length ? sugestoes : catalogo.slice(0, 60)
            void termo
            return <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{item.vinculo_status}</span><span className="font-mono text-xs text-slate-500">{item.codigo_fornecedor || 'sem código'}</span></div>
                  <h2 className="mt-2 font-bold text-slate-900">{item.descricao}</h2>
                  <p className="mt-1 text-sm text-slate-500">NF {item.nf?.numero || '—'} • {item.nf?.fornecedor_nome || 'Fornecedor não informado'} • {item.quantidade} {item.unidade || ''} • {moeda(item.valor_unitario)}</p>
                </div>
                <div className="w-full lg:w-[460px]">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Produto correto no Atlas</label>
                  <div className="flex gap-2">
                    <select value={selecoes[item.id] || ''} onChange={e => setSelecoes(prev => ({ ...prev, [item.id]: e.target.value }))} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400">
                      <option value="">Selecione...</option>
                      {opcoes.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.nome}</option>)}
                    </select>
                    <button onClick={() => salvar(item.id)} disabled={salvando === item.id || !selecoes[item.id]} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{salvando === item.id ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />} Vincular</button>
                  </div>
                </div>
              </div>
            </article>
          })}
        </section>
      </div>
    </main>
  )
}
