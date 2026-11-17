import { FilePlus2, FileText, Search, ShoppingCart, Users, type LucideIcon } from 'lucide-react'
import { GUIAS } from './guias'

export type HomeAtalho = {
  href: string
  label: string
  grupo: string
  icon: LucideIcon
  cor: string
  masterOnly?: boolean
}

export const HOME_ATALHOS_PADRAO = [
  '/orcamento-rapido',
  '/previews/consulta-preco',
  '/previews/orcamento',
  '/previews/venda',
  '/clientes/identificar',
] as const

// Mantém exatamente os cinco acessos da Home aprovada quando não há preferência salva.
// As opções adicionais aproveitam as rotas oficiais, sem criar nem liberar módulos.
const PRINCIPAIS: HomeAtalho[] = [
  { href: '/orcamento-rapido', label: 'Pedido de Orçamento', grupo: 'Comercial', icon: FilePlus2, cor: 'bg-blue-100 text-blue-700' },
  { href: '/previews/consulta-preco', label: 'Consulta de Preço', grupo: 'Comercial', icon: Search, cor: 'bg-amber-100 text-amber-700' },
  { href: '/previews/orcamento', label: 'Orçamento', grupo: 'Comercial', icon: FileText, cor: 'bg-indigo-100 text-indigo-700' },
  { href: '/previews/venda', label: 'Venda', grupo: 'Comercial', icon: ShoppingCart, cor: 'bg-emerald-100 text-emerald-700' },
  { href: '/clientes/identificar', label: 'Cliente 360', grupo: 'Comercial', icon: Users, cor: 'bg-violet-100 text-violet-700' },
]

export const HOME_ATALHOS: HomeAtalho[] = [
  ...PRINCIPAIS,
  ...GUIAS.filter(guia => guia.href !== '/' && !PRINCIPAIS.some(principal => principal.href === guia.href))
    .map(guia => ({
      href: guia.href,
      label: guia.label,
      grupo: guia.grupo,
      icon: guia.icon,
      cor: 'bg-slate-100 text-slate-700',
      masterOnly: guia.masterOnly,
    })),
]

export const HOME_ATALHOS_MAX = 15
const ROTAS_VALIDAS = new Set(HOME_ATALHOS.map(atalho => atalho.href))

// undefined = usuário ainda não personalizou. [] = usuário optou por nenhum atalho.
export function normalizarAtalhosInicio(valor: unknown): string[] | undefined {
  if (!Array.isArray(valor)) return undefined
  return Array.from(new Set(
    valor.filter((href): href is string => typeof href === 'string' && ROTAS_VALIDAS.has(href)),
  )).slice(0, HOME_ATALHOS_MAX)
}

export function atalhosInicioEfetivos(valor: unknown): string[] {
  return normalizarAtalhosInicio(valor) ?? [...HOME_ATALHOS_PADRAO]
}
