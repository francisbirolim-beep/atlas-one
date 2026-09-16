import { calcularFormulaCorteIsolada, calcularFormulasCorte } from '@/lib/formulasCorteEngine'
import type { RegistroFormulaCorte } from '@/lib/engenhariaFormulasCorte'
import type { Produto } from '@/lib/tipos'

export type EntradaPc2 = { largura: number; altura: number; quantidade: number; opcoes: Record<string, string> }

export function simularReceitaPc2(modelo: RegistroFormulaCorte, entrada: EntradaPc2, produtos: Produto[]) {
  if (entrada.opcoes.fechamento === 'fechadura' && entrada.opcoes.montante_lateral === 'estreito')
    throw new Error('Fechadura exige montante lateral largo.')
  if (entrada.opcoes.mao_amigo_largura === 'largo' && entrada.opcoes.contramarco === 'sem')
    throw new Error('Mão-de-amigo larga sem CM200: fórmula dimensional pendente de comprovação.')
  const pendencias = [
    entrada.opcoes.mao_amigo_largura === 'largo' ? 'largura da mão-de-amigo larga com CM200 em validação' : '',
    entrada.opcoes.trilho === 'convencional' ? 'receita do trilho convencional pendente' : '',
    entrada.opcoes.fechamento === 'concha' ? 'montante e acessórios da concha pendentes' : '',
    entrada.opcoes.roldana === '200' ? 'referência da roldana 200 kg pendente' : '',
  ].filter(Boolean)
  const perfis = calcularFormulasCorte(modelo, entrada.largura, entrada.altura, entrada.opcoes).map(peca => {
    const mestre = produtos.find(p => p.codigo === peca.codigo)
    const quantidade = (peca.quantidade || 1) * entrada.quantidade
    const unidadeCusto = (mestre?.unidade || '').toUpperCase()
    const custo = mestre?.custo && mestre.custo > 0
      ? unidadeCusto === 'KG' && mestre.peso_kg_m && mestre.peso_kg_m > 0
        ? peca.tamanho / 1000 * mestre.peso_kg_m * mestre.custo * quantidade
        : ['MT','M'].includes(unidadeCusto) ? peca.tamanho / 1000 * mestre.custo * quantidade : null
      : null
    return { codigo: peca.codigo, descricao: mestre?.nome || peca.descricao || 'Descrição pendente', corte: peca.tamanho, quantidade, eixo: peca.eixo || 'L', desenho: mestre?.foto_url || null, custo }
  })
  const escolherFormula = (base: string | undefined, condicoes: typeof modelo.vidro.condicoes_largura) =>
    condicoes?.reduce((formula, regra) => Object.entries(regra.quando).every(([chave, valores]) => valores.includes(entrada.opcoes[chave])) ? regra.formula : formula, base)
  const formulaVidroL = escolherFormula(modelo.vidro.formula_largura, modelo.vidro.condicoes_largura)
  const formulaVidroH = escolherFormula(modelo.vidro.formula_altura, modelo.vidro.condicoes_altura)
  if (!formulaVidroL || !formulaVidroH) throw new Error('Fórmula de vidro pendente no cadastro')
  const vidro = {
    descricao: entrada.opcoes.vidro || 'Vidro a selecionar',
    largura: calcularFormulaCorteIsolada(formulaVidroL, entrada.largura, entrada.altura),
    altura: calcularFormulaCorteIsolada(formulaVidroH, entrada.largura, entrada.altura),
    quantidade: (modelo.vidro.quantidade || 2) * entrada.quantidade,
  }
  const vidroMestre = produtos.find(p => p.categoria === 'vidro' && (p.codigo === entrada.opcoes.vidro || p.nome === entrada.opcoes.vidro))
  const vidroComCusto = { ...vidro, desenho: vidroMestre?.foto_url || null, custo: vidroMestre?.custo && vidroMestre.custo > 0 && /m²|m2/i.test(vidroMestre.unidade || '') ? vidro.largura / 1000 * vidro.altura / 1000 * vidro.quantidade * vidroMestre.custo : null }
  const acessorios = modelo.acessorios.filter(a => {
    const condicao = a.condicao_ativa
    return !condicao || Object.entries(condicao).every(([chave, valores]) => valores.includes(entrada.opcoes[chave]))
  }).map(a => {
    const mestre = produtos.find(p => p.codigo === a.codigo)
    const quantidade = a.formula_quantidade
      ? calcularFormulaCorteIsolada(a.formula_quantidade, entrada.largura, entrada.altura) * entrada.quantidade
      : a.quantidade_referencia !== undefined ? a.quantidade_referencia * entrada.quantidade : null
    return { codigo: a.codigo, descricao: mestre?.nome || a.descricao || 'Descrição pendente', quantidade, unidade: mestre?.unidade || a.unidade || 'UN', observacao: quantidade === null ? 'Consumo pendente' : a.status === 'referencia' ? 'Quantidade observada; regra em validação' : undefined, desenho: mestre?.foto_url || null, custo: quantidade !== null && mestre?.custo && mestre.custo > 0 ? quantidade * mestre.custo : null }
  })
  return { perfis, vidro: vidroComCusto, acessorios, nivel: 'em_validacao' as const, aviso: `Receita técnica V1 em validação. ${pendencias.length ? pendencias.join('; ') + '. ' : ''}Custos e consumos pendentes exigem conferência.` }
}
