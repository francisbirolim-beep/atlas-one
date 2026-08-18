'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronDown, Image as ImageIcon, Layers, Package, Pencil, Search, ShieldAlert } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { listarLinhas } from '@/lib/linhas'
import type { Linha, Produto } from '@/lib/tipos'

function ehProdutoCatalogo(produto: Produto) {
  return produto.categoria === 'produto' || produto.categoria === 'porta_janela_padrao'
}

function codigoProduto(produto: Produto) {
  return produto.codigo || produto.nome.split(' - ')[0] || produto.nome
}

export default function ProdutosPorLinha() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [linhaId, setLinhaId] = useState('')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')

    if (me?.role === 'master') {
      const [listaProdutos, listaLinhas] = await Promise.all([
        listarProdutos(),
        listarLinhas(true),
      ])
      setProdutos(listaProdutos)
      setLinhas(listaLinhas)

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const linhaUrl = params.get('linha') || ''
        if (linhaUrl && listaLinhas.some(linha => linha.id === linhaUrl)) {
          setLinhaId(linhaUrl)
        }
      }
    }

    setCarregando(false)
  }

  function escolherLinha(id: string) {
    setLinhaId(id)
    setBusca('')
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (id) params.set('linha', id)
      else params.delete('linha')
      const query = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    }
  }

  const linhaSelecionada = linhas.find(linha => linha.id === linhaId) || null

  const quantidadePorLinha = useMemo(() => {
    const mapa = new Map<string, number>()
    produtos.filter(ehProdutoCatalogo).forEach(produto => {
      if (!produto.linha_id) return
      mapa.set(produto.linha_id, (mapa.get(produto.linha_id) || 0) + 1)
    })
    return mapa
  }, [produtos])

  const produtosDaLinha = useMemo(() => {
    if (!linhaId) return []
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return produtos
      .filter(ehProdutoCatalogo)
      .filter(produto => produto.linha_id === linhaId)
      .filter(produto => {
        if (!q) return true
        return `${codigoProduto(produto)} ${produto.nome} ${produto.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(q)
      })
      .sort((a, b) => (codigoProduto(a) || '').localeCompare(codigoProduto(b) || '', 'pt-BR', { numeric: true }))
  }, [produtos, linhaId, busca])

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando produtos...</div>
  }

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
          <Link href="/cadastro" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <Layers size={22} className="text-brand-navy" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800">Produtos por Linha</h1>
            <p className="text-sm text-slate-500">Escolha a linha e veja todos os produtos vinculados</p>
          </div>
          <Link
            href="/cadastro/produtos?categoria=produto"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2 hover:bg-brand-navyLight transition"
          >
            <Pencil size={14} /> Gerenciar produtos
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">1. Linha</p>
            <h2 className="text-base font-semibold text-slate-800 mt-1">Escolha a linha do produto</h2>
            <p className="text-xs text-slate-500 mt-1">Exemplo: Suprema. Depois o Atlas mostra somente os produtos cadastrados nessa linha.</p>
          </div>

          <div className="relative">
            <select
              value={linhaId}
              onChange={e => escolherLinha(e.target.value)}
              className="w-full appearance-none border border-slate-300 rounded-xl px-4 py-3 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
            >
              <option value="">Selecione uma linha</option>
              {linhas.map(linha => (
                <option key={linha.id} value={linha.id}>
                  {linha.nome} ({quantidadePorLinha.get(linha.id) || 0})
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </section>

        {!linhaSelecionada ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center">
            <Layers size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">Selecione uma linha para abrir o catálogo.</p>
            <p className="text-xs text-slate-400 mt-1">Nenhum produto é ocultado ou alterado; esta tela apenas organiza a navegação.</p>
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">2. Produtos</p>
                <h2 className="text-lg font-bold text-slate-800 mt-1">{linhaSelecionada.nome}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {produtosDaLinha.length} produto{produtosDaLinha.length === 1 ? '' : 's'} encontrado{produtosDaLinha.length === 1 ? '' : 's'} com o filtro atual.
                </p>
              </div>
              <Link
                href="/cadastro/produtos?categoria=produto"
                className="sm:hidden inline-flex items-center justify-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2"
              >
                <Pencil size={14} /> Gerenciar produtos
              </Link>
            </div>

            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-3 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar código, nome ou descrição"
                className="w-full border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
              />
            </div>

            {produtosDaLinha.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <Package size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">Nenhum produto encontrado nessa linha com o filtro atual.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {produtosDaLinha.map(produto => (
                  <article key={produto.id} className="rounded-xl border border-slate-200 overflow-hidden bg-white hover:border-brand-navy/40 transition">
                    <div className="h-28 bg-slate-50 flex items-center justify-center border-b border-slate-100">
                      {produto.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={produto.foto_url} alt="" className="w-full h-full object-contain p-2" />
                      ) : (
                        <ImageIcon size={30} className="text-slate-300" />
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] font-mono text-slate-400 truncate">{codigoProduto(produto)}</p>
                      <h3 className="text-sm font-semibold text-slate-800 mt-1 line-clamp-2">{produto.nome}</h3>
                      {produto.descricao && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{produto.descricao}</p>}
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{produto.unidade || 'unidade pendente'}</span>
                        <span className={`px-2 py-0.5 rounded-full ${produto.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {produto.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
