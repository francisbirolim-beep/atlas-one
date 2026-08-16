'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Search, ShieldAlert, Tag } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos, atualizarProduto, CATEGORIAS_PRODUTO, labelCategoriaProduto } from '@/lib/produtos'
import { Produto, CategoriaProduto } from '@/lib/tipos'

export default function PrecificacaoLote() {
  const [carregando, setCarregando] = useState(true)
  const [euSouMaster, setEuSouMaster] = useState<boolean | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState<CategoriaProduto | 'todas'>('acessorio')
  const [somenteZerado, setSomenteZerado] = useState(true)
  const [precos, setPrecos] = useState<Record<string, string>>({})
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [salvosIds, setSalvosIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setEuSouMaster(me?.role === 'master')
    if (me?.role === 'master') {
      const lista = await listarProdutos()
      setProdutos(lista)
      const mapa: Record<string, string> = {}
      lista.forEach(p => { mapa[p.id] = String(p.preco) })
      setPrecos(mapa)
    }
    setCarregando(false)
  }

  const filtrados = useMemo(() => {
    return produtos.filter(p => {
      if (categoria !== 'todas' && p.categoria !== categoria) return false
      if (somenteZerado && Number(p.preco) !== 0) return false
      if (busca.trim() && !p.nome.toLowerCase().includes(busca.trim().toLowerCase())) return false
      return true
    })
  }, [produtos, categoria, somenteZerado, busca])

  async function salvarPreco(id: string) {
    const valor = parseFloat((precos[id] || '0').replace(',', '.'))
    if (isNaN(valor) || valor < 0) return
    const atual = produtos.find(p => p.id === id)
    if (atual && Number(atual.preco) === valor) return
    setSalvandoId(id)
    await atualizarProduto(id, { preco: valor })
    setProdutos(prev => prev.map(p => (p.id === id ? { ...p, preco: valor } : p)))
    setSalvandoId(null)
    setSalvosIds(prev => new Set(prev).add(id))
    setTimeout(() => {
      setSalvosIds(prev => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    }, 2000)
  }

  function mudarPreco(id: string, valor: string) {
    setPrecos(prev => ({ ...prev, [id]: valor }))
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  if (!euSouMaster) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 gap-3">
        <ShieldAlert size={40} className="text-slate-300" />
        <p className="text-slate-500">Só o usuário master pode acessar esta tela.</p>
        <Link href="/cadastro/produtos" className="text-brand-navy text-sm hover:underline">Voltar aos Produtos</Link>
      </div>
    )
  }

  const totalZerados = produtos.filter(p => Number(p.preco) === 0).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/cadastro/produtos" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <Tag size={22} className="text-brand-navy" />
          <div>
            <h1 className="text-lg font-bold text-slate-800">Precificação em lote</h1>
            <p className="text-sm text-slate-500">{totalZerados} produto(s) com preço zerado</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome..."
                className="w-full border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-sm"
              />
            </div>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value as CategoriaProduto | 'todas')}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="todas">Todas as categorias</option>
              {CATEGORIAS_PRODUTO.map(c => (
                <option key={c.valor} value={c.valor}>{c.label}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-600 px-3 py-2.5 border border-slate-300 rounded-xl cursor-pointer">
              <input type="checkbox" checked={somenteZerado} onChange={e => setSomenteZerado(e.target.checked)} />
              Só preço zerado
            </label>
          </div>

          <p className="text-xs text-slate-400 mb-3">{filtrados.length} produto(s) encontrados</p>

          {filtrados.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum produto encontrado com esses filtros.</p>
          ) : (
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto">
              {filtrados.map(p => (
                <div key={p.id} className="flex items-center gap-3 border border-slate-100 rounded-lg px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{p.nome}</p>
                    <p className="text-xs text-slate-400">{labelCategoriaProduto(p.categoria)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-slate-400 text-xs">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={precos[p.id] ?? ''}
                      onChange={e => mudarPreco(p.id, e.target.value)}
                      onBlur={() => salvarPreco(p.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      }}
                      className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-right"
                    />
                    {salvandoId === p.id && <span className="text-xs text-slate-400">salvando...</span>}
                    {salvosIds.has(p.id) && <span className="text-xs text-brand-teal">✓</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
