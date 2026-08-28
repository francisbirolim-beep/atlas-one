'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Boxes,
  Building2,
  Calculator,
  ChevronDown,
  ChevronRight,
  Compass,
  FileText,
  KeyRound,
  LayoutGrid,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { logout, usuarioAtual } from '@/lib/auth'
import type { Usuario } from '@/lib/tipos'
import { agruparGuias, GUIAS } from '@/lib/guias'

type TemaAtlas = 'escuro' | 'claro'

type ItemAdmin = {
  href: string
  label: string
  descricao: string
  icon: typeof Settings
  palavras: string
}

const ITENS_ADMIN: ItemAdmin[] = [
  {
    href: '/administracao',
    label: 'Central de Administração',
    descricao: 'Mapa organizado das configurações',
    icon: Compass,
    palavras: 'administracao central mapa encontrar localizar configuracao onde fica',
  },
  {
    href: '/configuracoes/empresa',
    label: 'Empresa e Identidade',
    descricao: 'Logo, nome e identidade visual',
    icon: Building2,
    palavras: 'empresa logo marca identidade white label cor dados empresa',
  },
  {
    href: '/configuracoes/usuarios',
    label: 'Usuários e Acesso',
    descricao: 'Usuários, permissões e tela inicial',
    icon: KeyRound,
    palavras: 'usuario acesso senha permissao funcionario home tela inicial keila vendedor',
  },
  {
    href: '/setores',
    label: 'Setores e Permissões',
    descricao: 'Estrutura dos setores da empresa',
    icon: LayoutGrid,
    palavras: 'setor departamento permissao equipe comercial financeiro produção engenharia',
  },
  {
    href: '/configuracoes/orcamento',
    label: 'Padrão do Orçamento',
    descricao: 'Regras e apresentação comercial',
    icon: FileText,
    palavras: 'orcamento proposta padrão comercial validade condição pagamento',
  },
  {
    href: '/cadastros',
    label: 'Central de Cadastros',
    descricao: 'Produtos, linhas, materiais e fornecedores',
    icon: Boxes,
    palavras: 'cadastro produto linha fornecedor material perfil acessorio precificacao unidade receita tipologia',
  },
  {
    href: '/engenharia/formulas-corte',
    label: 'Fórmulas de Corte',
    descricao: 'Regras técnicas de produção',
    icon: Calculator,
    palavras: 'formula corte engenharia perfil produção receita plano corte',
  },
  {
    href: '/configuracoes',
    label: 'Configurações Avançadas',
    descricao: 'Automações, metas, backup e ajustes',
    icon: Settings,
    palavras: 'configuracao automacao meta backup kanban sla agente ia checklist avançado campos',
  },
]

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tema, setTema] = useState<TemaAtlas>('escuro')
  const [busca, setBusca] = useState('')
  const [adminAberto, setAdminAberto] = useState(false)

  useEffect(() => {
    usuarioAtual().then(setUsuario)
  }, [])

  useEffect(() => {
    if (!usuario?.id) return
    const salvo = window.localStorage.getItem(`atlas-theme:${usuario.id}`)
    const temaInicial: TemaAtlas = salvo === 'claro' ? 'claro' : 'escuro'
    setTema(temaInicial)
    document.documentElement.dataset.atlasTheme = temaInicial
  }, [usuario?.id])

  useEffect(() => {
    const emAdministracao = ITENS_ADMIN.some(item => pathname === item.href || pathname.startsWith(`${item.href}/`))
    if (emAdministracao) setAdminAberto(true)
  }, [pathname])

  async function sair() {
    await logout()
    router.replace('/login')
  }

  function alternarTema() {
    const proximo: TemaAtlas = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(proximo)
    document.documentElement.dataset.atlasTheme = proximo
    if (usuario?.id) window.localStorage.setItem(`atlas-theme:${usuario.id}`, proximo)
  }

  function ativo(href: string) {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const termo = normalizar(busca)

  const gruposVisiveis = useMemo(() => {
    const filtradas = termo
      ? GUIAS.filter(guia => normalizar(`${guia.label} ${guia.grupo}`).includes(termo))
      : GUIAS
    return agruparGuias(filtradas)
  }, [termo])

  const adminVisiveis = useMemo(() => {
    if (!termo) return ITENS_ADMIN
    return ITENS_ADMIN.filter(item => normalizar(`${item.label} ${item.descricao} ${item.palavras}`).includes(termo))
  }, [termo])

  const mostrarAdmin = usuario?.role === 'master' && (adminAberto || !!termo)
  const semResultados = gruposVisiveis.length === 0 && (!usuario || usuario.role !== 'master' || adminVisiveis.length === 0)

  return (
    <nav className="atlas-sidebar-shell hidden h-screen w-60 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-3 py-5 md:flex">
      <div className="atlas-sidebar-brand flex items-center gap-3 px-2 pb-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-950/20">A</span>
        <span className="min-w-0">
          <strong className="block text-sm font-bold uppercase tracking-[0.08em] text-white">Atlas One</strong>
          <span className="mt-0.5 block truncate text-[11px] text-slate-400">Esquadrifácio</span>
        </span>
      </div>

      <div className="mb-4 px-1">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar no menu..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-4">
          {gruposVisiveis.map(grupo => (
            <section key={grupo.grupo}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{grupo.grupo}</p>
              <div className="space-y-1">
                {grupo.itens.map(guia => {
                  const Icon = guia.icon
                  const selecionado = ativo(guia.href)
                  return (
                    <Link
                      key={guia.href}
                      href={guia.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        selecionado
                          ? 'bg-brand-navy text-white shadow-sm'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span>{guia.label}</span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}

          {usuario?.role === 'master' && (
            <section className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setAdminAberto(aberto => !aberto)}
                aria-expanded={mostrarAdmin}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <span className="inline-flex items-center gap-2"><Settings size={15} /> Administração</span>
                {mostrarAdmin ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>

              {mostrarAdmin && (
                <div className="mt-1 space-y-1">
                  {adminVisiveis.map(item => {
                    const Icon = item.icon
                    const selecionado = ativo(item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.descricao}
                        className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${
                          selecionado
                            ? 'bg-slate-100 text-brand-navy'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                        }`}
                      >
                        <Icon size={17} className="mt-0.5 shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium leading-5">{item.label}</span>
                          <span className="mt-0.5 block text-[10px] leading-4 text-slate-400 group-hover:text-slate-500">{item.descricao}</span>
                        </span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {semResultados && (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
              Nenhuma opção encontrada para “{busca}”.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="mb-3 px-3">
          <p className="truncate text-xs font-semibold text-slate-700">{usuario?.nome || 'Usuário'}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">{usuario?.role || ''}</p>
        </div>
        <button
          type="button"
          onClick={alternarTema}
          className="atlas-theme-toggle mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          title={tema === 'escuro' ? 'Usar tema claro' : 'Usar tema escuro'}
        >
          {tema === 'escuro' ? <Sun size={17} /> : <Moon size={17} />}
          {tema === 'escuro' ? 'Tema claro' : 'Tema escuro'}
        </button>
        <button
          type="button"
          onClick={sair}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={17} /> Sair
        </button>
      </div>
    </nav>
  )
}
