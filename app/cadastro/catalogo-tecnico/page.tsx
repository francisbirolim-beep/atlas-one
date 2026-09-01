'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, History, ImageOff, Images, PackageSearch, Plus, Search } from 'lucide-react'
import { usuarioAtual } from '@/lib/auth'
import { listarProdutos } from '@/lib/produtos'
import { listarImagensProduto, type ProdutoImagem } from '@/lib/historicoCadastros'
import type { Produto } from '@/lib/tipos'

const GRUPOS = [
  { chave: 'todos', label: 'Todos' },
  { chave: 'perfil', label: 'Perfis' },
  { chave: 'acessorio', label: 'Acessórios' },
  { chave: 'vidro', label: 'Vidros' },
  { chave: 'outros', label: 'Outros' },
] as const

type Grupo = typeof GRUPOS[number]['chave']

function grupoProduto(categoria: string): Grupo {
  if (categoria === 'perfil') return 'perfil'
  if (categoria === 'acessorio') return 'acessorio'
  if (categoria === 'vidro') return 'vidro'
  return 'outros'
}

function normalizar(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export default function CatalogoTecnicoPage() {
  const [carregando, setCarregando] = useState(true)
  const [permitido, setPermitido] = useState<boolean | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [imagens, setImagens] = useState<ProdutoImagem[]>([])
  const [grupo, setGrupo] = useState<Grupo>('todos')
  const [busca, setBusca] = useState('')
  const [limite, setLimite] = useState(120)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    const pode = me?.role === 'master'
    setPermitido(pode)
    if (pode) {
      const [ps, imgs] = await Promise.all([listarProdutos(), listarImagensProduto()])
      setProdutos(ps)
      setImagens(imgs)
    }
    setCarregando(false)
  }

  const imagensPorProduto = useMemo(() => {
    const mapa = new Map<string, ProdutoImagem[]>()
    imagens.forEach(img => mapa.set(img.produto_id, [...(mapa.get(img.produto_id) || []), img]))
    return mapa
  }, [imagens])

  const contagens = useMemo(() => {
    const base = { todos: produtos.length, perfil: 0, acessorio: 0, vidro: 0, outros: 0 }
    produtos.forEach(p => { base[grupoProduto(p.categoria)] += 1 })
    return base
  }, [produtos])

  const semImagem = useMemo(() => produtos.filter(p => !p.foto_url && !(imagensPorProduto.get(p.id)?.length)).length, [produtos, imagensPorProduto])

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim())
    return produtos.filter(p => {
      if (grupo !== 'todos' && grupoProduto(p.categoria) !== grupo) return false
      if (!q) return true
      return normalizar(`${p.codigo || ''} ${p.codigo_origem || ''} ${p.nome} ${p.descricao || ''} ${p.categoria} ${p.grupo || ''} ${p.marca || ''}`).includes(q)
    })
  }, [produtos, grupo, busca])

  if (carregando) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando catálogo técnico...</div>
  if (!permitido) return <div className="min-h-screen flex items-center justify-center text-slate-500">Somente usuário master pode acessar o catálogo técnico.</div>

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/cadastros" className="mt-0.5 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={18}/></Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">Cadastro técnico mestre</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">Perfis, Acessórios, Vidros e Outros</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">Uma única base para orçamento, compras, estoque, produção e CMV. Imagens do W.Vetro e imagens técnicas ficam vinculadas ao mesmo cadastro.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cadastro/produtos" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Plus size={15}/>Cadastrar item</Link>
            <Link href="/cadastro/historico" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white"><History size={15}/>Histórico</Link>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {GRUPOS.map(g => (
          <button key={g.chave} onClick={() => { setGrupo(g.chave); setLimite(120) }} className={`rounded-2xl border p-4 text-left transition ${grupo === g.chave ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <p className="text-xs font-semibold text-slate-500">{g.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{contagens[g.chave]}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-3 text-slate-400"/>
          <input value={busca} onChange={e => { setBusca(e.target.value); setLimite(120) }} placeholder="Pesquisar por código, nome, descrição, marca..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"/>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><Images size={15}/>{imagens.length} imagens vinculadas <span className="text-slate-300">•</span> <ImageOff size={15}/>{semImagem} sem imagem</div>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-slate-500"><span>{filtrados.length} item(ns) encontrados</span><span>Mostrando {Math.min(limite, filtrados.length)}</span></div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtrados.slice(0, limite).map(p => {
          const imgs = imagensPorProduto.get(p.id) || []
          const principal = imgs.find(i => i.principal) || imgs[0]
          const url = p.foto_url || principal?.url || null
          return (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="aspect-[4/3] border-b border-slate-100 bg-slate-50">
                {url ? <img src={url} alt={p.nome} className="h-full w-full object-contain p-3"/> : <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300"><PackageSearch size={36}/><span className="text-xs">Sem imagem cadastrada</span></div>}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">{grupoProduto(p.categoria)}</p>
                    <h2 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">{p.nome}</h2>
                    <p className="mt-1 truncate text-xs text-slate-500">{p.codigo || p.codigo_origem || 'Sem código'}</p>
                  </div>
                  {p.origem === 'wvetro' && <span className="shrink-0 rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-700">W.Vetro</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                  <span className="rounded bg-slate-100 px-2 py-1">{p.unidade || 'unidade pendente'}</span>
                  {imgs.length > 0 && <span className="rounded bg-slate-100 px-2 py-1">{imgs.length} imagem(ns)</span>}
                  {p.status_validacao && <span className="rounded bg-slate-100 px-2 py-1">{p.status_validacao}</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/cadastro/produtos/${p.id}/historico`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><History size={14}/>Histórico</Link>
                  <Link href={`/cadastro/produtos?categoria=${encodeURIComponent(p.categoria)}`} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Editar</Link>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {filtrados.length > limite && <div className="mt-5 text-center"><button onClick={() => setLimite(v => v + 120)} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Mostrar mais</button></div>}
    </main>
  )
}
