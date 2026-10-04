export type AtalhoPesquisaAtlas = {
  href: string
  label: string
  grupo: string
  descricao: string
  palavras: string
  masterOnly?: boolean
}

export function normalizarPesquisaAtlas(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function correspondePesquisaAtlas(termo: string, ...partes: Array<string | null | undefined>) {
  const q = normalizarPesquisaAtlas(termo)
  if (!q) return true
  const alvo = normalizarPesquisaAtlas(partes.filter(Boolean).join(' '))
  return q.split(/\s+/).filter(Boolean).every(palavra => alvo.includes(palavra))
}

export function pontuarPesquisaAtlas(termo: string, titulo: string, busca: string) {
  const palavras = normalizarPesquisaAtlas(termo).split(/\s+/).filter(Boolean)
  const tituloNormalizado = normalizarPesquisaAtlas(titulo)
  const buscaNormalizada = normalizarPesquisaAtlas(busca)
  if (!palavras.length) return 0
  let pontos = 0
  for (const palavra of palavras) {
    if (tituloNormalizado.startsWith(palavra)) pontos += 8
    else if (tituloNormalizado.includes(palavra)) pontos += 5
    else if (buscaNormalizada.includes(palavra)) pontos += 2
    else return -100
  }
  return pontos
}

// Índice de navegação profunda. Estas telas não precisam ficar poluindo o menu
// principal, mas devem ser encontráveis pela busca global do Atlas.
export const ATALHOS_PESQUISA_ATLAS: AtalhoPesquisaAtlas[] = [
  { href:'/configuracoes/integracoes/wvetro', label:'Integração W.Vetro', grupo:'Integrações', descricao:'Central da integração W.Vetro com o Atlas', palavras:'integracao integração wvetro w vetro wvenda w venda vidro vetro api sincronizacao sincronização', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/orcamentos', label:'Orçamentos W.Vetro → Atlas', grupo:'Integrações', descricao:'Sincronizar, corrigir e acompanhar orçamentos W.Vetro', palavras:'integracao wvetro w vetro wvenda w venda orcamento orçamento sincronizar corrigir valores custos sobra margem cliente 360', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/base-tecnica', label:'Base técnica W.Vetro', grupo:'Integrações', descricao:'Perfis, acessórios, vidros e referências técnicas', palavras:'integracao wvetro base tecnica técnico perfil perfis acessorio acessórios vidro tipologia receita', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/base-tecnica/tipologias', label:'Tipologias W.Vetro', grupo:'Integrações', descricao:'Explorar tipologias importadas do W.Vetro', palavras:'integracao wvetro tipologia tipologias projeto esquadria modelo base tecnica', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/comparador-tecnico', label:'Comparador técnico W.Vetro', grupo:'Integrações', descricao:'Comparar composição técnica W.Vetro e Atlas', palavras:'integracao wvetro comparador comparar tecnico técnica perfil acessorio vidro', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/custos', label:'Custos W.Vetro', grupo:'Integrações', descricao:'Custos atuais observados no W.Vetro', palavras:'integracao wvetro custo custos preco preço perfil acessorio vidro', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/custos-historicos', label:'Histórico de custos W.Vetro', grupo:'Integrações', descricao:'Consultar custos históricos importados', palavras:'integracao wvetro custo custos historico histórico preço precos', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/auditoria', label:'Auditoria W.Vetro', grupo:'Integrações', descricao:'Auditar sincronização, dados e divergências', palavras:'integracao wvetro auditoria log divergencia erro sincronizacao', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/reconciliacao', label:'Reconciliação W.Vetro', grupo:'Integrações', descricao:'Reconciliar clientes e dados importados', palavras:'integracao wvetro reconciliacao reconciliação cliente vinculo vínculo duplicidade', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/migracao-operacional', label:'Migração operacional W.Vetro', grupo:'Integrações', descricao:'Migrar dados operacionais do W.Vetro', palavras:'integracao wvetro migracao migração operacional importacao importação dados', masterOnly:true },
  { href:'/configuracoes/integracoes/wvetro/reprocessar-pendencias', label:'Pendências W.Vetro', grupo:'Integrações', descricao:'Reprocessar falhas e pendências da integração', palavras:'integracao wvetro pendencia pendências erro falha reprocessar sincronizacao', masterOnly:true },

  { href:'/whatsapp', label:'WhatsApp', grupo:'Integrações', descricao:'Atendimento WhatsApp dentro do Atlas', palavras:'whatsapp whats atendimento conversa mensagens integração integracao cliente comercial' },
  { href:'/whatsapp/configuracao', label:'Configuração do WhatsApp', grupo:'Integrações', descricao:'Configurar atendimento e integração do WhatsApp', palavras:'whatsapp whats configuracao configuração integração integracao horario mensagem automatica gateway', masterOnly:true },
  { href:'/whatsapp/numeros', label:'Números do WhatsApp', grupo:'Integrações', descricao:'Gerenciar números e conexões do WhatsApp', palavras:'whatsapp whats numero números conexão conectar qr integração integracao', masterOnly:true },

  { href:'/atlas-ia', label:'Atlas IA', grupo:'Inteligência Artificial', descricao:'Central da inteligência artificial do Atlas', palavras:'ia inteligencia artificial atlas assistente chat pesquisa especialista' },
  { href:'/atlas-ia/aprendizado', label:'Aprendizado da IA', grupo:'Inteligência Artificial', descricao:'Aprendizado e validação da IA Atlas', palavras:'ia aprendizado aprender validacao validação conhecimento treinamento' },
  { href:'/atlas-ia/conhecimento', label:'Conhecimento da IA', grupo:'Inteligência Artificial', descricao:'Base de conhecimento do Atlas IA', palavras:'ia conhecimento catalogo catálogo documento regra treinamento' },
  { href:'/atlas-ia/especialistas', label:'Especialistas da IA', grupo:'Inteligência Artificial', descricao:'Especialistas e agentes do Atlas', palavras:'ia especialista especialistas agente agentes setor' },
  { href:'/atlas-ia/pessoas', label:'Pessoas na IA', grupo:'Inteligência Artificial', descricao:'Configurações de pessoas e IA', palavras:'ia pessoas usuario usuários equipe colaborador' },
  { href:'/administracao/ia', label:'Controle Master · Atlas IA', grupo:'Administração', descricao:'Permissões, auditoria e uso da IA', palavras:'ia master administracao administração auditoria permissao permissão uso usuario', masterOnly:true },
  { href:'/configuracoes/ia-setores', label:'IA por setor', grupo:'Administração', descricao:'Configurar IA para cada setor', palavras:'ia setor setores configuracao configuração especialista agente', masterOnly:true },

  { href:'/configuracoes/automacoes-fluxo', label:'Automações de fluxo', grupo:'Configurações', descricao:'Regras automáticas, avisos e responsáveis', palavras:'automacao automação fluxo aviso tarefa notificar responsavel configuração', masterOnly:true },
  { href:'/configuracoes/notificacoes', label:'Notificações', grupo:'Configurações', descricao:'Configurar notificações do Atlas', palavras:'notificacao notificação aviso alerta push configuração', masterOnly:true },
  { href:'/configuracoes/permissoes-cadastros', label:'Permissões dos Cadastros 360', grupo:'Configurações', descricao:'Permissões profundas de cadastros', palavras:'permissao permissão cadastro 360 acesso editar excluir aprovar usuario', masterOnly:true },
  { href:'/configuracoes/empresa', label:'Empresa e identidade', grupo:'Configurações', descricao:'Logo, nome e identidade da empresa', palavras:'empresa logo marca identidade esquadrifacio configuração', masterOnly:true },
  { href:'/configuracoes/usuarios', label:'Usuários e acesso', grupo:'Configurações', descricao:'Usuários, senhas e permissões', palavras:'usuario usuários senha acesso permissao equipe colaborador funcionario', masterOnly:true },
  { href:'/configuracoes/orcamento', label:'Configuração de orçamento', grupo:'Configurações', descricao:'Regras e padrões comerciais do orçamento', palavras:'orcamento orçamento margem cidade regiao região proposta validade pagamento configuração', masterOnly:true },

  { href:'/cadastro/produtos', label:'Produtos', grupo:'Cadastros', descricao:'Cadastro e custos de produtos', palavras:'produto produtos perfil acessorio material cadastro custo estoque' },
  { href:'/cadastro/linhas', label:'Linhas de esquadrias', grupo:'Cadastros', descricao:'Cadastro de linhas de alumínio', palavras:'linha linhas suprema plus 42 aluminio alumínio perfil cadastro' },
  { href:'/cadastro/materiais', label:'Materiais', grupo:'Cadastros', descricao:'Cadastro de materiais', palavras:'material materiais perfil acessorio vidro cadastro' },
  { href:'/cadastro/fornecedores', label:'Fornecedores', grupo:'Cadastros', descricao:'Cadastro de fornecedores', palavras:'fornecedor fornecedores compra compras cadastro' },
  { href:'/cadastro/catalogo-tecnico', label:'Catálogo técnico', grupo:'Cadastros', descricao:'Catálogo técnico de componentes', palavras:'catalogo catálogo tecnico técnica perfil acessorio vidro componente cadastro' },
  { href:'/cadastro/produtos/precificacao', label:'Precificação de produtos', grupo:'Cadastros', descricao:'Custos e precificação de produtos', palavras:'produto precificacao precificação custo preço margem cadastro' },

  { href:'/engenharia/formulas-corte', label:'Fórmulas de corte', grupo:'Engenharia', descricao:'Fórmulas técnicas para perfis e cortes', palavras:'engenharia formula fórmulas corte perfil receita tipologia cálculo' },
  { href:'/engenharia/editor-tecnico', label:'Editor técnico', grupo:'Engenharia', descricao:'Editar regras e receitas técnicas', palavras:'engenharia editor tecnico receita tipologia perfil corte regra' },
  { href:'/engenharia/editor-acessorios', label:'Editor de acessórios', grupo:'Engenharia', descricao:'Editar regras de acessórios', palavras:'engenharia editor acessorio acessórios regra receita componente' },
  { href:'/engenharia/receitas', label:'Receitas técnicas', grupo:'Engenharia', descricao:'Receitas e composições por tipologia', palavras:'engenharia receita receitas tipologia composição composicao perfil acessorio vidro' },
  { href:'/engenharia/historico-tipologias', label:'Histórico de tipologias', grupo:'Engenharia', descricao:'Histórico e alterações técnicas', palavras:'engenharia historico tipologia alteração versão receita' },

  { href:'/producao/plano-corte', label:'Plano de corte', grupo:'Produção', descricao:'Otimização e plano de corte', palavras:'produção producao plano corte barra perfil otimização otimizacao sobra' },
  { href:'/producao/medicao-final', label:'Medição final', grupo:'Produção', descricao:'Medições finais antes da produção', palavras:'produção medição final medida obra trena conferência' },
  { href:'/estoque', label:'Estoque', grupo:'Operações', descricao:'Consulta e gestão de estoque', palavras:'estoque material produto saldo almoxarifado' },
  { href:'/estoque/enderecar', label:'Endereçamento de estoque', grupo:'Operações', descricao:'Endereçar materiais no estoque', palavras:'estoque endereço enderecar posição material' },
  { href:'/estoque/transferencias', label:'Transferências de estoque', grupo:'Operações', descricao:'Transferir materiais entre locais', palavras:'estoque transferencia transferência material local' },
  { href:'/financeiro/contas-pagar', label:'Contas a pagar', grupo:'Financeiro', descricao:'Contas e compromissos a pagar', palavras:'financeiro conta pagar boleto fornecedor despesa vencimento' },

  { href:'/balcao/consulta-preco', label:'Consulta de preço balcão', grupo:'Balcão', descricao:'Consultar preço de produtos no balcão', palavras:'balcao balcão preço produto consulta venda' },
  { href:'/balcao/orcamentos', label:'Orçamentos de balcão', grupo:'Balcão', descricao:'Orçamentos rápidos de balcão', palavras:'balcao balcão orçamento orcamento venda produto' },
  { href:'/balcao/contas-receber', label:'Contas a receber balcão', grupo:'Balcão', descricao:'Recebimentos e contas do balcão', palavras:'balcao balcão financeiro receber conta pagamento' },
  { href:'/balcao/relatorios', label:'Relatórios do balcão', grupo:'Balcão', descricao:'Relatórios de vendas de balcão', palavras:'balcao balcão relatório relatorio venda faturamento' },

  { href:'/administracao/melhorias-atlas', label:'Melhorias Atlas', grupo:'Administração', descricao:'Bugs, sugestões e melhorias do sistema', palavras:'melhoria melhorias bug erro defeito sugestao sugestão desenvolvimento atlas', masterOnly:true },
  { href:'/administracao', label:'Central de Administração', grupo:'Administração', descricao:'Mapa das configurações do Atlas', palavras:'administracao administração configuração configuracoes onde fica mapa sistema atlas', masterOnly:true },
]