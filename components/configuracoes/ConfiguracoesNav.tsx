'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, FileText, Settings2, Users, Workflow, SlidersHorizontal } from 'lucide-react'

const LINKS = [
  { href: '/configuracoes', label: 'Visão geral', icon: Settings2, exact: true },
  { href: '/configuracoes/empresa', label: 'Empresa e Identidade', icon: Building2 },
  { href: '/configuracoes/automacoes-fluxo', label: 'Automações do Fluxo', icon: Workflow, destaque: true },
  { href: '/configuracoes/usuarios', label: 'Pessoas e Acesso', icon: Users },
  { href: '/configuracoes/orcamento', label: 'Orçamento', icon: FileText },
  { href: '/configuracoes/campos', label: 'Campos', icon: SlidersHorizontal },
]

export default function ConfiguracoesNav() {
  const pathname = usePathname()
  const router = useRouter()

  // Compatibilidade temporária: a Configuração antiga ainda possui o botão
  // “Automações entre setores”. Enquanto o legado não for removido do arquivo
  // grande de Configurações, esse clique abre o motor novo do workflow.
  useEffect(() => {
    if (pathname !== '/configuracoes') return

    const redirecionarLegado = (event: MouseEvent) => {
      const alvo = event.target as HTMLElement | null
      const botao = alvo?.closest('button')
      if (!botao?.textContent?.includes('Automações entre setores')) return

      event.preventDefault()
      event.stopPropagation()
      router.push('/configuracoes/automacoes-fluxo')
    }

    document.addEventListener('click', redirecionarLegado, true)
    return () => document.removeEventListener('click', redirecionarLegado, true)
  }, [pathname, router])

  return (
    <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-2.5 md:px-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Central de Administração</p>
            <p className="text-xs text-slate-500">Configurações gerais do Atlas</p>
          </div>
          <Link href="/" className="text-xs font-medium text-slate-500 hover:text-slate-800">Voltar ao Atlas</Link>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Configurações do Atlas">
          {LINKS.map(item => {
            const Icon = item.icon
            const ativo = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  ativo
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : item.destaque
                      ? 'border-blue-200 bg-blue-50 text-brand-navy hover:border-brand-navy'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <Icon size={15} />
                {item.label}
                {item.destaque && !ativo && <span className="rounded-full bg-brand-navy px-1.5 py-0.5 text-[9px] font-bold text-white">NOVO</span>}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
