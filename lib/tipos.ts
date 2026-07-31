export type TipoEsquadria =
  | 'porta_correr' | 'porta_pivotante' | 'porta_abrir'
  | 'janela_correr' | 'janela_maximiar' | 'janela_basculante'
  | 'vitro' | 'fachada' | 'box' | 'outro'

export type Acabamento =
  | 'natural' | 'branco' | 'preto' | 'cinza' | 'madeirado'
  | 'pintura_eletrostatica' | 'outro'

export type StatusOrcamento =
  | 'rascunho' | 'enviado' | 'aprovado' | 'recusado' | 'convertido'

export type OrigemCliente =
  | 'indicacao' | 'arquiteto' | 'engenheiro' | 'construtora'
  | 'instagram' | 'facebook' | 'google' | 'whatsapp'
  | 'cliente_antigo' | 'passou_na_frente' | 'outros'

export type RoleUsuario = 'master' | 'funcionario'

export interface Usuario {
  id: string
  nome: string
  email: string
  role: RoleUsuario
  created_at?: string
}

export interface HistoricoItem {
  id: string
  orcamento_id: string
  usuario_nome?: string | null
  usuario_id?: string | null
  acao: string
  detalhes?: string | null
  created_at: string
}

export interface Cliente {
  id: string
  created_at: string
  nome: string
  whatsapp?: string
  cidade?: string
  cpf_cnpj?: string
  data_nascimento?: string
  endereco?: string
  origem: OrigemCliente
  responsavel?: string
  observacoes?: string
}

export interface KanbanColuna {
  id: string
  nome: string
  ordem: number
  cor?: string
  sla_amarelo_horas?: number | null
  sla_vermelho_horas?: number | null
  created_at?: string
}

export type Contramarco = 'com' | 'sem'

export interface ItemEsquadria {
  id: string
  tipo_esquadria: TipoEsquadria
  largura_mm: number
  altura_mm: number
  quantidade: number
  foto_url?: string | null
  descricao?: string
}

export interface OrcamentoRapido {
  id: string
  created_at: string
  cliente_id?: string
  cliente_nome: string
  cliente_whatsapp?: string
  cidade?: string
  origem?: OrigemCliente
  tipo_esquadria: TipoEsquadria
  largura_mm: number
  altura_mm: number
  quantidade: number
  acabamento?: Acabamento
  contramarco?: Contramarco | null
  itens?: ItemEsquadria[]
  descricao_livre?: string
  valor_estimado?: number | null
  status: StatusOrcamento
  coluna_id?: string | null
  coluna_atualizada_em?: string | null
  observacoes?: string
  arquiteto_nome?: string | null
  arquiteto_contato?: string | null
  criado_por_nome?: string | null
  criado_por_id?: string | null
}

export interface OrcamentoDetalhado extends OrcamentoRapido {
  fotos_urls: string[]
  medidas_trena: MedidaTrena[]
  perfis: ItemPerfil[]
  acessorios: ItemAcessorio[]
  vidro: ItemVidro
  custo_material: number
  custo_fabricacao: number
  margem: number
  valor_final: number
}

export interface MedidaTrena {
  label: string
  largura_mm: number
  altura_mm: number
  foto_url?: string
}

export interface ItemPerfil {
  nome: string
  referencia: string
  quantidade_m: number
  preco_m: number
}

export interface ItemAcessorio {
  nome: string
  quantidade: number
  preco_unit: number
}

export interface ItemVidro {
  tipo: string
  espessura_mm: number
  area_m2: number
  preco_m2: number
}
