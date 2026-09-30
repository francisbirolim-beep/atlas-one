export type WVetroOperacionalRecurso =
  | 'pessoas'
  | 'tipos_pessoa'
  | 'vendedores'
  | 'orcamentos'
  | 'pedidos'
  | 'pedido'
  | 'metas'
  | 'notas_entrada'
  | 'itens_nf'
  | 'estoque_movimentos'
  | 'titulos'
  | 'titulos_baixados'
  | 'contas'
  | 'plano_contas'
  | 'extrato'
  | 'lotes_producao'
  | 'producao_projeto'
  | 'instalacoes'
  | 'linhas'
  | 'cores'
  | 'vidros'

export type WVetroMigracaoPrioridade = 'maxima' | 'alta' | 'media' | 'baixa'
export type WVetroMigracaoStatus = 'preparado_leitura' | 'parcial' | 'planejado'

export interface WVetroMigracaoMapaItem {
  recurso: WVetroOperacionalRecurso
  grupo: string
  endpoint: string
  prioridade: WVetroMigracaoPrioridade
  status: WVetroMigracaoStatus
  loteMaxDias: number | null
  destinosAtlas: string[]
  chaveExterna: string[]
  estrategia: string
  observacoes?: string[]
}

export const WVETRO_MIGRACAO_OPERACIONAL_MAPA: WVetroMigracaoMapaItem[] = [
  {
    recurso: 'pessoas',
    grupo: 'Pessoas',
    endpoint: 'GET /pessoa/listPessoa',
    prioridade: 'maxima',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['clientes', 'fornecedores'],
    chaveExterna: ['PessoaId', 'PessoaCodigo'],
    estrategia: 'Staging primeiro; reconciliar CPF/CNPJ, telefone e e-mail antes de criar ou vincular cadastro oficial.',
    observacoes: [
      'PessoaFornecedor/PessoaCliente/PessoaConstrutora/PessoaFuncionario definem papéis e não devem gerar duplicatas.',
      'Nome isolado nunca é chave suficiente para merge automático.',
    ],
  },
  {
    recurso: 'tipos_pessoa',
    grupo: 'Pessoas',
    endpoint: 'GET /pessoa/listTipo',
    prioridade: 'media',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['clientes'],
    chaveExterna: ['TipoclienteId'],
    estrategia: 'Preservar como classificação de origem até existir taxonomia operacional equivalente no Atlas.',
  },
  {
    recurso: 'vendedores',
    grupo: 'Pessoas',
    endpoint: 'GET /pessoa/listVendedor',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['usuarios', 'vendas_obras', 'orcamentos'],
    chaveExterna: ['VendedorId'],
    estrategia: 'Mapeamento manual/assistido para usuário Atlas; nunca criar login automaticamente a partir do W.Vetro.',
  },
  {
    recurso: 'orcamentos',
    grupo: 'Vendas',
    endpoint: 'GET /vendas/orcamentos',
    prioridade: 'maxima',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['orcamentos', 'obras', 'vendas_obras', 'clientes', 'historico'],
    chaveExterna: ['Nro'],
    estrategia: 'Importar histórico em staging por janela de até 7 dias; vincular cliente e obra antes de promover.',
    observacoes: [
      'Itens[] contém Linha, Modelo, Nome, Codigo, Largura, Altura, Ambiente, Qtde, ValorTotal e composição.',
      'Preservar payload bruto para reprocessamento e auditoria.',
    ],
  },
  {
    recurso: 'pedidos',
    grupo: 'Vendas',
    endpoint: 'GET /vendas/pedidos',
    prioridade: 'maxima',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['orcamentos', 'obras', 'vendas_obras', 'clientes', 'historico'],
    chaveExterna: ['Nro'],
    estrategia: 'Mesmo pipeline de orçamentos; pedido vendido tem precedência operacional quando houver duplicidade com orçamento.',
  },
  {
    recurso: 'pedido',
    grupo: 'Vendas',
    endpoint: 'GET /vendas/pedidoByKey',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['orcamentos', 'obras', 'vendas_obras'],
    chaveExterna: ['Orcamentoid', 'Nro'],
    estrategia: 'Usar para conferência/detalhe e recuperação pontual de um pedido após a carga por período.',
  },
  {
    recurso: 'metas',
    grupo: 'Vendas',
    endpoint: 'GET /vendas/listMetas',
    prioridade: 'baixa',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['crm_metas'],
    chaveExterna: ['id'],
    estrategia: 'Importação opcional; manter separada do histórico comercial principal.',
  },
  {
    recurso: 'notas_entrada',
    grupo: 'Compras',
    endpoint: 'GET /compras/nf',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['compras_nfs', 'fornecedores', 'historico_precos_compra'],
    chaveExterna: ['NFCompraId', 'NFCompraChaveNFe'],
    estrategia: 'Criar staging por NF; promover somente após reconciliar fornecedor e chave de acesso.',
  },
  {
    recurso: 'itens_nf',
    grupo: 'Compras',
    endpoint: 'GET /compras/itemNf',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['compras_nf_itens', 'produto_fornecedores', 'historico_precos_compra'],
    chaveExterna: ['ItemNFCompraId', 'NFCompraId'],
    estrategia: 'Reconciliar ProdutoCodigo com codigo/codigo_origem/id_externo_wvetro; divergências ficam pendentes.',
  },
  {
    recurso: 'estoque_movimentos',
    grupo: 'Estoque',
    endpoint: 'GET /estoque/movimentoEstoque',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['estoque_movimentos'],
    chaveExterna: ['MovimentoEstoqueDocumento', 'ProdutoId', 'MovimentoEstoqueDtLancamento'],
    estrategia: 'Importar inicialmente como histórico auditável; não recalcular saldo oficial até existir saldo inicial validado.',
  },
  {
    recurso: 'titulos',
    grupo: 'Financeiro',
    endpoint: 'GET /Financeiro/listTitulos',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['financeiro_contas_receber', 'financeiro_contas_pagar'],
    chaveExterna: ['TituloId'],
    estrategia: 'Classificar pelo TituloTipo/origem antes de promover para receber ou pagar.',
  },
  {
    recurso: 'titulos_baixados',
    grupo: 'Financeiro',
    endpoint: 'GET /Financeiro/listTitulosBaixados',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['financeiro_recebimentos', 'financeiro_contas_receber', 'financeiro_contas_pagar'],
    chaveExterna: ['TituloId', 'TituloDtBaixa'],
    estrategia: 'Usar para reconstruir baixa/recebimento sem duplicar o título aberto correspondente.',
  },
  {
    recurso: 'contas',
    grupo: 'Financeiro',
    endpoint: 'GET /Financeiro/listContas',
    prioridade: 'media',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['configuracoes_gerais'],
    chaveExterna: ['id', 'contaNro'],
    estrategia: 'Referência de origem; não substituir configuração bancária operacional sem validação.',
  },
  {
    recurso: 'plano_contas',
    grupo: 'Financeiro',
    endpoint: 'GET /Financeiro/listPlanoContas',
    prioridade: 'media',
    status: 'preparado_leitura',
    loteMaxDias: null,
    destinosAtlas: ['configuracoes_gerais'],
    chaveExterna: ['id', 'codigo'],
    estrategia: 'Staging e mapeamento para taxonomia Atlas antes de qualquer uso operacional.',
  },
  {
    recurso: 'extrato',
    grupo: 'Financeiro',
    endpoint: 'GET /Financeiro/listExtrato',
    prioridade: 'media',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['historico'],
    chaveExterna: ['id', 'contaId', 'data', 'documento'],
    estrategia: 'Histórico de conferência; não gera lançamento automático na primeira fase.',
  },
  {
    recurso: 'lotes_producao',
    grupo: 'Produção',
    endpoint: 'GET /producao/lotes',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['ordens_producao', 'historico'],
    chaveExterna: ['id', 'nro'],
    estrategia: 'Migrar histórico concluído e contexto de lote; não reabrir automaticamente produção antiga.',
  },
  {
    recurso: 'producao_projeto',
    grupo: 'Produção',
    endpoint: 'GET /producao/producaoProjeto',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['ordens_producao', 'historico'],
    chaveExterna: ['id', 'loteId', 'orcamento'],
    estrategia: 'Detalhar execução por projeto e relacionar ao orçamento migrado.',
  },
  {
    recurso: 'instalacoes',
    grupo: 'Instalação',
    endpoint: 'GET /producao/instalacoes',
    prioridade: 'alta',
    status: 'preparado_leitura',
    loteMaxDias: 7,
    destinosAtlas: ['historico', 'setor_kanban_itens'],
    chaveExterna: ['ProgInstalacaoId', 'ProgInstalacaoNro'],
    estrategia: 'Primeira fase apenas histórico; cards ativos só depois de regra explícita para instalações em aberto.',
  },
  {
    recurso: 'linhas',
    grupo: 'Catálogo técnico',
    endpoint: 'GET /Produtos/linhas',
    prioridade: 'alta',
    status: 'parcial',
    loteMaxDias: null,
    destinosAtlas: ['linhas_tecnicas', 'wvetro_referencias_linhas'],
    chaveExterna: ['LinhaId'],
    estrategia: 'Já existe referência técnica; manter reconciliação sem sobrescrever linha Atlas validada.',
  },
  {
    recurso: 'cores',
    grupo: 'Catálogo técnico',
    endpoint: 'GET /Produtos/cores',
    prioridade: 'media',
    status: 'parcial',
    loteMaxDias: null,
    destinosAtlas: ['cores'],
    chaveExterna: ['CorNome'],
    estrategia: 'Prévia e mapeamento; não criar acabamento automaticamente sem conferir nomenclatura.',
  },
  {
    recurso: 'vidros',
    grupo: 'Catálogo técnico',
    endpoint: 'GET /Produtos/vidros',
    prioridade: 'media',
    status: 'planejado',
    loteMaxDias: null,
    destinosAtlas: ['wvetro_referencias_vidros', 'produtos'],
    chaveExterna: ['CorNome'],
    estrategia: 'Validar resposta real porque o schema publicado no Postman replica o endpoint de cores.',
  },
]

export function mapaWVetroPorRecurso(recurso: string) {
  return WVETRO_MIGRACAO_OPERACIONAL_MAPA.find(item => item.recurso === recurso) || null
}
