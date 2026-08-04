'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Lock, Eye, Pencil, Construction, Star } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { listarSetores, listarPermissoesUsuario, nivelEfetivo, agruparSetores, GRUPOS_ORDEM, listarGruposComItens } from '@/lib/setores'
import { lerFavoritosSetores, alternarFavoritoSetor, EVENTO_FAVORITOS_SETORES_MUDOU } from '@/lib/favoritosSetores'
import { Usuario, Setor, NivelPermissao } from '@/lib/tipos'

const nivelInfo: Record<NivelPermissao, { label: string; icon: any; className: string }> = {
  oculto: { label: 'Oculto', icon: Lock, className: 'bg-slate-100 text-slate-400' },
  consulta: { label: 'Somente consulta', icon: Eye, className: 'bg-amber-50 text-amber-600' },
  edicao: { label: 'Acesso completo', icon: Pencil, className: 'bg-brand-tealLight text-brand-teal' },
}

export default function Setores() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [setores, setSetores] = useState<Setor[]>([])
  const [permissoes, setPermissoes] = useState<Record<string, NivelPermissao>>({})
  const [favoritos, setFavoritos] = useState<string[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    carregar()
    setFavoritos(lerFavoritosSetores())
    function sync() {
      setFavoritos(lerFavoritosSetores())
    }
    window.addEventListener(EVENTO_FAVORITOS_SETORES_MUDOU, sync)
    return () => window.removeEventListener(EVENTO_FAVORITOS_SETORES_MUDOU, sync)
  }, [])

  async function carregar() {
    setCarregando(true)
    const me = await usuarioAtual()
    setUsuario(me)
    const lista = await listarSetores()
    setSetores(lista)
    if (me && me.role !== 'master') {
      const mapa = await listarPermissoesUsuario(me.id)
      setPermissoes(mapa)
    }
    setCarregando(false)
  }

  function alternarFavorito(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    setFavoritos(alternarFavoritoSetor(id))
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  }

  const grupos = agruparSetores(setores)
  const gruposComAcesso = listarGruposComItens(setores)
    .map(grupo => ({
      grupo,
      itens: (grupos[grupo] || []).filter(s => nivelEfetivo(usuario, s.id, permissoes) !== 'oculto'),
    }))
    .filter(g => g.itens.length > 0)

  const todosAcessiveis = gruposComAcesso.flatMap(g => g.itens)
  const favoritosItens = todosAcessiveis.filter(s => favoritos.includes(s.id))

  function renderCard(setor: Setor) {
    const nivel = nivelEfetivo(usuario, setor.id, permissoes)
    const info = nivelInfo[nivel]
    const Icon = info.icon
    const href = setor.ativo && setor.rota ? setor.rota : `/setor/${setor.id}`
    const favoritado = favoritos.includes(setor.id)
    return (
      <div key={setor.id} className="relative">
        <Link
          href={href}
          className="bg-white rounded-xl border border-slate-200 hover:border-brand-navy p-4 transition hover:shadow-sm flex flex-col gap-2"
        >
          <div className="flex items-start justify-between gap-2 pr-6">
            <p className="font-medium text-slate-800 text-sm leading-snug">{setor.nome}</p>
            {!setor.ativo && (
              <span className="shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                <Construction size={11} /> Em construção
              </span>
            )}
          </div>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full w-fit ${info.className}`}>
            <Icon size={11} /> {info.label}
          </span>
        </Link>
        <button
          onClick={(e) => alternarFavorito(e, setor.id)}
          title={favoritado ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          className={`absolute top-3 right-3 p-1 rounded-full transition ${
            favoritado ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'
          }`}
        >
          <Star size={16} fill={favoritado ? 'currentColor' : 'none'} />
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Setores</h1>
            <p className="text-sm text-slate-500">Todas as áreas do Atlas One, organizadas por grupo</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {gruposComAcesso.length === 0 && (
          <p className="text-center text-slate-400 py-12">Você ainda não tem acesso liberado a nenhum setor. Fale com o administrador.</p>
        )}

        {favoritosItens.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Star size={13} className="text-amber-400" fill="currentColor" /> Favoritos
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {favoritosItens.map(renderCard)}
            </div>
          </section>
        )}

        {gruposComAcesso.map(({ grupo, itens }) => (
          <section key={grupo}>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{grupo}</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {itens.map(renderCard)}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
