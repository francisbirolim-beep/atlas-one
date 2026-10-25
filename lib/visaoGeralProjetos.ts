/**
 * Projeção somente leitura da Visão Geral de Projetos.
 * A fonte da verdade permanece nos fluxos de venda, medição, compras,
 * ordens de produção, instalação e encerramento da obra.
 * Nenhuma função deste módulo movimenta cards operacionais.
 */
export const ETAPAS_OPERACIONAIS = [
  'vendido', 'conferir_projeto', 'separacao_materiais', 'medicao_final', 'compras_liberacao',
  'compras', 'aguardando_materiais', 'aguardando_producao',
  'producao', 'aguardando_instalacao', 'instalacao', 'finalizado',
] as const

export type EtapaOperacional = typeof ETAPAS_OPERACIONAIS[number]
export type AlertaProjeto = 'verde' | 'amarelo' | 'vermelho' | 'azul' | 'sem_prazo'

export type ColunaVisualProjeto = {
  id: string
  nome: string
  ordem: number
  // Critérios de apresentação, não estados gravados nas tabelas operacionais.
  criterios: EtapaOperacional[]
  prazoDias: number | null
}

export const COLUNAS_GERAIS_PADRAO: ColunaVisualProjeto[] = [
  { id:'vendido',nome:'Vendido',ordem:0,criterios:['vendido','conferir_projeto'],prazoDias:null },
  { id:'separacao',nome:'Separação de Materiais',ordem:1,criterios:['separacao_materiais','compras_liberacao'],prazoDias:null },
  { id:'compras',nome:'Compras',ordem:2,criterios:['compras'],prazoDias:null },
  { id:'aguardando',nome:'Aguardando Material',ordem:3,criterios:['aguardando_materiais'],prazoDias:null },
  { id:'medicao',nome:'Medição Final',ordem:4,criterios:['medicao_final'],prazoDias:null },
  { id:'producao',nome:'Produção',ordem:5,criterios:['aguardando_producao','producao'],prazoDias:null },
  { id:'instalacao',nome:'Instalação',ordem:6,criterios:['aguardando_instalacao','instalacao'],prazoDias:null },
  { id:'finalizado',nome:'Finalizado',ordem:7,criterios:['finalizado'],prazoDias:null },
]

export type EvidenciasProjeto = {
  vendaConfirmada: boolean
  projetoConferido: boolean
  conferenciaIniciada?: boolean
  separacaoIniciada?: boolean
  medicaoFinal: 'pendente' | 'em_andamento' | 'aprovada'
  materiais: 'aguardando_liberacao' | 'em_cotacao' | 'pedido_emitido' |
    'aguardando_recebimento' | 'recebimento_parcial' | 'liberados'
  producao: 'nao_iniciada' | 'bloqueada' | 'em_andamento' | 'concluida'
  instalacao: 'nao_iniciada' | 'aguardando_agendamento' | 'agendada' |
    'em_andamento' | 'concluida'
  // Confirmado pelo fluxo oficial de encerramento, nunca inferido por arraste.
  encerramentoConfirmado: boolean
}

export function etapaOperacionalAtual(s: EvidenciasProjeto): EtapaOperacional | null {
  if (!s.vendaConfirmada) return null
  if (s.encerramentoConfirmado && s.producao === 'concluida' && s.instalacao === 'concluida') return 'finalizado'
  if (s.instalacao === 'em_andamento' || s.instalacao === 'concluida') return 'instalacao'
  if (s.instalacao === 'agendada' || s.instalacao === 'aguardando_agendamento') return 'aguardando_instalacao'
  if (s.producao === 'em_andamento') return 'producao'
  if (s.producao === 'concluida') return 'aguardando_instalacao'
  // Medições efetivamente iniciadas têm precedência sobre compras paralelas.
  if (s.medicaoFinal === 'em_andamento') return 'medicao_final'
  if (s.materiais === 'aguardando_recebimento' || s.materiais === 'recebimento_parcial') return 'aguardando_materiais'
  if (s.materiais === 'em_cotacao' || s.materiais === 'pedido_emitido') return 'compras'
  if (s.medicaoFinal === 'aprovada' && s.materiais === 'liberados') return 'aguardando_producao'
  if (s.medicaoFinal === 'aprovada') return 'compras_liberacao'
  if (s.separacaoIniciada || s.projetoConferido) return 'separacao_materiais'
  return s.conferenciaIniciada ? 'conferir_projeto' : 'vendido'
}

/** Toda etapa operacional deve pertencer a EXATAMENTE uma coluna visual. */
export function validarColunasGerais(colunas: ColunaVisualProjeto[]): string[] {
  const erros: string[] = []
  if (!colunas.length) return ['O Kanban precisa de pelo menos uma coluna.']
  const ids = new Set<string>()
  const ordens = new Set<number>()
  const contagem = new Map<string, number>()
  for (const c of colunas) {
    if (!c.id.trim() || ids.has(c.id)) erros.push('ID de coluna vazio ou duplicado: ' + c.id)
    ids.add(c.id)
    if (!c.nome.trim() || c.nome.trim().length > 70) erros.push('Nome de coluna inválido: ' + c.id)
    if (!Number.isInteger(c.ordem) || c.ordem < 0 || ordens.has(c.ordem)) erros.push('Ordem inválida ou duplicada: ' + c.id)
    ordens.add(c.ordem)
    if (c.prazoDias !== null && (!Number.isInteger(c.prazoDias) || c.prazoDias < 0 || c.prazoDias > 3650)) {
      erros.push('Prazo em dias inválido: ' + c.id)
    }
    for (const criterio of c.criterios) {
      if (!(ETAPAS_OPERACIONAIS as readonly string[]).includes(criterio)) erros.push('Critério desconhecido: ' + criterio)
      contagem.set(criterio, (contagem.get(criterio) || 0) + 1)
    }
  }
  for (const criterio of ETAPAS_OPERACIONAIS) {
    if (contagem.get(criterio) !== 1) erros.push('O critério ' + criterio + ' precisa pertencer a uma única coluna.')
  }
  return erros
}

function garantirConfig(colunas: ColunaVisualProjeto[]) {
  const erros = validarColunasGerais(colunas)
  if (erros.length) throw new Error(erros.join(' '))
}

export function colunaDaEtapa(colunas: ColunaVisualProjeto[], etapa: EtapaOperacional): ColunaVisualProjeto {
  garantirConfig(colunas)
  const coluna = colunas.find(c => c.criterios.includes(etapa))
  if (!coluna) throw new Error('Etapa sem coluna: ' + etapa)
  return coluna
}

export function renomearColunaGeral(colunas: ColunaVisualProjeto[], id: string, nome: string): ColunaVisualProjeto[] {
  if (!colunas.some(c => c.id === id)) throw new Error('Coluna não encontrada.')
  const novas = colunas.map(c => c.id === id ? { ...c, nome: nome.trim() } : { ...c })
  garantirConfig(novas)
  return novas
}

export function criarColunaGeral(colunas: ColunaVisualProjeto[], id: string, nome: string): ColunaVisualProjeto[] {
  const novas = [...colunas.map(c => ({ ...c, criterios: [...c.criterios] })),
    { id, nome: nome.trim(), ordem: colunas.length, criterios: [], prazoDias: null }]
  garantirConfig(novas)
  return novas
}

export function associarCriterioColuna(
  colunas: ColunaVisualProjeto[], criterio: EtapaOperacional, destinoId: string
): ColunaVisualProjeto[] {
  if (!colunas.some(c => c.id === destinoId)) throw new Error('Coluna de destino não encontrada.')
  const novas = colunas.map(c => ({
    ...c,
    criterios: c.id === destinoId
      ? [...new Set([...c.criterios, criterio])]
      : c.criterios.filter(x => x !== criterio),
  }))
  garantirConfig(novas)
  return novas
}

/** Excluir uma coluna redistribui os critérios antes da remoção. Nenhum card é apagado. */
export function excluirColunaGeral(
  colunas: ColunaVisualProjeto[], excluirId: string, destinoId: string
): ColunaVisualProjeto[] {
  if (excluirId === destinoId) throw new Error('Escolha outra coluna de destino.')
  if (colunas.length < 2) throw new Error('Não é possível excluir a última coluna.')
  const excluir = colunas.find(c => c.id === excluirId)
  if (!excluir || !colunas.some(c => c.id === destinoId)) throw new Error('Origem ou destino inválido.')
  const novas = colunas.filter(c => c.id !== excluirId).map((c, ordem) => ({
    ...c, ordem,
    criterios: c.id === destinoId ? [...new Set([...c.criterios, ...excluir.criterios])] : [...c.criterios],
  }))
  garantirConfig(novas)
  return novas
}

export function reordenarColunasGerais(colunas: ColunaVisualProjeto[], ids: string[]): ColunaVisualProjeto[] {
  if (ids.length !== colunas.length || new Set(ids).size !== colunas.length) throw new Error('Reordenação incompleta.')
  const porId = new Map(colunas.map(c => [c.id, c]))
  const novas = ids.map((id, ordem) => {
    const c = porId.get(id)
    if (!c) throw new Error('Coluna desconhecida na ordenação.')
    return { ...c, ordem, criterios: [...c.criterios] }
  })
  garantirConfig(novas)
  return novas
}

function diasEntre(datas: string, dataBase: string): number | null {
  const data = datas.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  const inicio = Date.parse(data + 'T00:00:00Z')
  const fim = Date.parse(dataBase + 'T00:00:00Z')
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return null
  return Math.round((inicio - fim) / 86_400_000)
}

export function avaliarAlertaProjeto(opcoes: {
  etapa: EtapaOperacional
  hoje: string
  vencimentoEtapa?: string | null
  previsaoEntrega?: string | null
  pendencias?: string[]
  antecedenciaDias?: number
  entrouNaEtapaEm?: string | null
}): { cor: AlertaProjeto; diasAtraso: number; diasNaEtapa: number | null } {
  const hoje = opcoes.hoje.slice(0, 10)
  const vencimentos = [opcoes.vencimentoEtapa, opcoes.previsaoEntrega]
    .filter((d): d is string => Boolean(d))
    .map(d => diasEntre(d, hoje))
    .filter((n): n is number => n !== null)
  const diasAtraso = vencimentos.length ? Math.max(0, ...vencimentos.map(d => -d)) : 0
  const diasNaEtapa = opcoes.entrouNaEtapaEm
    ? diasEntre(opcoes.entrouNaEtapaEm, hoje)
    : null
  const permanencia = diasNaEtapa === null ? null : Math.max(0, -diasNaEtapa)
  if (opcoes.etapa === 'finalizado') return { cor: 'azul', diasAtraso: 0, diasNaEtapa: permanencia }
  if (diasAtraso > 0) return { cor: 'vermelho', diasAtraso, diasNaEtapa: permanencia }
  const antecedencia = Number.isInteger(opcoes.antecedenciaDias)
    ? Math.max(0, opcoes.antecedenciaDias as number) : 3
  if ((opcoes.pendencias?.length || 0) > 0 || vencimentos.some(d => d <= antecedencia)) {
    return { cor: 'amarelo', diasAtraso: 0, diasNaEtapa: permanencia }
  }
  if (!vencimentos.length) return { cor: 'sem_prazo', diasAtraso: 0, diasNaEtapa: permanencia }
  return { cor: 'verde', diasAtraso: 0, diasNaEtapa: permanencia }
}

/** Prazo configurado em dias corridos a partir da entrada REAL na etapa visual. */
export function vencimentoPelaEtapa(entrouEm: string | null | undefined, prazoDias: number | null): string | null {
  if (!entrouEm || prazoDias === null || !Number.isInteger(prazoDias) || prazoDias < 0) return null
  const data = entrouEm.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  const instante = Date.parse(data + 'T00:00:00Z')
  if (!Number.isFinite(instante)) return null
  return new Date(instante + prazoDias * 86_400_000).toISOString().slice(0, 10)
}

export type EntradaCardGeral = {
  vendaId: string
  cliente: string
  projeto: string
  sinais: EvidenciasProjeto
  previsaoEntrega?: string | null
  vencimentoEtapa?: string | null
  entrouNaEtapaEm?: string | null
  pendencias?: string[]
}

/** Projeta um único card por venda/obra; nunca cria nem altera ordens ou status. */
export function projetarCardGeral(
  entrada: EntradaCardGeral, colunas: ColunaVisualProjeto[], hoje: string
) {
  const etapa = etapaOperacionalAtual(entrada.sinais)
  if (!etapa) return null
  const coluna = colunaDaEtapa(colunas, etapa)
  const vencimentoEtapa = entrada.vencimentoEtapa ||
    vencimentoPelaEtapa(entrada.entrouNaEtapaEm, coluna.prazoDias)
  const alerta = avaliarAlertaProjeto({
    etapa, hoje, vencimentoEtapa,
    previsaoEntrega: entrada.previsaoEntrega,
    entrouNaEtapaEm: entrada.entrouNaEtapaEm,
    pendencias: entrada.pendencias,
  })
  return {
    vendaId: entrada.vendaId,
    cliente: entrada.cliente,
    projeto: entrada.projeto,
    etapaOperacional: etapa,
    colunaId: coluna.id,
    vencimentoEtapa,
    previsaoEntrega: entrada.previsaoEntrega || null,
    pendencias: entrada.pendencias || [],
    ...alerta,
  }
}
