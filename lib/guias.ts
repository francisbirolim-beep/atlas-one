import { History, BarChart3, Users, Columns3, Settings, LayoutGrid, ListTodo, UserPlus, Home, FileText, ListChecks } from 'lucide-react'

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
  { href: '/orcamento', label: 'Orçamento', icon: FileText, grupo: 'Comercial' },
  { href: '/kanban', label: 'Painel de Orçamentos', icon: Columns3, grupo: 'Comercial' },
  { href: '/historico', label: 'Histórico', icon: History, grupo: 'Comercial' },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3, grupo: 'Sistema' },
  { href: '/setores', label: 'Setores', icon: LayoutGrid, grupo: 'Sistema' },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, grupo: 'Sistema' },
  { href: '/configuracoes', label: 'Configurações', icon: Settings, masterOnly: true, grupo: 'Sistema' },
  { href: '/configuracoes/campos', label: 'Campos e Formulários', icon: ListChecks, masterOnly: true, grupo: 'Sistema' },
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

// Ordem personalizada dos itens da lista "Mais" (arrastar nao, so mover com botoes)
const CHAVE_ORDEM = 'atlas_guias_ordem'
export const EVENTO_ORDEM_MUDOU = 'atlas_guias_ordem_mudou'

export function lerOrdem(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const bruto = window.localStorage.getItem(CHAVE_ORDEM)
    if (!bruto) return []
    const lista = JSON.parse(bruto)
    return Array.isArray(lista) ? lista : []
  } catch {
    return []
  }
}

function salvarOrdem(lista: string[]) {
  window.localStorage.setItem(CHAVE_ORDEM, JSON.stringify(lista))
  window.dispatchEvent(new Event(EVENTO_ORDEM_MUDOU))
}

// Reordena "itens" (que tem .href) de acordo com a ordem salva pelo usuario.
// Itens sem posicao salva aparecem no final, na ordem original.
export function ordenarPorPreferencia<T extends { href: string }>(itens: T[], ordem: string[]): T[] {
  const posicao = new Map(ordem.map((href, i) => [href, i]))
  return [...itens].sort((a, b) => {
    const pa = posicao.has(a.href) ? posicao.get(a.href)! : Infinity
    const pb = posicao.has(b.href) ? posicao.get(b.href)! : Infinity
    if (pa !== pb) return pa - pb
    return 0
  })
}

// Move um item para cima ou para baixo dentro da lista informada (ja ordenada) e salva a nova ordem.
export function moverGuia(itensOrdenados: { href: string }[], href: string, direcao: 'cima' | 'baixo') {
  const lista = itensOrdenados.map(i => i.href)
  const pos = lista.indexOf(href)
  if (pos === -1) return
  const novaPos = direcao === 'cima' ? pos - 1 : pos + 1
  if (novaPos < 0 || novaPos >= lista.length) return
  const nova = [...lista]
  const tmp = nova[novaPos]
  nova[novaPos] = nova[pos]
  nova[pos] = tmp
  salvarOrdem(nova)
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
