// TipoEsquadria era um union fixo; agora e dinamico (tabela `tipologias`), mas mantido como alias
// de string para nao quebrar comparacoes/atribuicoes existentes com os valores historicos abaixo:
// 'porta_correr' | 'porta_pivotante' | 'porta_abrir' | 'janela_correr' | 'janela_maximiar'
// | 'janela_basculante' | 'vitro' | 'fachada' | 'box' | 'outro' | (qualquer chave criada pelo usuario)
export type TipoEsquadria = string

export type CategoriaTipologia =
      | 'porta'
      | 'janela'
      | 'modulo_fixo'
      | 'fachada'
      | 'box'
      | 'painel_ripado'
      | 'acm'
      | 'cobertura_claraboia'
      | 'contramarco_arremate'
      | 'espelho'
      | 'portao_grade'
      | 'guarda_corpo_corrimao'
      | 'vidro'
      | 'tela_mosquiteira'
      | 'outros'

export interface Tipologia {
      id: string
      chave: string
      label: string
      categoria: CategoriaTipologia
      ordem: number
      created_at?: string
      foto_url?: string | null
}

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

export type TemperaturaLead = 'quente' | 'morno' | 'frio'

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
      excluido_em?: string | null
      excluido_por_id?: string | null
      excluido_por_nome?: string | null
      motivo_exclusao?: string | null
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
      bairro?: string
      cep?: string
      email?: string
      telefone?: string
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
      // Marca se, ao entrar nessa coluna, o card representa um orçamento vendido
// (usado pelo módulo de Medição Final pra saber quais colunas contam como
// "vendido", sem depender do campo orcamentos.status que na prática fica
// desatualizado em relação à posição real no Kanban).
gera_medicao_final?: boolean
      created_at?: string
}

export type Contramarco = 'com' | 'sem'

export interface ItemEsquadria {
      id: string
      // Ambiente/cômodo onde essa esquadria vai ser instalada (ex: Sala, Quarto 1,
// Cozinha, Banheiro social...). Ajuda quem elabora o orçamento a saber onde
// fica cada item, sem depender só da ordem ou da descrição livre.
ambiente?: string | null
      tipo_esquadria: TipoEsquadria
      tipo_outro_texto?: string | null
      folhas?: string | null
      largura_mm: number
      altura_mm: number
      quantidade: number
      foto_url?: string | null
      // Fase 7: a esquadria pode ter varias fotos gerais (nao so uma). foto_url
// continua preenchida (com a primeira) por compatibilidade com telas que
// ainda mostram so uma foto por item; foto_urls tem a lista completa.
foto_urls?: string[] | null
      descricao?: string
      cor?: string | null
      // Medida final: 3 larguras (baixo/meio/cima) e 3 alturas (direita/meio/esquerda)
largura_baixo_mm?: number | null
      largura_meio_mm?: number | null
      largura_cima_mm?: number | null
      altura_direita_mm?: number | null
      altura_meio_mm?: number | null
      altura_esquerda_mm?: number | null
      // Fase 6: alternativa a digitar as medidas — foto da trena com as 3
// larguras / 3 alturas (mesmo padrão já usado na Medição Final).
foto_larguras_url?: string | null
      foto_alturas_url?: string | null
      // Fase 8: a esquadria pode vir de um Produto já cadastrado (Cadastro >
// Produtos) em vez de digitada na mão — nome/medidas/preço puxam do
// produto na hora de selecionar. Snapshot do preco na hora (não muda mais
// se o cadastro do produto for alterado depois — mesmo padrão do ItemBalcao).
produto_id?: string | null
      preco_unit?: number | null
      preco_total?: number | null
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
      fotos_urls?: string[] | null
      anexos?: Anexo[] | null
      tipo_medida?: 'comum' | 'final' | null
      modo_entrada?: string | null
      numero?: number
      temperatura?: TemperaturaLead | null
      itens_balcao?: any[]
      desconto?: number
      valor_balcao?: number | null
      cliente_id_balcao?: string | null
      cliente_nome_balcao?: string | null
      cliente_whatsapp_balcao?: string | null
      cidade_balcao?: string | null
      origem_balcao?: OrigemCliente | null
      margem_padrao_pct?: number
      cobrar_sobra_padrao?: boolean
      otimizacao_orcamento?: Record<string, unknown>
}

export interface Produto {
      id: string
      codigo?: string | null
      nome: string
      descricao?: string | null
      categoria?: string | null
      unidade?: string | null
      preco?: number | null
      custo?: number | null
      ativo?: boolean
      foto_url?: string | null
      largura_mm?: number | null
      altura_mm?: number | null
      tamanho_barra_mm?: number | null
      peso_kg_m?: number | null
      created_at?: string
      updated_at?: string
}
