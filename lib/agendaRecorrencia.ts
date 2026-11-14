/** Cálculo civil no calendário de São Paulo, sem desviar o dia por UTC. */
export type FrequenciaAtlas = 'diaria' | 'semanal' | 'mensal' | 'dia_util_mes' | 'anual'
export type TipoRegistroAtlas = 'tarefa' | 'agenda'

export interface RegraAtlas {
  empresa_id: string
  base_data: string
  hora_inicio: string
  frequencia: FrequenciaAtlas
  dias_semana?: number[]
  dia_mes?: number | null
  n_dia_util?: number | null
  ate_data?: string | null
}

export function dataMaisDias(data: string, dias: number): string {
  const d = new Date(data + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function diaSemana(data: string): number {
  return new Date(data + 'T12:00:00Z').getUTCDay()
}

export function feriadosNacionaisFixos(ano: number): Set<string> {
  return new Set(['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25']
    .map(md => String(ano) + '-' + md))
}

export function ehDiaUtil(data: string, feriados: Set<string>): boolean {
  const d = diaSemana(data)
  return d !== 0 && d !== 6 && !feriados.has(data)
}

export function nEsimoDiaUtil(dataMes: string, ordinal: number, feriados: Set<string>): string {
  const anoMes = dataMes.slice(0, 7)
  let contador = 0
  let ultimo = ''
  for (let d = 1; d <= 31; d++) {
    const candidata = anoMes + '-' + String(d).padStart(2, '0')
    if (!ehDiaValido(candidata)) break
    if (ehDiaUtil(candidata, feriados)) {
      contador++
      ultimo = candidata
      if (contador === ordinal) return candidata
    }
  }
  return ultimo
}

export function ehDiaValido(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false
  const d = new Date(data + 'T12:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data
}

/** Encontra a primeira ocorrência no dia indicado ou depois dele, com prazo limitado. */
export function proximaDataRecorrencia(
  regra: RegraAtlas,
  aPartir: string,
  feriados: Set<string>,
): string | null {
  const inicio = aPartir > regra.base_data ? aPartir : regra.base_data
  const [baseAno, baseMes, baseDia] = regra.base_data.split('-').map(Number)
  for (let i = 0; i <= 732; i++) {
    const candidata = dataMaisDias(inicio, i)
    if (regra.ate_data && candidata > regra.ate_data) return null
    const [ano, mes, dia] = candidata.split('-').map(Number)
    let corresponde = false
    if (regra.frequencia === 'diaria') corresponde = true
    if (regra.frequencia === 'semanal') {
      const dias = regra.dias_semana?.length ? regra.dias_semana : [diaSemana(regra.base_data)]
      corresponde = dias.includes(diaSemana(candidata))
    }
    if (regra.frequencia === 'mensal') {
      const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
      corresponde = dia === Math.min(regra.dia_mes || baseDia, ultimo)
    }
    if (regra.frequencia === 'dia_util_mes') {
      corresponde = candidata === nEsimoDiaUtil(candidata, regra.n_dia_util || 5, feriados)
    }
    if (regra.frequencia === 'anual') {
      const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
      corresponde = mes === baseMes && dia === Math.min(baseDia, ultimo) && ano >= baseAno
    }
    if (corresponde) return candidata
  }
  return null
}

/** Intl calcula o deslocamento da região, inclusive se uma mudança futura de horário ocorrer. */
export function horarioSaoPauloIso(data: string, hora: string): string {
  const alvo = Date.parse(data + 'T' + hora.slice(0, 5) + ':00Z')
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(alvo))
  const obj: Record<string, number> = {}
  for (const p of partes) if (['year','month','day','hour','minute'].includes(p.type)) obj[p.type] = Number(p.value)
  const mostradoEmUTC = Date.UTC(obj.year, obj.month - 1, obj.day, obj.hour, obj.minute)
  return new Date(alvo + (alvo - mostradoEmUTC)).toISOString()
}
