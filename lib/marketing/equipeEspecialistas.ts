/**
 * Catalogo proposto da Agencia IA da Esquadrifacio.
 *
 * Escopo: declarativo e isolado. Nao registra agentes em execucao,
 * nao publica em redes sociais e nao altera a IA Atlas existente.
 * Ativacao depende de fluxo de aprovacao, permissoes e integracoes testadas.
 */
export type MarketingEspecialistaId =
  | 'diretor'
  | 'conteudo'
  | 'imagem'
  | 'video'
  | 'social'
  | 'seo_local'
  | 'site'
  | 'performance'
  | 'integracao_atlas'

export type MarketingEspecialista = {
  id: MarketingEspecialistaId
  nome: string
  missao: string
  entregas: readonly string[]
  revisaoHumana: readonly string[]
}

export const MARKETING_ESPECIALISTAS: readonly MarketingEspecialista[] = [
  {
    id: 'diretor',
    nome: 'Diretor de Marketing IA',
    missao: 'Planejar o mes, coordenar os especialistas e submeter uma campanha unica para aprovacao.',
    entregas: ['plano mensal', 'briefing por obra', 'calendario editorial', 'fila de aprovacao'],
    revisaoHumana: ['aprovacao final do mes', 'alteracoes de posicionamento e identidade'],
  },
  {
    id: 'conteudo',
    nome: 'Estrategista de Conteudo e Redacao',
    missao: 'Transformar obras e produtos reais em textos, roteiros e chamadas comerciais corretas.',
    entregas: ['legendas por canal', 'roteiros', 'textos de produto', 'chamadas para orcamento'],
    revisaoHumana: ['afirmacoes sobre desempenho, preco, prazos e garantia'],
  },
  {
    id: 'imagem',
    nome: 'Designer e Fotografia IA',
    missao: 'Organizar midias e sugerir tratamento que preserve os produtos e os originais.',
    entregas: ['selecao de fotos', 'tratamento nao destrutivo', 'comparacao antes/depois', 'artes'],
    revisaoHumana: ['uso de imagem de cliente/obra', 'imagem final para publicacao'],
  },
  {
    id: 'video',
    nome: 'Videomaker IA',
    missao: 'Propor e preparar clipes, Reels, Stories e videos curtos a partir de midias autorizadas.',
    entregas: ['roteiro visual', 'cortes', 'legendas de video', 'variantes por formato'],
    revisaoHumana: ['video final', 'trilha e direitos de uso'],
  },
  {
    id: 'social',
    nome: 'Gestor de Redes Sociais',
    missao: 'Adequar, agendar, publicar e acompanhar conteudos em canais oficialmente conectados.',
    entregas: ['agenda multicanal', 'fila idempotente', 'registro de postagem', 'alerta de falha'],
    revisaoHumana: ['primeira conexao de conta', 'campanha de publicacoes aprovada'],
  },
  {
    id: 'seo_local',
    nome: 'Especialista em SEO Local e Google',
    missao: 'Melhorar a presenca organica nas cidades realmente atendidas pela Esquadrifacio.',
    entregas: ['paginas locais legitimas', 'titulos e metadados', 'Perfil da Empresa no Google', 'auditoria SEO'],
    revisaoHumana: ['alteracao de dados oficiais da empresa', 'publicacoes no Perfil da Empresa'],
  },
  {
    id: 'site',
    nome: 'Webmaster e Conversao',
    missao: 'Administrar conteudo do site publico sem modificar a identidade visual aprovada.',
    entregas: ['galeria de obras', 'paginas de produtos', 'CTA WhatsApp', 'otimizacao mobile'],
    revisaoHumana: ['alteracao estrutural do site', 'publicacao de conteudo sensivel'],
  },
  {
    id: 'performance',
    nome: 'Analista de Performance e Trafego',
    missao: 'Relacionar alcance, visitas, leads, orcamentos e vendas, propondo anuncios quando fizer sentido.',
    entregas: ['painel de resultados', 'atribuicao por UTM/campanha', 'relatorio mensal', 'sugestoes de anuncios'],
    revisaoHumana: ['gasto com anuncio', 'mudanca de orcamento ou publico de campanha paga'],
  },
  {
    id: 'integracao_atlas',
    nome: 'Engenheiro de Integracoes Atlas',
    missao: 'Conectar site, midias, campanha, CRM, clientes, obras e orcamentos sem alterar fluxos existentes.',
    entregas: ['contratos de integracao', 'permissoes', 'auditoria', 'rotinas seguras de sincronizacao'],
    revisaoHumana: ['migracoes de banco', 'conexao de servicos externos', 'publicacao de software'],
  },
] as const

export const MARKETING_ETAPAS = [
  'midia_recebida',
  'direitos_verificados',
  'conteudo_preparado',
  'revisao',
  'aprovado',
  'agendado',
  'publicado',
  'mensurado',
] as const

export const MARKETING_REGRAS_DE_SEGURANCA = {
  manterOriginal: true,
  identidadeVisualProtegida: true,
  publicarSomenteConteudoAprovado: true,
  gastosPagosSempreExigemAprovacao: true,
  imagensDeObraExigemAutorizacao: true,
  alteracoesNoAtlasSomenteAditivas: true,
  registroDeAuditoriaObrigatorio: true,
  integracoesInativasPorPadrao: true,
} as const
