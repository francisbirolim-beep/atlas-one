/**
 * Motor puro de lembretes do Atlas One.
 * Não envia mensagens nem altera tarefas: produz horários/identificadores estáveis
 * para que o worker registre no banco de forma idempotente.
 */
export type TipoCompromisso = 'tarefa' | 'agenda'
export type TipoAviso = 'antecipado' | 'pendente'

export const AVISOS_DISPONIVEIS = [
  { minutos: 10080, rotulo: '7 dias antes' },
  { minutos: 2880, rotulo: '2 dias antes' },
  { minutos: 1440, rotulo: '1 dia antes' },
  { minutos: 180, rotulo: '3 horas antes' },
  { minutos: 120, rotulo: '2 horas antes' },
  { minutos: 60, rotulo: '1 hora antes' },
  { minutos: 30, rotulo: '30 minutos antes' },
  { minutos: 15, rotulo: '15 minutos antes' },
  { minutos: 10, rotulo: '10 minutos antes' },
  { minutos: 5, rotulo: '5 minutos antes' },
] as const

export const PADRAO_AVISOS_TAREFA = [1440, 60, 10] as const
export const PADRAO_AVISOS_AGENDA = [1440, 60, 30] as const
export const PADRAO_COBRANCA_MINUTOS = 60

/** Retorna uma lista limpa, previsível e sem notificações em excesso. */
export function normalizarAntecedencias(valores: readonly number[] | null | undefined): number[] {
  return [...new Set((valores || [])
    .map(Number)
    .filter(numero => Number.isInteger(numero) && numero >= 1 && numero <= 43200))]
    .sort((a, b) => b - a)
    .slice(0, 10)
}

export function normalizarIntervaloCobranca(valor: number | null | undefined): number {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 15 && numero <= 1440
    ? numero : PADRAO_COBRANCA_MINUTOS
}

export type AvisoPlanejado = {
  chave: string
  tipo: TipoAviso
  quando: string
}

/**
 * O prazo deve estar persistido em UTC (ISO).
 * Cada aviso antecipado recebe chave única, independente de retries do worker.
 * Cobrança recorrente: apenas o intervalo atual é calculado, nunca um backlog
 * de mensagens antigas. Quando a tarefa é concluída, o chamador não executa.
 */
export function calcularAvisosDevidos(params: {
  entidade: TipoCompromisso
  entidadeId: string
  dataHora: string
  agora: string
  antecedentes: readonly number[]
  concluida?: boolean
  cobrancaAtiva?: boolean
  cobrancaMinutos?: number
}): AvisoPlanejado[] {
  const inicio = new Date(params.dataHora).getTime()
  const agora = new Date(params.agora).getTime()
  if (!Number.isFinite(inicio) || !Number.isFinite(agora) || params.concluida) return []

  const avisos: AvisoPlanejado[] = []
  for (const minutos of normalizarAntecedencias(params.antecedentes)) {
    const momento = inicio - minutos * 60000
    if (momento <= agora && inicio > agora) {
      avisos.push({
        chave: `${params.entidade}:${params.entidadeId}:antes:${minutos}`,
        tipo: 'antecipado',
        quando: new Date(momento).toISOString(),
      })
    }
  }

  if (params.entidade === 'tarefa' && params.cobrancaAtiva && agora >= inicio) {
    const intervaloMs = normalizarIntervaloCobranca(params.cobrancaMinutos) * 60000
    const numeroIntervalo = Math.floor((agora - inicio) / intervaloMs)
    if (numeroIntervalo >= 1) {
      avisos.push({
        chave: `tarefa:${params.entidadeId}:pendente:${numeroIntervalo}`,
        tipo: 'pendente',
        quando: new Date(inicio + numeroIntervalo * intervaloMs).toISOString(),
      })
    }
  }
  return avisos
}

export type AcaoResposta = 'concluir' | 'adiar' | 'reagendar' | 'nao_concluida' | 'desconhecida'

/** Classificação inicial: só atua quando a mensagem estiver vinculada a uma tarefa específica. */
export function identificarRespostaTarefa(texto: string, tarefaVinculada: boolean): AcaoResposta {
  if (!tarefaVinculada) return 'desconhecida'
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
  if (/^(sim|conclui|concluido|concluida|ja fiz|feito|finalizei)[.!\s]*$/.test(t)) return 'concluir'
  if (/\b(reagendar|remarcar)\b/.test(t)) return 'reagendar'
  if (/\b(adiar|lembra|lembrar|protelar)\b/.test(t)) return 'adiar'
  if (/^(nao|ainda nao|nao fiz|nao conclui|pendente)[.!\s]*$/.test(t)) return 'nao_concluida'
  return 'desconhecida'
}
