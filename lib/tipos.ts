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
  created_at?: string
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
  descricao_livre?: string
  valor_estimado?: number | null
  status: StatusOrcamento
  coluna_id?: string | null
  observacoes?: string
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
