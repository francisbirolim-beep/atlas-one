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
  whatsapp?: string | null
  created_at?: string
}

export interface Anexo {
  titulo: string
  nome: string
  url: string
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
  cor_cards?: string | null
  sla_amarelo_horas?: number | null
  sla_vermelho_horas?: number | null
  sla_amarelo_cor?: string | null
  sla_vermelho_cor?: string | null
  created_at?: string
}

export type Contramarco = 'com' | 'sem'

export interface ItemEsquadria {
  id: string
  tipo_esquadria: TipoEsquadria
  tipo_outro_texto?: string | null
  folhas?: string | null
  largura_mm: number
  altura_mm: number
  quantidade: number
  foto_url?: string | null
  descricao?: string
  cor?: string | null
  // Medida final: 3 larguras (baixo/meio/cima) e 3 alturas (direita/meio/esquerda)
  largura_baixo_mm?: number | null
  largura_meio_mm?: number | null
  largura_cima_mm?: number | null
  altura_direita_mm?: number | null
  altura_meio_mm?: number | null
  altura_esquerda_mm?: number | null
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
  acabamento_outro_texto?: string | null
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
  orcamento_iniciado_em?: string | null
  orcamento_finalizado_em?: string | null
  enviado_vendedor_em?: string | null
  anexo_url?: string | null
  anexo_nome?: string | null
  anexos?: Anexo[] | null
  tipo_medida?: 'comum' | 'final' | null
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

export type StatusAssistencia = 'aberto' | 'em_atendimento' | 'resolvido'

export interface Assistencia {
  id: string
  created_at: string
  cliente_id?: string | null
  cliente_nome: string
  cliente_whatsapp?: string | null
  cidade?: string | null
  endereco?: string | null
  numero?: string | null
  bairro?: string | null
  descricao_problema: string
  fotos_urls?: string[] | null
  status: StatusAssistencia
  criado_por_nome?: string | null
  criado_por_id?: string | null
  atualizado_em?: string | null
}
