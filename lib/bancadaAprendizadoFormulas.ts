/**
 * Aprendizado supervisionado de cortes da mesma configuracao tecnica.
 * Os exemplos nunca modificam receitas ativas. A proposta precisa ser
 * conferida no W.Vetro e aprovada pelo Master na bancada.
 */
export type CorteReferencia = { codigo: string; eixo?: 'L' | 'H'; comprimento_mm: number; quantidade: number }
export type CasoReferencia = {
  largura_mm: number; altura_mm: number; opcoes: Record<string, string>
  cortes: CorteReferencia[]
}
export type ReferenciaAprendizado = { caso: CasoReferencia | null; status?: string }
export type PropostaFormula = {
  codigo: string; eixo: 'L' | 'H'; formula: string | null
  formula_quantidade: string | null
  amostras: number; estado: 'hipotese' | 'consistente' | 'pendente'
  motivo: string
}

function configuracao(opcoes: Record<string, string> | undefined): string {
  return JSON.stringify(Object.entries(opcoes || {}).sort(([a],[b])=>a.localeCompare(b)))
}
function identificar(corte: CorteReferencia) {
  return String(corte.codigo || '').trim().toUpperCase() + '|' + (corte.eixo || '')
}
function formatar(n: number) { return String(Number(n.toFixed(3))) }
function textoFormula(base: 'Largura' | 'Altura', fator: number, deslocamento: number): string {
  const raiz = fator === 1 ? base : fator === 0.5 ? base + ' / 2' : base + ' * 2'
  const offset = Number(deslocamento.toFixed(3))
  return offset === 0 ? raiz : raiz + (offset < 0 ? ' - ' : ' + ') + formatar(Math.abs(offset))
}

/**
 * Inferencia conservadora: observa variacoes independentes de largura/altura.
 * Nao ajusta uma reta arbitraria a dois pontos, nem presume regras para
 * quantidades variaveis (persianas, roldanas etc).
 */
export function inferirFormulasPorCasos(
  referencias: ReferenciaAprendizado[], opcoes: Record<string, string>,
): PropostaFormula[] {
  const assinatura = configuracao(opcoes)
  const amostras = referencias
    .filter(r => r.caso && configuracao(r.caso.opcoes) === assinatura)
    .map(r => r.caso!)
    .filter(c => Number.isFinite(c.largura_mm) && Number.isFinite(c.altura_mm) &&
      c.largura_mm > 0 && c.altura_mm > 0 && Array.isArray(c.cortes))
  if (!amostras.length) return []
  const chaves = new Set(amostras.flatMap(a => a.cortes.map(identificar)))
  const medidasDistintas = new Set(amostras.map(a => a.largura_mm + 'x' + a.altura_mm)).size
  const respostas: PropostaFormula[] = []
  for (const chave of chaves) {
    const [codigo, eixo] = chave.split('|')
    if (eixo !== 'L' && eixo !== 'H') continue
    const dados = amostras.map(c => {
      const cortes = c.cortes.filter(p => identificar(p) === chave)
      return cortes.length === 1 ? { c, item: cortes[0] } : null
    })
    const validos = dados.filter((d): d is NonNullable<typeof d> => d !== null)
    const base = { codigo, eixo: eixo as 'L' | 'H', formula: null as string | null,
      formula_quantidade: null as string | null, amostras: validos.length,
      estado: 'pendente' as const, motivo: '' }
    if (validos.length !== amostras.length) {
      respostas.push({ ...base, motivo: 'Codigo ausente ou com varios cortes no mesmo eixo; conferir manualmente.' })
      continue
    }
    if (medidasDistintas < 2) {
      respostas.push({ ...base, motivo: 'Falta outra largura ou altura para identificar a regra.' })
      continue
    }
    const quantidadeConstante = validos.every(d => d.item.quantidade === validos[0].item.quantidade)
    const quantidade = quantidadeConstante ? formatar(validos[0].item.quantidade) : null
    const candidatos: string[] = []
    for (const dimensao of ['Largura', 'Altura'] as const) {
      const valores = validos.map(d => dimensao === 'Largura' ? d.c.largura_mm : d.c.altura_mm)
      if (new Set(valores).size < 2) continue
      const cortes = validos.map(d => d.item.comprimento_mm)
      for (const fator of [1, 0.5, 2]) {
        const deslocamento = cortes[0] - valores[0] * fator
        if (cortes.every((n,i) => Math.abs(n - (valores[i] * fator + deslocamento)) <= 0.1))
          candidatos.push(textoFormula(dimensao, fator, deslocamento))
      }
    }
    // Constancia so e uma candidata defensavel se AMBAS as dimensoes variaram.
    if (new Set(validos.map(d => d.c.largura_mm)).size > 1 &&
        new Set(validos.map(d => d.c.altura_mm)).size > 1 &&
        validos.every(d => Math.abs(d.item.comprimento_mm - validos[0].item.comprimento_mm) <= 0.1)) {
      candidatos.push(formatar(validos[0].item.comprimento_mm))
    }
    const unicos = [...new Set(candidatos)]
    if (unicos.length !== 1) {
      respostas.push({ ...base, formula_quantidade: quantidade,
        motivo: !unicos.length ? 'As medidas ainda nao sustentam uma regra simples.'
          : 'As medidas permitem mais de uma regra; envie uma terceira medida independente.' })
      continue
    }
    respostas.push({ ...base, formula: unicos[0], formula_quantidade: quantidade,
      estado: medidasDistintas >= 3 ? 'consistente' : 'hipotese',
      motivo: (medidasDistintas >= 3 ? 'Confere com tres ou mais medidas distintas.' :
        'Proposta baseada em duas medidas; precisa de terceira confirmacao.') +
        (quantidadeConstante ? '' : ' Quantidade variou: regra de quantidade pendente.') +
        ' Requer verificacao humana no W.Vetro antes da validacao.' })
  }
  return respostas.sort((a,b) => a.codigo.localeCompare(b.codigo) || a.eixo.localeCompare(b.eixo))
}
