import { CLIENTE_360_RECURSOS, type RecursoCliente360 } from './cliente360Permissoes'

// Mapeamento de rotas para os módulos de permissão já usados em Configurações > Usuários.
// Ordem importa: rotas específicas vêm antes das gerais.
const ROTAS: Array<{ prefixo: string; titulo: string; modulos: string[] }> = [
  { prefixo: '/financeiro/contas-pagar', titulo: 'Contas a pagar', modulos: ['contas-pagar'] },
  { prefixo: '/financeiro/contas-receber', titulo: 'Contas a receber', modulos: ['contas-receber'] },
  { prefixo: '/financeiro/caixa', titulo: 'Caixa', modulos: ['caixa'] },
  { prefixo: '/financeiro', titulo: 'Financeiro', modulos: ['financeiro-geral', 'contas-pagar', 'contas-receber'] },
  { prefixo: '/clientes', titulo: 'Clientes', modulos: ['portal-cliente'] },
  { prefixo: '/crm', titulo: 'CRM', modulos: ['crm'] },
  { prefixo: '/kanban/comercial', titulo: 'Kanban de orçamentos', modulos: ['pedido-orcamento', 'fazer-orcamento'] },
  { prefixo: '/orcamento-rapido', titulo: 'Pedido de orçamento', modulos: ['pedido-orcamento', 'fazer-orcamento'] },
  { prefixo: '/orcamento', titulo: 'Orçamentos', modulos: ['fazer-orcamento', 'pedido-orcamento'] },
  { prefixo: '/vendas', titulo: 'Vendas', modulos: ['fazer-orcamento', 'recebimento-vendas'] },
  { prefixo: '/balcao/caixa', titulo: 'Caixa do balcão', modulos: ['caixa'] },
  { prefixo: '/balcao', titulo: 'Venda balcão', modulos: ['venda-balcao'] },
  { prefixo: '/compras/entrada-manual', titulo: 'Entrada manual de mercadorias', modulos: ['recebimento', 'compras'] },
  { prefixo: '/compras/entrada', titulo: 'Entrada de mercadorias', modulos: ['recebimento', 'compras'] },
  { prefixo: '/compras/solicitacoes', titulo: 'Solicitações de compra', modulos: ['compras'] },
  { prefixo: '/compras', titulo: 'Compras', modulos: ['compras', 'compras-perfis', 'compras-acessorios', 'compras-vidros'] },
  { prefixo: '/estoque', titulo: 'Estoque', modulos: ['estoque'] },
  { prefixo: '/producao/medicao-final', titulo: 'Medição final', modulos: ['medida-final'] },
  { prefixo: '/medicao-final', titulo: 'Medição final', modulos: ['medida-final'] },
  { prefixo: '/producao/instalacao', titulo: 'Instalação', modulos: ['instalacao'] },
  { prefixo: '/producao/separacao', titulo: 'Separação de materiais', modulos: ['producao', 'estoque'] },
  { prefixo: '/producao', titulo: 'Produção', modulos: ['producao', 'qualidade', 'instalacao'] },
  { prefixo: '/engenharia/editor-acessorios', titulo: 'Biblioteca técnica', modulos: ['biblioteca-tecnica'] },
  { prefixo: '/engenharia', titulo: 'Engenharia', modulos: ['engenharia-geral', 'mee', 'biblioteca-tecnica'] },
  { prefixo: '/assistencias', titulo: 'Assistências', modulos: ['assistencia-painel'] },
  { prefixo: '/assistencia', titulo: 'Abrir assistência', modulos: ['assistencia-abrir'] },
  { prefixo: '/cadastros', titulo: 'Cadastros', modulos: ['cadastros'] },
  { prefixo: '/cadastro', titulo: 'Cadastros', modulos: ['cadastros'] },
  { prefixo: '/configuracoes', titulo: 'Configurações', modulos: ['configuracoes'] },
  { prefixo: '/administracao', titulo: 'Administração', modulos: ['direcao', 'configuracoes'] },
  { prefixo: '/relatorios', titulo: 'Relatórios', modulos: ['bi', 'relatorios-financeiros'] },
  { prefixo: '/prospeccao', titulo: 'Prospecção', modulos: ['crm'] },
  { prefixo: '/tarefas', titulo: 'Tarefas', modulos: ['crm'] },
  { prefixo: '/whatsapp', titulo: 'WhatsApp', modulos: [] },
]

const ABAS_MODULOS: Partial<Record<RecursoCliente360, string[]>> = {
  cadastro: ['portal-cliente'],
  visao: ['portal-cliente'],
  orcamentos: ['fazer-orcamento', 'pedido-orcamento'],
  vendas: ['fazer-orcamento', 'recebimento-vendas'],
  obras: ['portal-cliente'],
  financeiro: ['contas-receber', 'recebimento-vendas'],
  medicoes: ['medida-final'],
  assistencias: ['assistencia-painel'],
  compras: ['compras'],
  documentos: ['portal-cliente'],
  historico: ['portal-cliente'],
  observacoes: ['portal-cliente'],
}

export type ContextoPermissaoTela = {
  titulo: string
  moduloIds: string[]
  recursoCliente360?: RecursoCliente360
}

export function resolverContextoPermissoes(pathname: string, abaCliente?: RecursoCliente360): ContextoPermissaoTela {
  if (/^\/clientes\/[^/]+(?:\/|$)/.test(pathname)) {
    let recurso: RecursoCliente360 = abaCliente || 'visao'
    if (pathname.includes('/financeiro')) recurso = 'financeiro'
    else if (pathname.includes('/vendas')) recurso = 'vendas'
    else if (pathname.includes('/orcamentos')) recurso = 'orcamentos'
    const rotulo = CLIENTE_360_RECURSOS.find(([id]) => id === recurso)?.[1] || 'Visão geral'
    return { titulo: 'Cliente 360 — ' + rotulo, moduloIds: ABAS_MODULOS[recurso] || ['portal-cliente'], recursoCliente360: recurso }
  }
  const rota = ROTAS.find(({ prefixo }) => pathname === prefixo || pathname.startsWith(prefixo + '/'))
  return rota
    ? { titulo: rota.titulo, moduloIds: rota.modulos }
    : { titulo: 'Esta tela', moduloIds: [] }
}
