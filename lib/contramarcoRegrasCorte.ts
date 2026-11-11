import type { MedicaoItem } from './tipos'

// As medidas de entrada já são de fabricação (folgas da obra descontadas na Medida Final).
// A conexão de 90 graus é aplicada exclusivamente às peças do contramarco.
export type FormatoContramarco = 'porta' | 'janela'

export type CodigoPerfilContramarco = 'CM200' | 'CM060'

/** Sugestão editável: a decisão técnica final pertence à obra/receita. */
export function sugerirPerfilContramarco(item: { tipo_esquadria?: string | null; tipo_outro_texto?: string | null; descricao?: string | null }): CodigoPerfilContramarco {
  const nome = [item.tipo_esquadria, item.tipo_outro_texto, item.descricao]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const portaGiro = /porta[_\s-]*(giro|de[_\s-]*giro|abrir)/.test(nome)
  const maximArOuBasculante = /maxim[\s_-]*ar|maximiar|maxim|basculante/.test(nome)
  return portaGiro || maximArOuBasculante ? 'CM200' : 'CM060'
}

export function perfilAprovadoContramarco(item: {
  campos_extras?: Record<string, string | number> | null
  tipo_esquadria?: string | null
  tipo_outro_texto?: string | null
  descricao?: string | null
}): string {
  const salvo = String(item.campos_extras?.contramarco_perfil_codigo || '').trim().toUpperCase()
  return salvo || sugerirPerfilContramarco(item)
}

export function descricaoPerfilContramarco(codigo: CodigoPerfilContramarco): string {
  return codigo === 'CM200' ? 'CM 200 — perfil mais estreito' : 'CM 060 — perfil mais largo'
}


export type PecaContramarco = {
  nome: string
  eixo: 'L' | 'H'
  quantidade: number
  corte_mm: number
  desconto_total_mm: number
}

export type PlanoCorteContramarco = {
  formato: FormatoContramarco
  largura_final_mm: number
  altura_final_mm: number
  quantidade_contramarcos: number
  pecas: PecaContramarco[]
  conectores_90: number
  grapas: number
  grapas_por_lado: number[]
}

export function identificarFormatoContramarco(item: Pick<MedicaoItem, 'tipo_esquadria' | 'tipo_outro_texto' | 'descricao'>): FormatoContramarco | null {
  const nome = [item.tipo_esquadria, item.tipo_outro_texto, item.descricao].filter(Boolean)
    .join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (nome.includes('porta')) return 'porta'
  if (nome.includes('janela') || nome.includes('maxim') || nome.includes('basculante') || nome.includes('vitrau')) return 'janela'
  // Outras tipologias não herdam as fórmulas automaticamente.
  return null
}

export function calcularPlanoContramarco(
  formato: FormatoContramarco,
  largura_final_mm: number,
  altura_final_mm: number,
  quantidade_contramarcos = 1,
): PlanoCorteContramarco {
  const dimensoes = [largura_final_mm, altura_final_mm]
  if (dimensoes.some(v => !Number.isFinite(v) || v <= 0)) throw new Error('Medida final do contramarco inválida.')
  if (!Number.isInteger(quantidade_contramarcos) || quantidade_contramarcos < 1) throw new Error('Quantidade de contramarcos inválida.')
  const larguraCorte = largura_final_mm - 50
  const alturaCorte = altura_final_mm - (formato === 'porta' ? 25 : 50)
  if (larguraCorte <= 0 || alturaCorte <= 0) throw new Error('A conexão ocupa mais que a dimensão final. Confira a medida.')

  const pecas: PecaContramarco[] = [
    { nome: formato === 'porta' ? 'Travessa superior' : 'Travessas superior e inferior',
      eixo: 'L', quantidade: (formato === 'porta' ? 1 : 2) * quantidade_contramarcos,
      corte_mm: larguraCorte, desconto_total_mm: 50 },
    { nome: 'Montantes laterais', eixo: 'H',
      quantidade: 2 * quantidade_contramarcos, corte_mm: alturaCorte,
      desconto_total_mm: formato === 'porta' ? 25 : 50 },
  ]

  // Estimativa conservadora aprovada na prévia: porta com reforço de uma
  // posição de grapa em cada montante; janela, por lado a cada 500 mm.
  // Conferir a distribuição física antes de liberar a fabricação.
  const nLado = (medida: number) => Math.max(1, Math.ceil(medida / 500))
  const grapas_por_lado = formato === 'porta'
    ? [nLado(altura_final_mm) + 1, nLado(altura_final_mm) + 1]
    : [nLado(largura_final_mm), nLado(altura_final_mm), nLado(largura_final_mm), nLado(altura_final_mm)]
  return {
    formato, largura_final_mm, altura_final_mm, quantidade_contramarcos,
    pecas,
    conectores_90: (formato === 'porta' ? 2 : 4) * quantidade_contramarcos,
    grapas: grapas_por_lado.reduce((total, n) => total + n, 0) * quantidade_contramarcos,
    grapas_por_lado,
  }
}

export function calcularPlanoDoItem(item: MedicaoItem): PlanoCorteContramarco {
  const perfil = perfilAprovadoContramarco(item)
  if (!['CM200', 'CM060'].includes(perfil)) {
    throw new Error(`Perfil ${perfil} requer receita de conexão e descontos validada antes do corte.`)
  }
  const formato = identificarFormatoContramarco(item)
  if (!formato) throw new Error(`A tipologia "${item.descricao || item.tipo_outro_texto || item.tipo_esquadria}" precisa de uma receita de corte validada.`)
  return calcularPlanoContramarco(
    formato,
    Number(item.producao_largura_mm),
    Number(item.producao_altura_mm),
    Number(item.quantidade) || 1,
  )
}
