// Helpers de recorrencia: semanal, n-esimo dia util do mes, dia fixo do mes

export type TipoRecorrencia = 'semanal' | 'dia_util_mes' | 'dia_fixo_mes'

export const LABEL_RECORRENCIA: Record<TipoRecorrencia, string> = {
  semanal: 'Toda semana',
  dia_util_mes: 'Todo mes (dia util)',
  dia_fixo_mes: 'Todo mes (dia fixo)',
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate()
}

function ehDiaUtil(data: Date): boolean {
  const dia = data.getDay()
  return dia !== 0 && dia !== 6
}

// N-esimo dia util (1-indexado) de um mes/ano
export function nEsimoDiaUtilDoMes(ano: number, mes: number, n: number): Date {
  let contador = 0
  let dia = 1
  const ultimo = ultimoDiaDoMes(ano, mes)
  while (dia <= ultimo) {
    const data = new Date(ano, mes, dia)
    if (ehDiaUtil(data)) {
      contador++
      if (contador === n) return data
    }
    dia++
  }
  // se passar do mes (n muito grande), retorna o ultimo dia util
  return new Date(ano, mes, ultimo)
}

export function diaFixoDoMes(ano: number, mes: number, dia: number): Date {
  const ultimo = ultimoDiaDoMes(ano, mes)
  return new Date(ano, mes, Math.min(dia, ultimo))
}

function copiarHorario(data: Date, base: Date): Date {
  const d = new Date(data)
  d.setHours(base.getHours(), base.getMinutes(), base.getSeconds(), 0)
  return d
}

// Gera as proximas ocorrencias APOS a data base, dentro da janela de mesesAFrente meses.
export function gerarProximasOcorrencias(
  dataBase: Date,
  tipo: TipoRecorrencia,
  valor: number,
  mesesAFrente = 6
): Date[] {
  const limite = new Date(dataBase)
  limite.setMonth(limite.getMonth() + mesesAFrente)

  const ocorrencias: Date[] = []

  if (tipo === 'semanal') {
    let atual = new Date(dataBase)
    atual.setDate(atual.getDate() + 7)
    while (atual <= limite) {
      ocorrencias.push(copiarHorario(atual, dataBase))
      atual = new Date(atual)
      atual.setDate(atual.getDate() + 7)
    }
  } else if (tipo === 'dia_util_mes') {
    let ano = dataBase.getFullYear()
    let mes = dataBase.getMonth() + 1
    while (true) {
      if (mes > 11) { mes = 0; ano++ } 
      const data = nEsimoDiaUtilDoMes(ano, mes, valor)
      if (data > limite) break
      ocorrencias.push(copiarHorario(data, dataBase))
      mes++
    }
  } else if (tipo === 'dia_fixo_mes') {
    let ano = dataBase.getFullYear()
    let mes = dataBase.getMonth() + 1
    while (true) {
      if (mes > 11) { mes = 0; ano++ }
      const data = diaFixoDoMes(ano, mes, valor)
      if (data > limite) break
      ocorrencias.push(copiarHorario(data, dataBase))
      mes++
    }
  }

  return ocorrencias
}
