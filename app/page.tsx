'use client'

import { useEffect, useState } from 'react'
import { History, BarChart3, Users, Columns3, Settings, LayoutGrid, Wrench, EyeOff, Eye, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'

type Guia = {
  href: string
  label: string
  icon: typeof LayoutGrid
  masterOnly?: boolean
}

const GUIAS: Guia[] = [
  { href: '/setores', label: 'Setores', icon: LayoutGrid },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/kanban', label: 'Painel de Orçamentos', icon: Columns3 },
  { href: '/assistencias', label: 'Assistências', icon: Wrench },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, masterOnly: true },
  { href: '/cadastro', label: 'Cadastro', icon: UserPlus, masterOnly: true },
]

const CHAVE_OCULTOS = 'atlas_guias_ocultos'

export default function Home() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [ocultos, setOcultos] = useState<string[]>([])
  const [mostrarOcultos, setMostrarOcultos] = useState(false)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
    try {
      const salvo = localStorage.getItem(CHAVE_OCULTOS)
      if (salvo) setOcultos(JSON.parse(salvo))
    } catch {}
  }, [])

  function alternarOculto(href: string) {
    const novo = ocultos.includes(href) ? ocultos.filter((h) => h !== href) : [...ocultos, href]
    setOcultos(novo)
    try {
      localStorage.setItem(CHAVE_OCULTOS, JSON.stringify(novo))
    } catch {}
  }

  const visiveis = GUIAS.filter((g) => !g.masterOnly || usuario?.role === 'master').filter(
    (g) => !ocultos.includes(g.href)
  )
  const escondidos = GUIAS.filter((g) => !g.masterOnly || usuario?.role === 'master').filter((g) =>
    ocultos.includes(g.href)
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-bold text-brand-navy">Atlas One</h1>
            <p className="text-xs text-slate-400">Esquadrifácio</p>
          </div>
          {usuario && <span className="text-sm text-slate-500">Olá, {usuario.nome}</span>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-700">Guias rápidos</h2>
          {escondidos.length > 0 && (
            <button
              onClick={() => setMostrarOcultos((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"
            >
              <Eye size={14} />
              {mostrarOcultos ? 'Ocultar lista' : `${escondidos.length} escondido(s)`}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {visiveis.map((g) => {
            const Icon = g.icon
            return (
              <div key={g.href} className="relative group">
                <Link
                  href={g.href}
                  className="flex flex-col items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200
                             hover:border-brand-navy hover:shadow-md transition-all p-5 text-center h-full"
                >
                  <div className="w-11 h-11 bg-brand-navyLight rounded-xl flex items-center justify-center">
                    <Icon size={20} className="text-brand-navy" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{g.label}</span>
                </Link>
                <button
                  onClick={() => alternarOculto(g.href)}
                  title="Esconder"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition p-1 rounded-md text-slate-300 hover:text-slate-500 hover:bg-slate-100"
                >
                  <EyeOff size={14} />
                </button>
              </div>
            )
          })}
        </div>

        {mostrarOcultos && escondidos.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-400 mb-3">Escondidos — clique pra trazer de volta</p>
            <div className="flex flex-wrap gap-2">
              {escondidos.map((g) => (
                <button
                  key={g.href}
                  onClick={() => alternarOculto(g.href)}
                  className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1.5 transition"
                >
                  <g.icon size={12} />
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
