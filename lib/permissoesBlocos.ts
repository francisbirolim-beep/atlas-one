import type { Setor } from './tipos'

export type BlocoPermissaoId =
  | 'comercial'
  | 'financeiro'
  | 'clientes'
  | 'engenharia'
  | 'producao'
  | 'compras_estoque'
  | 'administracao'
  | 'conhecimento'
  | 'outros'

export type ItemPermissaoBloco = {
  setorId: string
  label: string
  descricao: string
  bloco: BlocoPermissaoId
  escopo?: 'crm'
}

export type BlocoPermissaoUsuario = {
  id: BlocoPermissaoId
  label: string
  descricao: string
  itens: ItemPermissaoBloco[]
}

const BLOCOS: Array<Omit<BlocoPermissaoUsuario, 'itens'>> = [
  { id:'comercial', label:'Comercial', descricao:'CRM, orçamento, balcão, contratos e comissões.' },
  { id:'financeiro', label:'Financeiro', descricao:'Consultas financeiras, contas a receber, caixa, fiscal e relatórios.' },
  { id:'clientes', label:'Clientes e relacionamento', descricao:'Portais, pós-venda, assistência e relacionamento com o cliente.' },
  { id:'engenharia', label:'Engenharia e técnico', descricao:'Projeto, MEE, medições, biblioteca e desenvolvimento técnico.' },
  { id:'producao', label:'Produção e instalação', descricao:'Produção, medida final, qualidade, instalação e logística.' },
  { id:'compras_estoque', label:'Compras e estoque', descricao:'Compras por categoria, estoque e recebimento de materiais.' },
  { id:'administracao', label:'Administração', descricao:'Cadastros, configurações, RH, direção, automações e gestão.' },
  { id:'conhecimento', label:'Conhecimento', descricao:'Universidade e conteúdo técnico interno.' },
  { id:'outros', label:'Outros acessos', descricao:'Funcionalidades que ainda não foram classificadas nos blocos acima.' },
]

const DEFINICOES: Record<string, Omit<ItemPermissaoBloco, 'setorId'>> = {
  crm: { label:'CRM e carteira comercial', descricao:'Funil, tarefas, metas e acompanhamento das oportunidades.', bloco:'comercial', escopo:'crm' },
  orcamentos: { label:'Pedido de orçamento', descricao:'Criar e acompanhar pedidos de orçamento.', bloco:'comercial' },
  'fazer-orcamento-msanfyvj': { label:'Fazer orçamento', descricao:'Montagem e edição técnica/comercial do orçamento.', bloco:'comercial' },
  'venda-balcao': { label:'Venda balcão', descricao:'Venda, orçamento balcão, consulta de preço e histórico.', bloco:'comercial' },
  contratos: { label:'Contratos e documentos comerciais', descricao:'Documentos e contratos vinculados à venda.', bloco:'comercial' },
  comissoes: { label:'Comissões e RT', descricao:'Comissões comerciais e responsabilidade técnica.', bloco:'comercial' },
  representantes: { label:'Representantes comerciais', descricao:'Gestão e consulta de representantes.', bloco:'comercial' },

  financeiro: { label:'Financeiro geral', descricao:'Consulta financeira geral e acesso financeiro pela IA do Atlas.', bloco:'financeiro' },
  'caixa-balcao': { label:'Contas a receber / Caixa', descricao:'Consultar contas a receber; Editar permite registrar operações e baixas do caixa.', bloco:'financeiro' },
  fiscal: { label:'Faturamento e fiscal', descricao:'Faturamento, notas e informações fiscais.', bloco:'financeiro' },
  'relatorios-balcao': { label:'Relatórios financeiros do balcão', descricao:'Indicadores, margens e relatórios gerenciais do balcão.', bloco:'financeiro' },

  'portal-cliente': { label:'Portal do cliente', descricao:'Informações e recursos destinados ao cliente.', bloco:'clientes' },
  'portal-parceiros': { label:'Portal de parceiros', descricao:'Arquitetos, engenheiros, construtoras e parceiros.', bloco:'clientes' },
  'pos-venda': { label:'Pós-venda e garantia', descricao:'Acompanhamento de pós-venda, garantia e assistência.', bloco:'clientes' },
  'assistencia-abrir': { label:'Abrir assistência', descricao:'Abrir um novo chamado de assistência.', bloco:'clientes' },
  'assistencia-painel': { label:'Painel de assistências', descricao:'Consultar ou editar os chamados de assistência.', bloco:'clientes' },
  marketing: { label:'Marketing', descricao:'Recursos e dados do setor de marketing.', bloco:'clientes' },

  'engenharia-projeto': { label:'Conferir projeto', descricao:'Conferência do projeto vendido antes da liberação.', bloco:'engenharia' },
  mee: { label:'Motor de Engenharia (MEE)', descricao:'Regras, receitas e cálculos técnicos de esquadrias.', bloco:'engenharia' },
  engenharia: { label:'Engenharia e projetos', descricao:'Recursos gerais do setor de engenharia.', bloco:'engenharia' },
  medicao: { label:'Visitas técnicas e medições', descricao:'Medições e visitas técnicas de obra.', bloco:'engenharia' },
  'modelagem-3d': { label:'Modelagem 3D', descricao:'Engenharia e modelagem tridimensional.', bloco:'engenharia' },
  'biblioteca-tecnica': { label:'Biblioteca técnica', descricao:'Consulta e manutenção do conhecimento técnico.', bloco:'engenharia' },
  ped: { label:'Pesquisa e desenvolvimento', descricao:'P&D técnico e evolução de soluções.', bloco:'engenharia' },

  producao: { label:'Produção', descricao:'Kanban de produção, ordens e plano de corte.', bloco:'producao' },
  'medida-final-msdwtt9y': { label:'Medida final', descricao:'Fluxo oficial de medição final antes da produção.', bloco:'producao' },
  qualidade: { label:'Qualidade', descricao:'Conferências e rotinas de qualidade.', bloco:'producao' },
  instalacao: { label:'Instalação', descricao:'Planejamento e execução de instalações.', bloco:'producao' },
  logistica: { label:'Logística e entregas', descricao:'Entregas e movimentações operacionais.', bloco:'producao' },

  compras: { label:'Compras', descricao:'Gestão geral das compras por obra.', bloco:'compras_estoque' },
  'compras-perfis': { label:'Compras de perfis', descricao:'Fluxo de perfis por obra.', bloco:'compras_estoque' },
  'compras-acessorios': { label:'Compras de acessórios', descricao:'Fluxo de acessórios por obra.', bloco:'compras_estoque' },
  'compras-vidros': { label:'Compras de vidros', descricao:'Fluxo de vidros por obra.', bloco:'compras_estoque' },
  'compras-outros': { label:'Outros materiais', descricao:'Demais materiais necessários para a obra.', bloco:'compras_estoque' },
  estoque: { label:'Estoque', descricao:'Consulta e movimentação de estoque.', bloco:'compras_estoque' },
  recebimento: { label:'Recebimento de mercadorias', descricao:'Receber e conferir materiais comprados.', bloco:'compras_estoque' },

  cadastro: { label:'Cadastros técnicos', descricao:'Linhas, cores, materiais, produtos e fornecedores.', bloco:'administracao' },
  configuracoes: { label:'Configurações do Atlas', descricao:'Configurações, governança e auditoria do sistema.', bloco:'administracao' },
  'workflow-automacoes': { label:'Automações do fluxo', descricao:'Gatilhos, tarefas, responsáveis e notificações automáticas.', bloco:'administracao' },
  rh: { label:'Recursos Humanos', descricao:'Informações e rotinas de RH.', bloco:'administracao' },
  direcao: { label:'Direção e administração', descricao:'Informações administrativas e de direção.', bloco:'administracao' },
  consultoria: { label:'Inteligência de gestão', descricao:'Consultoria e inteligência gerencial.', bloco:'administracao' },
  relatorios: { label:'Relatórios e BI', descricao:'Relatórios consolidados e indicadores gerenciais.', bloco:'administracao' },

  universidade: { label:'Universidade Atlas', descricao:'Treinamentos e conhecimento interno.', bloco:'conhecimento' },
}

export function montarBlocosPermissao(setores: Setor[]): BlocoPermissaoUsuario[] {
  const itens = setores.map((setor): ItemPermissaoBloco => {
    const definido = DEFINICOES[setor.id]
    if (definido) return { setorId:setor.id, ...definido }
    return {
      setorId:setor.id,
      label:setor.nome,
      descricao:setor.descricao || 'Acesso ao setor no Atlas.',
      bloco:'outros',
    }
  })

  return BLOCOS
    .map(bloco => ({ ...bloco, itens: itens.filter(item => item.bloco === bloco.id) }))
    .filter(bloco => bloco.itens.length > 0)
}