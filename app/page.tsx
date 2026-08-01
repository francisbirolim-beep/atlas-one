'use client'

import { useEffect, useState } from 'react'
import { FileText, Wrench, ArrowRight, History, BarChart3, Users, Columns3, Settings, LogOut, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { usuarioAtual, logout } from '@/lib/auth'
import { Usuario } from '@/lib/tipos'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const router = useRouter()

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-brand-navyLight">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Esquadrifácio" className="h-10 w-auto" />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <p className="text-xs font-semibold text-brand-navy leading-tight">Atlas One</p>
              <p className="text-xs text-slate-400 leading-tight">Orçamento Inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/setores" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <LayoutGrid size={16} />
              Setores
            </Link>
            <Link href="/clientes" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Users size={16} />
              Clientes
            </Link>
            <Link href="/kanban" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Columns3 size={16} />
              Painel
            </Link>
            <Link href="/historico" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <History size={16} />
              Histórico
            </Link>
            <Link href="/assistencias" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <Wrench size={16} />
              Assistências
            </Link>
            <Link href="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
              <BarChart3 size={16} />
              Dashboard
            </Link>
            {usuario?.role === 'master' && (
              <Link href="/configuracoes" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
                <Settings size={16} />
                Configurações
              </Link>
            )}
            {usuario && (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-slate-200">
                <span className="text-xs text-slate-400 hidden sm:inline">{usuario.nome}</span>
                <button onClick={sair} className="p-1.5 text-slate-400 hover:text-red-500 transition" title="Sair">
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 mb-3">O que você precisa?</h2>
          <p className="text-slate-500 max-w-lg mx-auto">
            Faça um orçamento novo ou registre um chamado de assistência técnica
            para um cliente que já comprou.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <Link href="/orcamento-rapido"
            className="group bg-white rounded-2xl border-2 border-brand-navyLight hover:border-brand-navy
                       p-8 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="w-14 h-14 bg-brand-navyLight rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-navy transition-colors">
              <FileText size={28} className="text-brand-navy group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Orçamento</h3>
            <p className="text-slate-500 text-sm mb-4">
              Registre um pedido novo. Dentro você escolhe entre descrever em texto
              (rápido) ou preencher o formulário completo (detalhado).
            </p>
            <ul className="text-sm text-slate-600 space-y-1.5 mb-6">
              <li className="flex items-center gap-2">Rápido: descreva em texto</li>
              <li className="flex items-center gap-2">Detalhado: tipo, medidas, acabamento e fotos</li>
              <li className="flex items-center gap-2">Vai direto pro painel de orçamentos</li>
            </ul>
            <div className="flex items-center text-brand-navy font-medium group-hover:gap-2 transition-all">
              Fazer orçamento <ArrowRight size={16} className="ml-1" />
            </div>
          </Link>

          <Link href="/assistencia"
            className="group bg-white rounded-2xl border-2 border-brand-tealLight hover:border-brand-teal
                       p-8 transition-all hover:shadow-lg hover:-translate-y-1">
            <div className="w-14 h-14 bg-brand-tealLight rounded-xl flex items-center justify-center mb-5 group-hover:bg-brand-teal transition-colors">
              <Wrench size={28} className="text-brand-teal group-hover:text-white transition-colors" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">Assistência Técnica</h3>
            <p className="text-slate-500 text-sm mb-4">
              Para cliente que já comprou e está com algum problema ou precisa
              de manutenção em obra já entregue.
            </p>
            <ul className="text-sm text-slate-600 space-y-1.5 mb-6">
              <li className="flex items-center gap-2">Endereço e descrição do problema</li>
              <li className="flex items-center gap-2">Fotos do problema</li>
              <li className="flex items-center gap-2">Acompanhamento até resolver</li>
            </ul>
            <div className="flex items-center text-brand-teal font-medium group-hover:gap-2 transition-all">
              Abrir assistência <ArrowRight size={16} className="ml-1" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
