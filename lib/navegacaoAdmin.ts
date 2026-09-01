import {
  Boxes,
  Building2,
  Calculator,
  Compass,
  FileText,
  KeyRound,
  LayoutGrid,
  Settings,
} from 'lucide-react'

export type ItemAdmin = {
  href: string
  label: string
  descricao: string
  icon: typeof Settings
  palavras: string
}

export const ITENS_ADMIN: ItemAdmin[] = [
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
