export type CortePerfil = {
  id: string
  material_id?: string | null
  item_ref?: string | null
  produto_id: string
  codigo: string
  cor_ref?: string | null
  comprimento_mm: number
  quantidade: number
  comprimento_barra_mm: number
}

export type SobraPerfilDisponivel = {
  id: string
  produto_id: string
  codigo?: string | null
  cor_ref?: string | null
  comprimento_mm: number
}

export type CorteAlocado = {
  id: string
  material_id?: string | null
  item_ref?: string | null
  codigo: string
  comprimento_mm: number
  perda_corte_mm: number
}

export type BarraAproveitamento = {
  chave: string
  produto_id: string
  codigo: string
  cor_ref?: string | null
  fonte_tipo: 'barra_nova' | 'sobra_estoque'
  sobra_estoque_id?: string | null
  comprimento_inicial_mm: number
  comprimento_usado_mm: number
  sobra_final_mm: number
  reaproveitavel: boolean
  cortes: CorteAlocado[]
}

export type ResultadoAproveitamento = {
  barras: BarraAproveitamento[]
  barras_novas: number
  sobras_estoque_usadas: number
  cortes_total: number
  comprimento_total_mm: number
  sobra_total_mm: number
  sobra_reaproveitavel_mm: number
  pendencias: string[]
}

function normalizarCor(valor?: string | null) {
  return (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
}

function mesmaCor(a?: string | null, b?: string | null) {
  return normalizarCor(a) === normalizarCor(b)
}

/**
 * Best-fit decrescente, determinístico e conservador.
 *
 * - cada perfil/cor é otimizado separadamente;
 * - sobras físicas selecionadas entram antes das barras novas;
 * - `perdaCorteMm` é explícita (default 0), nunca inventada;
 * - o algoritmo não reserva estoque: apenas calcula o plano.
 */
export function otimizarPerfis(
  cortes: CortePerfil[],
  sobras: SobraPerfilDisponivel[] = [],
  opcoes: { perdaCorteMm?: number; minimoSobraReaproveitavelMm?: number } = {}
): ResultadoAproveitamento {
  const perdaCorteMm = Math.max(0, Number(opcoes.perdaCorteMm || 0))
  const minimoSobraReaproveitavelMm = Math.max(0, Number(opcoes.minimoSobraReaproveitavelMm || 0))
  const pendencias: string[] = []
  const barras: BarraAproveitamento[] = []

  const pecas = cortes.flatMap(corte => {
    const qtd = Math.max(0, Math.floor(Number(corte.quantidade || 0)))
    if (!corte.produto_id || !corte.codigo) {
      pendencias.push(`Corte ${corte.id}: perfil sem produto/código.`)
      return []
    }
    if (!Number.isFinite(corte.comprimento_mm) || corte.comprimento_mm <= 0) {
      pendencias.push(`${corte.codigo}: comprimento de corte inválido.`)
      return []
    }
    if (!Number.isFinite(corte.comprimento_barra_mm) || corte.comprimento_barra_mm <= 0) {
      pendencias.push(`${corte.codigo}: comprimento da barra não cadastrado.`)
      return []
    }
    if (corte.comprimento_mm + perdaCorteMm > corte.comprimento_barra_mm) {
      pendencias.push(`${corte.codigo}: corte de ${corte.comprimento_mm} mm não cabe na barra de ${corte.comprimento_barra_mm} mm.`)
      return []
    }
    return Array.from({ length: qtd }, (_, indice) => ({
      ...corte,
      peca_id: `${corte.id}:${indice + 1}`,
    }))
  })

  const grupos = new Map<string, typeof pecas>()
  for (const peca of pecas) {
    const chave = `${peca.produto_id}|${normalizarCor(peca.cor_ref)}|${peca.comprimento_barra_mm}`
    const grupo = grupos.get(chave) || []
    grupo.push(peca)
    grupos.set(chave, grupo)
  }

  for (const [grupoChave, grupo] of grupos) {
    grupo.sort((a, b) => b.comprimento_mm - a.comprimento_mm || a.peca_id.localeCompare(b.peca_id))
    const modelo = grupo[0]
    const candidatas: BarraAproveitamento[] = []

    const sobrasGrupo = sobras
      .filter(s => s.produto_id === modelo.produto_id && mesmaCor(s.cor_ref, modelo.cor_ref) && s.comprimento_mm > 0)
      .sort((a, b) => a.comprimento_mm - b.comprimento_mm || a.id.localeCompare(b.id))

    for (const sobra of sobrasGrupo) {
      candidatas.push({
        chave: `sobra:${sobra.id}`,
        produto_id: modelo.produto_id,
        codigo: modelo.codigo,
        cor_ref: modelo.cor_ref || null,
        fonte_tipo: 'sobra_estoque',
        sobra_estoque_id: sobra.id,
        comprimento_inicial_mm: sobra.comprimento_mm,
        comprimento_usado_mm: 0,
        sobra_final_mm: sobra.comprimento_mm,
        reaproveitavel: sobra.comprimento_mm >= minimoSobraReaproveitavelMm,
        cortes: [],
      })
    }

    let numeroBarraNova = 0
    for (const peca of grupo) {
      const consumo = peca.comprimento_mm + perdaCorteMm
      const queCabem = candidatas
        .filter(barra => barra.sobra_final_mm + 1e-9 >= consumo)
        .sort((a, b) => {
          if (a.fonte_tipo !== b.fonte_tipo) return a.fonte_tipo === 'sobra_estoque' ? -1 : 1
          const sobraA = a.sobra_final_mm - consumo
          const sobraB = b.sobra_final_mm - consumo
          return sobraA - sobraB || a.chave.localeCompare(b.chave)
        })

      let barra = queCabem[0]
      if (!barra) {
        numeroBarraNova += 1
        barra = {
          chave: `nova:${grupoChave}:${numeroBarraNova}`,
          produto_id: peca.produto_id,
          codigo: peca.codigo,
          cor_ref: peca.cor_ref || null,
          fonte_tipo: 'barra_nova',
          sobra_estoque_id: null,
          comprimento_inicial_mm: peca.comprimento_barra_mm,
          comprimento_usado_mm: 0,
          sobra_final_mm: peca.comprimento_barra_mm,
          reaproveitavel: false,
          cortes: [],
        }
        candidatas.push(barra)
      }

      barra.cortes.push({
        id: peca.peca_id,
        material_id: peca.material_id || null,
        item_ref: peca.item_ref || null,
        codigo: peca.codigo,
        comprimento_mm: peca.comprimento_mm,
        perda_corte_mm: perdaCorteMm,
      })
      barra.comprimento_usado_mm += consumo
      barra.sobra_final_mm = Math.max(0, barra.comprimento_inicial_mm - barra.comprimento_usado_mm)
      barra.reaproveitavel = barra.sobra_final_mm >= minimoSobraReaproveitavelMm && barra.sobra_final_mm > 0
    }

    // Sobras de estoque não utilizadas não fazem parte do plano final.
    barras.push(...candidatas.filter(b => b.cortes.length > 0))
  }

  return {
    barras,
    barras_novas: barras.filter(b => b.fonte_tipo === 'barra_nova').length,
    sobras_estoque_usadas: barras.filter(b => b.fonte_tipo === 'sobra_estoque').length,
    cortes_total: barras.reduce((s, b) => s + b.cortes.length, 0),
    comprimento_total_mm: barras.reduce((s, b) => s + b.cortes.reduce((x, c) => x + c.comprimento_mm, 0), 0),
    sobra_total_mm: barras.reduce((s, b) => s + b.sobra_final_mm, 0),
    sobra_reaproveitavel_mm: barras.filter(b => b.reaproveitavel).reduce((s, b) => s + b.sobra_final_mm, 0),
    pendencias,
  }
}

export function agruparCompraDeBarras(resultado: ResultadoAproveitamento) {
  const mapa = new Map<string, {
    produto_id: string
    codigo: string
    cor_ref?: string | null
    comprimento_barra_mm: number
    quantidade: number
  }>()

  for (const barra of resultado.barras.filter(b => b.fonte_tipo === 'barra_nova')) {
    const chave = `${barra.produto_id}|${normalizarCor(barra.cor_ref)}|${barra.comprimento_inicial_mm}`
    const atual = mapa.get(chave)
    if (atual) atual.quantidade += 1
    else mapa.set(chave, {
      produto_id: barra.produto_id,
      codigo: barra.codigo,
      cor_ref: barra.cor_ref || null,
      comprimento_barra_mm: barra.comprimento_inicial_mm,
      quantidade: 1,
    })
  }
  return Array.from(mapa.values())
}
