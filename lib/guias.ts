import { History, BarChart3, Users, Columns3, Settings, LayoutGrid, Wrench, ListTodo, UserPlus, Home, FileText } from 'lucide-react'

export type Guia = {
  href: string
  label: string
  icon: typeof LayoutGrid
  masterOnly?: boolean
  grupo: string
}

export const GUIAS: Guia[] = [
  { href: '/', label: 'Início', icon: Home, grupo: 'Geral' },
  { href: '/tarefas', label: 'Tarefas', icon: ListTodo, grupo: 'Geral' },
  { href: '/clientes', label: 'Clientes', icon: Users, grupo: 'Comercial' },
  { href: '/orcamento-rapido', label: 'Orçamento Rápido', icon: FileText, grupo: 'Comercial' },
  { href: '/kanban', label: 'Painel de Orçamentos', icon: Columns3, grupo: 'Comercial' },
  { href: '/historico', label: 'Histórico', icon: History, grupo: 'Comercial' },
  { href: '/assistencia', label: 'Abrir Assistência', icon: Wrench, grupo: 'Técnico' },
  { href: '/assistencias', label: 'Assistências', icon: Wrench, grupo: 'Técnico' },
  { href: '/setores', label: 'Setores', icon: LayoutGrid, grupo: 'Sistema' },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, grupo: 'Sistema' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, masterOnly: true, grupo: 'Sistema' },
  { href: '/cadastro', label: 'Cadastro', icon: UserPlus, masterOnly: true, grupo: 'Sistema' },
]

// Ordem em que os grupos aparecem no menu lateral, ao estilo dos setores do sistema.
export const GRUPOS_ORDEM_GUIAS = ['Geral', 'Comercial', 'Técnico', 'Sistema']

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

// Agrupa os guias por area (Comercial, Tecnico, Sistema, Geral), na ordem definida acima.
export function agruparGuias(guias: Guia[]): { grupo: string; itens: Guia[] }[] {
  return GRUPOS_ORDEM_GUIAS
    .map((grupo) => ({ grupo, itens: guias.filter((g) => g.grupo === grupo) }))
    .filter((g) => g.itens.length > 0)
}
