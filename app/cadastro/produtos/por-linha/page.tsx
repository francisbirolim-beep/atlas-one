'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  Image as ImageIcon,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShieldAlert,
} from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { listarTipologias } from '@/lib/tipologias'
import { listarLinhasTecnicas, type LinhaTecnica } from '@/lib/linhasTecnicas'
import type { Produto, Tipologia } from '@/lib/tipos'

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
  const [linhas, setLinhas] = useState<LinhaTecnica[]>([])
  const [tipologias, setTipologias] = useState<Tipologia[]>([])
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
      const [listaProdutos, listaLinhas, listaTipologias] = await Promise.all([
        listarProdutos(),
        listarLinhasTecnicas(),
        listarTipologias(),
      ])
      const linhasAtivas = listaLinhas.filter(linha => linha.ativo)
      setProdutos(listaProdutos)
      setLinhas(linhasAtivas)
      setTipologias(listaTipologias)

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const linhaUrl = params.get('linha') || ''
        if (linhaUrl && linhasAtivas.some(linha => linha.id === linhaUrl)) {
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
    linhas.forEach(linha => {
      const ids = new Set(linha.produto_ids || [])
      const total = produtos.filter(produto => ehProdutoCatalogo(produto) && ids.has(produto.id)).length
      mapa.set(linha.id, total)
    })
    return mapa
  }, [linhas, produtos])

  const tipologiasDaLinha = useMemo(() => {
    if (!linhaSelecionada) return []
    const ids = new Set(linhaSelecionada.tipologia_ids || [])
    return tipologias.filter(tipologia => ids.has(tipologia.id))
  }, [linhaSelecionada, tipologias])

  const produtosDaLinha = useMemo(() => {
    if (!linhaSelecionada) return []
    const ids = new Set(linhaSelecionada.produto_ids || [])
    const q = busca.trim().toLocaleLowerCase('pt-BR')
    return produtos
      .filter(ehProdutoCatalogo)
      .filter(produto => ids.has(produto.id))
      .filter(produto => {
        if (!q) return true
        return `${codigoProduto(produto)} ${produto.nome} ${produto.descricao || ''}`.toLocaleLowerCase('pt-BR').includes(q)
      })
      .sort((a, b) => (codigoProduto(a) || '').localeCompare(codigoProduto(b) || '', 'pt-BR', { numeric: true }))
  }, [produtos, linhaSelecionada, busca])

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando catálogo...</div>
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
            <h1 className="text-lg font-bold text-slate-800">Catálogo por Linha</h1>
            <p className="text-sm text-slate-500">Cadastre primeiro aqui; o orçamento consome o que estiver vinculado e liberado</p>
          </div>
          <Link
            href="/cadastro/linhas"
            className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2 hover:bg-brand-navyLight transition"
          >
            <Settings2 size={14} /> Gerenciar linhas
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="mb-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">1. Linha técnica</p>
            <h2 className="text-base font-semibold text-slate-800 mt-1">Escolha a linha que você quer montar</h2>
            <p className="text-xs text-slate-500 mt-1">Exemplo: SUPREMA. Aqui aparecem apenas as linhas técnicas usadas pelo orçamento.</p>
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
                  {linha.nome} · {linha.tipologia_ids?.length || 0} modelo(s) · {quantidadePorLinha.get(linha.id) || 0} projeto(s)
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-3.5 text-slate-400" />
          </div>
        </section>

        {!linhaSelecionada ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center">
            <Layers size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-600">Selecione uma linha para abrir o cadastro.</p>
            <p className="text-xs text-slate-400 mt-1">O Atlas não associa produto ou tipologia automaticamente pelo nome.</p>
          </section>
        ) : (
          <>
            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">2. Modelos / Tipologias</p>
                  <h2 className="text-lg font-bold text-slate-800 mt-1">{linhaSelecionada.nome}</h2>
                  <p className="text-xs text-slate-500 mt-1">Somente estes modelos ficam disponíveis no seletor da linha no orçamento.</p>
                </div>
                <Link
                  href={`/cadastro/linhas?linha=${encodeURIComponent(linhaSelecionada.id)}`}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2 hover:bg-brand-navyLight transition"
                >
                  <Settings2 size={14} /> Vincular modelos
                </Link>
              </div>

              {tipologiasDaLinha.length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-4">
                  {tipologiasDaLinha.map(tipologia => (
                    <span key={tipologia.id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700">
                      {tipologia.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Nenhum modelo cadastrado nesta linha.</p>
                  <p className="text-xs text-amber-800 mt-1">Primeiro vincule as tipologias da {linhaSelecionada.nome}. Enquanto isso, o orçamento continuará mostrando “Nenhum modelo disponível”.</p>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-brand-navy">3. Projetos / Produtos</p>
                  <h2 className="text-lg font-bold text-slate-800 mt-1">Projetos cadastrados na {linhaSelecionada.nome}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {produtosDaLinha.length} projeto{produtosDaLinha.length === 1 ? '' : 's'} encontrado{produtosDaLinha.length === 1 ? '' : 's'} com o filtro atual.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/cadastro/produtos?categoria=produto"
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-brand-navy border border-brand-navy rounded-lg px-3 py-2 hover:bg-brand-navyLight transition"
                  >
                    <Plus size={14} /> Cadastrar produto
                  </Link>
                  <Link
                    href={`/cadastro/linhas?linha=${encodeURIComponent(linhaSelecionada.id)}`}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50 transition"
                  >
                    <Pencil size={14} /> Vincular à linha
                  </Link>
                </div>
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
                  <p className="text-sm font-medium text-slate-600">Nenhum projeto/produto vinculado à {linhaSelecionada.nome}.</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">Cadastre o produto e depois vincule-o à linha técnica. Ele só vira card pronto no orçamento quando a configuração correspondente também estiver validada/liberada.</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Link href="/cadastro/produtos?categoria=produto" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-medium text-white">
                      <Plus size={14} /> Cadastrar primeiro produto
                    </Link>
                    <Link href={`/cadastro/linhas?linha=${encodeURIComponent(linhaSelecionada.id)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600">
                      <Settings2 size={14} /> Gerenciar vínculos
                    </Link>
                  </div>
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
          </>
        )}
      </main>
    </div>
  )
}
