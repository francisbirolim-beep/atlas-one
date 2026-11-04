import { calcularFormulasCorte, type TipologiaFormulasCorte } from './formulasCorteEngine'
import { calcularAcessoriosTecnicos } from './formulasAcessoriosEngine'
import type { AcessorioFormulaCorte } from './engenhariaFormulasCorte'
import type { CasoTipologia } from './bancadaTipologias'

export type DiferencaAcessorio = {
  codigo: string
  esperado: number | null
  calculado: number | null
  conforme: boolean
}
export type ConferenciaAcessorios = {
  ok: boolean
  conferidos: number
  conformes: number
  diferencas: DiferencaAcessorio[]
  erro?: string
}

/** Compara TODOS os acessórios, inclusive códigos extras na referência. */
export function conferirAcessorios(
  definicao: TipologiaFormulasCorte,
  formulas: AcessorioFormulaCorte[],
  caso: CasoTipologia,
): ConferenciaAcessorios {
  if (!formulas.length) return { ok: true, conferidos: 0, conformes: 0, diferencas: [] }
  try {
    const referencia = caso.acessorios || []
    if (!referencia.length) throw Error('Inclua a lista de acessórios deste projeto para validá-lo.')
    const perfis = calcularFormulasCorte(
      { ...definicao, folgas: caso.folgas },
      caso.largura_mm,
      caso.altura_mm,
      caso.opcoes,
    )
    const calculados = calcularAcessoriosTecnicos(
      formulas, caso.largura_mm, caso.altura_mm, Number(caso.opcoes.numero_folhas || 1),
      perfis.map(p => ({ codigo: p.codigo, tamanho: p.tamanho, grupo: p.grupo })),
      caso.opcoes, caso.folgas,
    )
    const totalCalculado = new Map<string, number>()
    for (const linha of calculados) {
      const formula = formulas[linha.index]
      if (!linha.ativo) continue
      if (linha.erro || linha.valor == null || !Number.isFinite(linha.valor) || linha.valor < 0)
        throw Error('A fórmula de ' + formula.codigo + ' ainda não está válida.')
      const codigo = formula.codigo.trim().toUpperCase()
      totalCalculado.set(codigo, (totalCalculado.get(codigo) || 0) + linha.valor)
    }
    const totalEsperado = new Map<string, number>()
    for (const linha of referencia) {
      const codigo = String(linha.codigo).trim().toUpperCase()
      if (!/^[A-Z0-9_.-]{1,40}$/.test(codigo) ||
          !Number.isFinite(linha.quantidade) || linha.quantidade < 0 || linha.quantidade > 10000)
        throw Error('Código ou quantidade de acessório inválido.')
      totalEsperado.set(codigo, (totalEsperado.get(codigo) || 0) + linha.quantidade)
    }
    const codigos = new Set([...totalCalculado.keys(), ...totalEsperado.keys()])
    const diferencas = Array.from(codigos).sort().map(codigo => {
      const esperado = totalEsperado.get(codigo) ?? null
      const calculado = totalCalculado.get(codigo) ?? null
      return { codigo, esperado, calculado,
        conforme: esperado != null && calculado != null && Math.abs(esperado - calculado) <= 0.001 }
    })
    const conformes = diferencas.filter(c => c.conforme).length
    return { ok: conformes === diferencas.length && diferencas.length > 0,
      conferidos: diferencas.length, conformes, diferencas }
  } catch (erro) {
    return { ok: false, conferidos: 0, conformes: 0, diferencas: [],
      erro: erro instanceof Error ? erro.message : 'Falha ao conferir acessórios.' }
  }
}

export function lerListaAcessorios(texto: string): Array<{ codigo: string; quantidade: number }> {
  const linhas = texto.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  if (linhas.length > 500) throw Error('Limite de 500 acessórios por projeto.')
  const valores: Array<{ codigo: string; quantidade: number }> = []
  for (const [i, linha] of linhas.entries()) {
    if (/^(c[oó]digo|acess[oó]rio)[;\t]/i.test(linha)) continue
    const partes = linha.split(/[;\t]/).map(x => x.trim())
    const quantidade = Number((partes[1] || '').replace(',', '.'))
    if (partes.length !== 2 || !/^[a-zA-Z0-9_.-]{1,40}$/.test(partes[0]) ||
      !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 10000)
      throw Error('Linha ' + (i + 1) + ': informe CÓDIGO;QUANTIDADE válida.')
    valores.push({ codigo: partes[0].toUpperCase(), quantidade })
  }
  return valores
}
