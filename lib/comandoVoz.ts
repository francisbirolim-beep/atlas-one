export interface ComandoInterpretado {
  titulo: string
  data: Date | null
}

function paraNove(d: Date) {
  const novo = new Date(d)
  novo.setHours(9, 0, 0, 0)
  return novo
}

function proximoDiaSemana(indiceAlvo: number) {
  const d = new Date()
  const atual = d.getDay()
  let diff = (indiceAlvo - atual + 7) % 7
  if (diff === 0) diff = 7
  d.setDate(d.getDate() + diff)
  return paraNove(d)
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const GATILHOS = [
  /^criar\s+uma\s+tarefa\s+/i,
  /^criar\s+tarefa\s+/i,
  /^nova\s+tarefa\s+/i,
  /^adicionar\s+uma\s+tarefa\s+/i,
  /^adicionar\s+tarefa\s+/i,
  /^criar\s+um\s+evento\s+/i,
  /^criar\s+evento\s+/i,
  /^novo\s+evento\s+/i,
  /^agendar\s+um\s+evento\s+/i,
  /^agendar\s+evento\s+/i,
  /^marcar\s+um\s+evento\s+/i,
  /^marcar\s+evento\s+/i,
  /^criar\s+uma\s+reuni[aã]o\s+/i,
  /^agendar\s+uma\s+reuni[aã]o\s+/i,
]

export function interpretarComandoDeVoz(textoOriginal: string): ComandoInterpretado {
  let texto = textoOriginal.trim()

  for (const re of GATILHOS) {
    if (re.test(texto)) {
      texto = texto.replace(re, '')
      break
    }
  }
  texto = texto.replace(/^(para|de)\s+/i, '')

  let data: Date | null = null

  function extrairData(re: RegExp, calc: () => Date) {
    if (re.test(texto)) {
      data = calc()
      texto = texto.replace(re, ' ')
      texto = texto.replace(/\s+/g, ' ').trim()
      return true
    }
    return false
  }

  let achou = extrairData(/\bhoje\b/i, () => paraNove(new Date()))
  if (!achou) {
    achou = extrairData(/depois\s+de\s+amanh[ãa]/i, () => {
      const d = new Date()
      d.setDate(d.getDate() + 2)
      return paraNove(d)
    })
  }
  if (!achou) {
    achou = extrairData(/\bamanh[ãa]\b/i, () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return paraNove(d)
    })
  }
  if (!achou) {
    for (let i = 0; i < DIAS_SEMANA.length; i++) {
      const re = new RegExp('\\b(pr[óo]xim[ao]\\s+)?' + DIAS_SEMANA[i] + '(-feira)?\\b', 'i')
      const idx = i
      if (extrairData(re, () => proximoDiaSemana(idx))) break
    }
  }

  texto = texto.replace(/\s+/g, ' ').trim()
  const titulo = texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : textoOriginal.trim()

  return { titulo, data }
}
