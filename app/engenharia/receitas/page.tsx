'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Loader2, Plus, Trash2 } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import type { Produto, Tipologia, Usuario } from '@/lib/tipos'
import {
  adicionarComponente,
  criarReceitaParaTipologia,
  excluirComponente,
  listarComponentesReceita,
  listarProdutosTecnicos,
  listarTipologiasComReceita,
  type ComponenteReceita,
  type ReceitaTecnica,
  type TipoComponenteReceita,
  type TipologiaComReceita,
} from '@/lib/engenhariaReceitas'

export default function EngenhariaReceitasPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tipologias, setTipologias] = useState<TipologiaComReceita[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [selecionada, setSelecionada] = useState<TipologiaComReceita | null>(null)
  const [componentes, setComponentes] = useState<ComponenteReceita[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [tipo, setTipo] = useState<TipoComponenteReceita>('perfil')
  const [produtoId, setProdutoId] = useState('')
  const [nome, setNome] = useState('')
  const [unidade, setUnidade] = useState('un')
  const [quantidade, setQuantidade] = useState('1')
  const [formulaQuantidade, setFormulaQuantidade] = useState('')
  const [formulaCorte, setFormulaCorte] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const [u, t, p] = await Promise.all([usuarioAtual(), listarTipologiasComReceita(), listarProdutosTecnicos()])
    setUsuario(u); setTipologias(t); setProdutos(p)
    setCarregando(false)
  }

  async function abrir(t: TipologiaComReceita) {
    setSelecionada(t)
    setComponentes(t.receita ? await listarComponentesReceita(t.receita.id) : [])
  }

  async function criarReceita() {
    if (!selecionada || selecionada.receita) return
    setSalvando(true)
    const receita = await criarReceitaParaTipologia(selecionada as Tipologia, usuario)
    if (receita) {
      const atualizada = { ...selecionada, receita }
      setSelecionada(atualizada)
      setTipologias(prev => prev.map(t => t.id === atualizada.id ? atualizada : t))
    }
    setSalvando(false)
  }

  const produtosCompativeis = useMemo(() => produtos.filter(p => tipo === 'perfil' ? p.categoria === 'perfil' : tipo === 'acessorio' ? p.categoria === 'acessorio' : true), [produtos, tipo])

  async function adicionar() {
    const receita = selecionada?.receita
    if (!receita || !nome.trim()) return
    setSalvando(true)
    const criado = await adicionarComponente(receita.id, {
      tipo,
      produto_id: produtoId || null,
      nome: nome.trim(),
      unidade: unidade.trim() || 'un',
      quantidade_base: Number(quantidade) || 1,
      formula_quantidade: formulaQuantidade.trim() || null,
      formula_corte: formulaCorte.trim() || null,
    })
    if (criado) setComponentes(prev => [...prev, criado])
    setNome(''); setProdutoId(''); setQuantidade('1'); setFormulaQuantidade(''); setFormulaCorte('')
    setSalvando(false)
  }

  async function remover(id: string) {
    if (!confirm('Remover este componente da receita?')) return
    if (await excluirComponente(id)) setComponentes(prev => prev.filter(c => c.id !== id))
  }

  if (carregando) return <div className="min-h-[60vh] grid place-items-center text-slate-500"><Loader2 className="animate-spin" /></div>

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Link href="/engenharia" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500"><ArrowLeft size={18}/></Link><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-600">Engenharia · Fase 5</p><h1 className="text-2xl font-bold text-slate-900">Receitas técnicas por tipologia</h1><p className="text-sm text-slate-500">Defina os componentes de cada esquadria antes de ativar os cálculos automáticos.</p></div></div>
    </div>

    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-2 px-2"><BookOpen size={17}/><strong className="text-sm">Tipologias</strong></div>
        <div className="space-y-2">{tipologias.map(t => <button key={t.id} onClick={() => abrir(t)} className={`w-full rounded-xl border p-3 text-left transition ${selecionada?.id === t.id ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-slate-800">{t.label}</strong><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${t.receita ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{t.receita ? 'Com receita' : 'Sem receita'}</span></div><p className="mt-1 text-xs text-slate-400">{t.categoria}</p></button>)}</div>
      </aside>

      <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!selecionada ? <div className="grid min-h-[420px] place-items-center text-center text-slate-400"><div><BookOpen className="mx-auto mb-3" size={34}/><p>Selecione uma tipologia para montar a receita técnica.</p></div></div> : <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-400">Tipologia</p><h2 className="text-xl font-bold text-slate-900">{selecionada.label}</h2></div>{!selecionada.receita && <button disabled={salvando} onClick={criarReceita} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Criar receita</button>}</div>

          {selecionada.receita && <>
            <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoComponenteReceita)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="perfil">Perfil</option><option value="acessorio">Acessório</option><option value="vidro">Vidro</option><option value="reforco">Reforço</option><option value="outro">Outro</option></select>
              <select value={produtoId} onChange={e => { setProdutoId(e.target.value); const p = produtos.find(x => x.id === e.target.value); if (p) { setNome(p.nome); setUnidade(p.unidade || 'un') } }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Componente manual</option>{produtosCompativeis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do componente" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/>
              <div className="grid grid-cols-2 gap-2"><input value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="Qtd." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/><input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="Un." className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/></div>
              <input value={formulaQuantidade} onChange={e => setFormulaQuantidade(e.target.value)} placeholder="Fórmula quantidade (futura)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-1 xl:col-span-2"/>
              <input value={formulaCorte} onChange={e => setFormulaCorte(e.target.value)} placeholder="Fórmula de corte (futura)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm md:col-span-1"/>
              <button disabled={salvando || !nome.trim()} onClick={adicionar} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16}/>Adicionar</button>
            </section>

            <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-semibold text-slate-800">Componentes da receita</h3><span className="text-xs text-slate-400">{componentes.length} item(ns)</span></div>{componentes.length === 0 && <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">Nenhum componente cadastrado.</div>}{componentes.map(c => <article key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{c.tipo}</span><strong className="text-sm text-slate-800">{c.nome}</strong><span className="text-xs text-slate-400">{c.quantidade_base} {c.unidade}</span></div>{(c.formula_quantidade || c.formula_corte) && <div className="mt-2 space-y-1 text-xs text-slate-500">{c.formula_quantidade && <p>Quantidade: <code>{c.formula_quantidade}</code></p>}{c.formula_corte && <p>Corte: <code>{c.formula_corte}</code></p>}</div>}</div><button onClick={() => remover(c.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16}/></button></article>)}</section>
          </>}
        </div>}
      </main>
    </div>
  </div>
}
