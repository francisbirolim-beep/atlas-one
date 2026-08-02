import { History, BarChart3, Users, Columns3, Settings, LayoutGrid, Wrench, ListTodo, UserPlus, Home, FileText } from 'lucide-react'

export type Guia = {
  href: string
  label: string
  icon: typeof LayoutGrid
  masterOnly?: boolean
}

export const GUIAS: Guia[] = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/setores', label: 'Setores', icon: LayoutGrid },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/orcamento-rapido', label: 'Orçamento Rápido', icon: FileText },
  { href: '/kanban', label: 'Painel de Orçamentos', icon: Columns3 },
  { href: '/assistencia', label: 'Abrir Assistência', icon: Wrench },
  { href: '/assistencias', label: 'Assistências', icon: Wrench },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, masterOnly: true },
  { href: '/cadastro', label: 'Cadastro', icon: UserPlus, masterOnly: true },
]

export const CHAVE_OCULTOS = 'atlas_guias_ocultos'
export const EVENTO_OCULTOS_MUDOU = 'guias-ocultos-changed'

export function lerOcultos(): string[] {
  try {
    const salvo = localStorage.getItem(CHAVE_OCULTOS)
    if (salvo) return JSON.parse(salvo)
  } catch {}
  // Por padrao, comeca tudo na lista lateral ("Mais"); o usuario adiciona ao guia rapido o que quiser.
  return GUIAS.map((g) => g.href)
}

export function salvarOcultos(ocultos: string[]) {
  try {
    localStorage.setItem(CHAVE_OCULTOS, JSON.stringify(ocultos))
  } catch {}
}

export function alternarOculto(href: string): string[] {
  const atuais = lerOcultos()
  const novo = atuais.includes(href) ? atuais.filter((h) => h !== href) : [...atuais, href]
  salvarOcultos(novo)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_OCULTOS_MUDOU))
  return novo
}

// Itens marcados com a estrela (fora da lista de ocultos) = guia rapido do usuario.
export function guiasFavoritos(ocultos: string[], isMaster: boolean): Guia[] {
  return GUIAS.filter((g) => (!g.masterOnly || isMaster) && !ocultos.includes(g.href))
}
