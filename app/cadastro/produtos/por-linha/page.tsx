'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, Layers, Search, Settings2, ShieldAlert } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Tipologia } from '@/lib/tipos'

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function ProdutosPorLinha() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
  const [linhaId, setLinhaId] = useState('')
  const [buscaTipologia, setBuscaTipologia] = useState('')
  const [focoBusca, setFocoBusca] = useState(false)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')

    if (me?.role === 'master') {
      const [listaLinhas, listaTipologias] = await Promise.all([
        listarLinhasTecnicas(),
        listarTipologias(),
      ])
      const linhasAtivas = listaLinhas.filter(l => l.ativo)
      setLinhas(linhasAtivas)
      setTipologias(listaTipologias)

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const linhaUrl = params.get('linha') || ''
        if (linhaUrl && linhasAtivas.some(l => l.id === linhaUrl)) setLinhaId(linhaUrl)
      }
    }
    setCarregando(false)
  }

  function escolherLinha(id: string) {
    setLinhaId(id)
    setBuscaTipologia('')
    setFocoBusca(false)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (id) params.set('linha', id)
      else params.delete('linha')
      const query = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    }
  }

  const linhaSelecionada = linhas.find(l => l.id === linhaId) || null

  const tipologiasDaLinha = useMemo(() => {
    if (!linhaSelecionada) return []
    const ids = new Set(linhaSelecionada.tipologia_ids || [])
    return tipologias.filter(t => ids.has(t.id)).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [linhaSelecionada, tipologias])

  const resultados = useMemo(() => {
    const q = normalizar(buscaTipologia)
    if (!q) return []
    return tipologiasDaLinha.filter(t => normalizar(t.label).includes(q)).slice(0, 12)
  }, [buscaTipologia, tipologiasDaLinha])

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando catálogo...</div>

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar Produtos.</p>
        <Link href="/cadastro" className="text-brand-navy text-sm hover:underline">Voltar ao Cadastro</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cadastro" className="p-2 hover:bg-slate-100 rounded-lg transition"><ArrowLeft size={20} /></Link>
          <Layers size={22} className="text-brand-navy" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Catálogo por Linha</h1>
            <p className="text-sm text-slate-500">Linha → Tipologia → Configurações validadas</p>
          </div>
          <Link href="/cadastro/linhas" className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2 hover:bg-brand-navyLight transition"><Settings2 size={14} /> Gerenciar linhas</Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">1. Linha técnica</p>
          <h2 className="text-base font-semibold text-slate-800 mt-1">Escolha a linha</h2>
          <p className="text-xs text-slate-500 mt-1">O orçamento usa exatamente os mesmos vínculos desta tela.</p>

          <div className="relative mt-3">
            <select value={linhaId} onChange={e => escolherLinha(e.target.value)} className="w-full appearance-none border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/30">
              <option value="">Selecione uma linha</option>
              {linhas.map(l => <option key={l.id} value={l.id}>{l.nome} · {l.tipologia_ids?.length || 0} modelo(s)</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </section>

        {linhaSelecionada && (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">2. Modelo / Tipologia</p>
                <h2 className="text-lg font-bold text-slate-800 mt-1">{linhaSelecionada.nome}</h2>
                <p className="text-xs text-slate-500 mt-1">Pesquise o modelo em vez de percorrer a lista inteira.</p>
              </div>
              <Link href={`/cadastro/linhas?linha=${encodeURIComponent(linhaSelecionada.id)}`} className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2 hover:bg-brand-navyLight transition"><Settings2 size={14} /> Vincular modelos</Link>
            </div>

            {tipologiasDaLinha.length === 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Nenhum modelo cadastrado nesta linha.</p>
              </div>
            ) : (
              <div className="relative mt-4">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={buscaTipologia}
                  onFocus={() => setFocoBusca(true)}
                  onChange={e => { setBuscaTipologia(e.target.value); setFocoBusca(true) }}
                  placeholder="Ex.: porta de correr 3 folhas"
                  className="w-full border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
                />

                {focoBusca && buscaTipologia.trim() && (
                  <div className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-2">
                    {resultados.length ? resultados.map(t => (
                      <Link
                        key={t.id}
                        href={`/engenharia/configuracoes-orcamento?linha=${encodeURIComponent(linhaSelecionada.id)}&tipologia=${encodeURIComponent(t.id)}`}
                        className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-brand-navyLight hover:text-brand-navy"
                      >
                        {t.label}
                      </Link>
                    )) : <p className="px-3 py-2 text-xs text-slate-500">Nenhuma tipologia encontrada nesta linha.</p>}
                  </div>
                )}

                <p className="mt-2 text-[11px] text-slate-400">{tipologiasDaLinha.length} modelo(s) vinculados. Digite parte do nome e clique no resultado para abrir as configurações.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
