import { History, BarChart3, Users, Columns3, Settings, LayoutGrid, Wrench, ListTodo, UserPlus } from 'lucide-react'

export type Guia = {
  href: string
  label: string
  icon: typeof LayoutGrid
  masterOnly?: boolean
}

export const GUIAS: Guia[] = [
  { href: '/setores', label: 'Setores', icon: LayoutGrid },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/kanban', label: 'Painel de OrÃ§amentos', icon: Columns3 },
  { href: '/assistencias', label: 'AssistÃªncias', icon: Wrench },
  { href: '/historico', label: 'HistÃ³rico', icon: History },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/configuracoes', label: 'ConfiguraÃ§Ãµes', icon: Settings, masterOnly: true },
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
