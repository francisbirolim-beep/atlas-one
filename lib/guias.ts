import {
  Building2,
  Columns3,
  Factory,
  FileText,
  Home,
  Landmark,
  MapPinned,
  PackageSearch,
  ReceiptText,
  Ruler,
  Settings,
  ShoppingCart,
  Store,
  Users,
  WalletCards,
  Wrench,
} from 'lucide-react'

export type Guia = {
  href: string
  label: string
  icon: typeof Home
  masterOnly?: boolean
  grupo: string
}

// Navegação principal do dia a dia. "Geral" concentra acessos rápidos;
// os demais grupos representam setores e ficam recolhíveis no menu lateral.
export const GUIAS: Guia[] = [
  { href: '/', label: 'Início', icon: Home, grupo: 'Geral' },
  { href: '/balcao', label: 'Venda Balcão', icon: Store, grupo: 'Geral' },

  { href: '/clientes', label: 'Clientes', icon: Users, grupo: 'Comercial' },
  { href: '/obras', label: 'Obras', icon: Building2, grupo: 'Comercial' },
  { href: '/prospeccao', label: 'Prospecção', icon: MapPinned, grupo: 'Comercial' },
  { href: '/orcamento/pesquisar', label: 'Orçamentos', icon: FileText, grupo: 'Comercial' },
  { href: '/kanban', label: 'Kanban', icon: Columns3, grupo: 'Comercial' },
  { href: '/whatsapp/configuracao', label: 'Configuração WhatsApp', icon: Settings, grupo: 'Comercial', masterOnly: true },

  { href: '/producao/medicao-final', label: 'Medição Final', icon: Ruler, grupo: 'Produção' },
  { href: '/producao', label: 'Produção', icon: Factory, grupo: 'Produção' },

  { href: '/engenharia', label: 'Engenharia', icon: Landmark, grupo: 'Engenharia' },

  { href: '/compras', label: 'Pedido de compra', icon: ShoppingCart, grupo: 'Compras' },
  { href: '/compras/notas', label: 'Notas fiscais', icon: ReceiptText, grupo: 'Compras' },
  { href: '/compras/entrada', label: 'Entrada de NF', icon: FileText, grupo: 'Compras' },
  { href: '/estoque', label: 'Estoque', icon: PackageSearch, grupo: 'Compras' },
  { href: '/cadastro/fornecedores', label: 'Fornecedores', icon: Building2, grupo: 'Compras' },

  { href: '/balcao/caixa', label: 'Caixa', icon: WalletCards, grupo: 'Financeiro' },
  { href: '/financeiro/contas-pagar', label: 'Contas a pagar', icon: WalletCards, grupo: 'Financeiro' },
  { href: '/financeiro/contas-receber', label: 'Contas a receber', icon: WalletCards, grupo: 'Financeiro' },

  { href: '/assistencias', label: 'Assistências', icon: Wrench, grupo: 'Assistência' },

  { href: '/cadastro', label: 'Cadastros', icon: PackageSearch, grupo: 'Cadastros' },
]

export const GRUPOS_ORDEM_GUIAS = [
  'Geral',
  'Comercial',
  'Produção',
  'Engenharia',
  'Compras',
  'Financeiro',
  'Assistência',
  'Cadastros',
]

export const CHAVE_OCULTOS = 'atlas_guias_ocultos'
export const EVENTO_OCULTOS_MUDOU = 'guias-ocultos-changed'
export const EVENTO_ABRIR_FAVORITOS_MOBILE = 'atlas-mobile-favorites-open'

export function lerOcultos(): string[] {
  try {
    const salvo = localStorage.getItem(CHAVE_OCULTOS)
    if (salvo) return JSON.parse(salvo)
  } catch {}
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

export function ordenarPorPreferencia<T extends { href: string }>(itens: T[], ordem: string[]): T[] {
  const posicao = new Map(ordem.map((href, i) => [href, i]))
  return [...itens].sort((a, b) => {
    const pa = posicao.has(a.href) ? posicao.get(a.href)! : Infinity
    const pb = posicao.has(b.href) ? posicao.get(b.href)! : Infinity
    if (pa !== pb) return pa - pb
    return 0
  })
}

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

export function guiasFavoritos(ocultos: string[], isMaster: boolean): Guia[] {
  return GUIAS.filter((g) => (!g.masterOnly || isMaster) && !ocultos.includes(g.href))
}

export function agruparGuias(guias: Guia[]): { grupo: string; itens: Guia[] }[] {
  return GRUPOS_ORDEM_GUIAS
    .map((grupo) => ({ grupo, itens: guias.filter((g) => g.grupo === grupo) }))
    .filter((g) => g.itens.length > 0)
}
