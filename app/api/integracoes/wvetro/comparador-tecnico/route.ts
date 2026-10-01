import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { neonStaging, statusNeonStaging } from '@/lib/neonStaging'
import { assinaturaComposicaoWVetro, classificarFamiliaPc2Suprema, classificarFamiliaPc4Suprema, compararItemWVetroComFormulaAtlas, ehPc2SupremaDominante, extrairVariantesPc2Suprema, inferirOpcoesTecnicasWVetro, type FormulaAtlasComparacao, type WVetroItemTecnico } from '@/lib/wvetroComparadorTecnico'
import { FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_ATLAS, FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA, FIXTURE_PC2_SUPREMA_WVETRO, FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA, FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA, FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA , FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA, FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA, FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA, FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA, FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA, FIXTURE_BAS3_SUPREMA_ATLAS_REFERENCIA } from '@/lib/wvetroComparadorFixtures'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function rankStatus(status: string | null | undefined) {
  const mapa: Record<string, number> = { validada: 0, em_validacao: 1, referencia: 2, em_desenvolvimento: 3 }
  return mapa[String(status || '')] ?? 9
}

function formulaDoBanco(row: any): FormulaAtlasComparacao {
  return {
    tipologia_id: row.tipologia_id,
    configuracao_label: row.configuracao_label || 'Padrão',
    variaveis: Array.isArray(row.variaveis) ? row.variaveis : [],
    pecas: Array.isArray(row.pecas) ? row.pecas : [],
    vidro: row.vidro && typeof row.vidro === 'object' && !Array.isArray(row.vidro) ? row.vidro : {},
    acessorios: Array.isArray(row.acessorios) ? row.acessorios : [],
  }
}

function itensDoPayload(payload: any): WVetroItemTecnico[] {
  const itens = Array.isArray(payload?.Itens) ? payload.Itens : []
  return itens.filter((x: unknown) => x && typeof x === 'object') as WVetroItemTecnico[]
}

function conjuntoExato(codigos: string[], esperados: string[]) {
  const atual = [...new Set(codigos.map(c => c.trim().toUpperCase()).filter(Boolean))].sort()
  const alvo = [...new Set(esperados.map(c => c.trim().toUpperCase()).filter(Boolean))].sort()
  return atual.length === alvo.length && atual.every((codigo, index) => codigo === alvo[index])
}

function formulasReferenciaLocal(item: WVetroItemTecnico) {
  const linha = String(item.Linha || '').trim().toUpperCase()
  const modelo = String(item.Modelo || '').trim().toUpperCase()
  const refs: any[] = []

  if (linha.includes('SUPREMA') && modelo.includes('JANELA DE CORRER 02 FOLHAS')) {
    refs.push({
      id: 'referencia-local-jc2-suprema',
      tipologia_id: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA.tipologia_id,
      configuracao_label: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA.configuracao_label,
      status: 'referencia_historica',
      ativo: false,
      variaveis: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA.variaveis,
      pecas: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA.pecas,
      vidro: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA.vidro,
      acessorios: FIXTURE_JC2_SUPREMA_ATLAS_REFERENCIA.acessorios || [],
    })
  }

  if (ehPc2SupremaDominante(item)) {
    const formula = FIXTURE_PC2_SUPREMA_DOMINANTE_ATLAS_REFERENCIA
    refs.push({
      id: 'referencia-local-pc2-suprema-dominante',
      tipologia_id: formula.tipologia_id,
      configuracao_label: 'PC2 Suprema · vidro padrão dominante',
      status: 'referencia_historica',
      ativo: false,
      variaveis: formula.variaveis,
      pecas: formula.pecas,
      vidro: formula.vidro,
      acessorios: formula.acessorios || [],
    })
  }

  if (linha.includes('SUPREMA') && modelo.includes('PORTA DE CORRER 03 FOLHAS')) {
    for (const [id, formula] of [
      ['referencia-local-pc3-suprema-atual', FIXTURE_PC3_SUPREMA_ATUAL_ATLAS_REFERENCIA],
      ['referencia-local-pc3-suprema-legado', FIXTURE_PC3_SUPREMA_LEGADO_ATLAS_REFERENCIA],
    ] as const) {
      refs.push({
        id,
        tipologia_id: formula.tipologia_id,
        configuracao_label: formula.configuracao_label,
        status: 'referencia_historica',
        ativo: false,
        variaveis: formula.variaveis,
        pecas: formula.pecas,
        vidro: formula.vidro,
        acessorios: formula.acessorios || [],
      })
    }
  }

  if (linha === 'L. SUPREMA' && modelo.includes('JANELA DE CORRER 03 FOLHAS')) {
    const formula = FIXTURE_JC3_SUPREMA_ATLAS_REFERENCIA
    refs.push({
      id: 'referencia-local-jc3-suprema-moderna',
      tipologia_id: formula.tipologia_id,
      configuracao_label: formula.configuracao_label,
      status: 'referencia_historica',
      ativo: false,
      variaveis: formula.variaveis,
      pecas: formula.pecas,
      vidro: formula.vidro,
      acessorios: formula.acessorios || [],
    })
  }

  if (linha.includes('SUPREMA') && modelo.includes('PORTA DE GIRO 01 FOLHA')) {
    const perfis = (item.Perfil || []).map(p => String(p.Codigo || ''))
    const acessorios = (item.Acessorios || []).map(a => String(a.Codigo || ''))

    const referencias = [
      {
        id: 'referencia-local-pg1-lambril-suprema',
        formula: FIXTURE_PG1_LAMBRIL_SUPREMA_ATLAS_REFERENCIA,
        perfis: ['25-548 (L-715)','GS-034','MP347','SU102','SU111','SU225','SU279'],
        acessorios: [
          'ALMC25','ALMC2960','BUC755','CON295','DOB840','FIT206','FRA822','GUA239','GUA258',
          'MAC927','NYL042','NYL190','PAR1025','PAR1037','PAR435','REBACA4X10','SIL-PU',
        ],
        validarKit: false,
        exigirVidro: false,
      },
      {
        id: 'referencia-local-pg1-vidro-suprema',
        formula: FIXTURE_PG1_VIDRO_SUPREMA_ATLAS_REFERENCIA,
        perfis: ['25-548 (L-715)','MP347','SU102','SU111','SU225','SU279'],
        acessorios: [
          'ALMC25','ALMC2960','BUC755','CON295','DOB840','FIT206','FRA822','GUA171','GUA239',
          'GUA258','GUA259','MAC927','NYL042','NYL190','PAR1025','PAR1037','PAR435','REBACA4X10','SIL-PU',
        ],
        validarKit: true,
        exigirVidro: false,
      },
      {
        id: 'referencia-local-pg1-vidro-suprema-sem-arremate',
        formula: FIXTURE_PG1_VIDRO_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA,
        perfis: ['25-548 (L-715)','SU102','SU111','SU225','SU279'],
        acessorios: [
          'ALMC25','ALMC2960','BUC755','CON295','DOB840','FIT206','FRA822','GUA171','GUA239',
          'GUA258','GUA259','MAC927','NYL042','PAR1037','PAR435','REBACA4X10','SIL-PU',
        ],
        validarKit: true,
        exigirVidro: true,
      },
    ] as const

    const multiplicador = Math.max(1, Number(item.Qtde || 1) || 1)
    const qtdAcessorio = (codigo: string) =>
      (item.Acessorios || [])
        .filter(a => String(a.Codigo || '').trim().toUpperCase() === codigo)
        .reduce((soma, a) => soma + (Number(a.Qtde || 0) || 0), 0) / multiplicador

    for (const referencia of referencias) {
      if (!conjuntoExato(perfis, referencia.perfis as unknown as string[])) continue
      if (!conjuntoExato(acessorios, referencia.acessorios as unknown as string[])) continue
      if (referencia.exigirVidro && !(item.Vidros || []).length) continue
      if (referencia.validarKit) {
        const kitUnitario =
          Math.abs(qtdAcessorio('ALMC25') - 2) < 0.0001 &&
          Math.abs(qtdAcessorio('CON295') - 1) < 0.0001 &&
          Math.abs(qtdAcessorio('FRA822') - 1) < 0.0001 &&
          Math.abs(qtdAcessorio('PAR435') - 4) < 0.0001
        if (!kitUnitario) continue
      }

      const formula = referencia.formula
      refs.push({
        id: referencia.id,
        tipologia_id: formula.tipologia_id,
        configuracao_label: formula.configuracao_label,
        status: 'referencia_historica',
        ativo: false,
        variaveis: formula.variaveis,
        pecas: formula.pecas,
        vidro: formula.vidro,
        acessorios: formula.acessorios || [],
      })
    }
  }

  if (linha.includes('SUPREMA') && modelo.includes('MAXIM-AR')) {
    const perfis = (item.Perfil || []).map(p => String(p.Codigo || ''))
    const acessorios = (item.Acessorios || []).map(a => String(a.Codigo || ''))

    const candidatas = [
      {
        id: 'referencia-local-max1-suprema-dominante',
        formula: FIXTURE_MAX1_SUPREMA_ATLAS_REFERENCIA,
        perfis: ['MP347','SU079','SU081','SU082','SU084','SU102','SU276'],
        acessorios: [
          'ALMC25','BRA702','BUC755','FEC009D','GUA007','GUA157','GUA239','GUA256',
          'GUA258','NYL190','NYL355','PAR1025','PAR1037','PAR435','REBACA4X10','SIL-PU',
        ],
      },
      {
        id: 'referencia-local-max1-suprema-cm200',
        formula: FIXTURE_MAX1_SUPREMA_CM200_ATLAS_REFERENCIA,
        perfis: ['CM200','MP347','SU079','SU081','SU082','SU084','SU102','SU276'],
        acessorios: [
          'ALMC25','BRA702','CHU838','FEC009D','GUA007','GUA157','GUA239','GUA256',
          'GUA258','NYL-10002','NYL190','NYL355','PAR1025','PAR435','REBACA4X10','SIL-PU',
        ],
      },
      {
        id: 'referencia-local-max1-suprema-sem-arremate',
        formula: FIXTURE_MAX1_SUPREMA_SEM_ARREMATE_ATLAS_REFERENCIA,
        perfis: ['SU079','SU081','SU082','SU084','SU102','SU276'],
        acessorios: [
          'ALMC25','BRA702','BUC755','FEC009D','GUA007','GUA157','GUA239','GUA256',
          'GUA258','NYL355','PAR1037','PAR435','REBACA4X10','SIL-PU',
        ],
      },
    ] as const

    for (const candidata of candidatas) {
      if (!conjuntoExato(perfis, candidata.perfis as unknown as string[])) continue
      if (!conjuntoExato(acessorios, candidata.acessorios as unknown as string[])) continue
      const formula = candidata.formula
      refs.push({
        id: candidata.id,
        tipologia_id: formula.tipologia_id,
        configuracao_label: formula.configuracao_label,
        status: 'referencia_historica',
        ativo: false,
        variaveis: formula.variaveis,
        pecas: formula.pecas,
        vidro: formula.vidro,
        acessorios: formula.acessorios || [],
      })
    }
  }


  if (linha.includes('SUPREMA') && modelo.includes('BASCULANTE')) {
    const perfis = (item.Perfil || []).map(p => String(p.Codigo || ''))
    const acessorios = (item.Acessorios || []).map(a => String(a.Codigo || ''))
    const perfisDominantes = [
      'AF-018','BC-009','CL006','CL011','MP347','SU093','SU096','SU097','SU098','SU100','SU102',
    ]
    const acessoriosDominantes = [
      'ALA-059','ARR-10001','BUC753','CON456','GUA171','GUA259','NYL190',
      'PARFIAPF04850N','PARFIAPP04216N','PIV753','REBACA4X10','REBCCC-5/32X1/2','SIL-PU',
    ]

    if (conjuntoExato(perfis, perfisDominantes) && conjuntoExato(acessorios, acessoriosDominantes)) {
      const multiplicador = Math.max(1, Number(item.Qtde || 1) || 1)
      const qtdAcessorio = (codigo: string) =>
        (item.Acessorios || [])
          .filter(a => String(a.Codigo || '').trim().toUpperCase() === codigo)
          .reduce((soma, a) => soma + (Number(a.Qtde || 0) || 0), 0) / multiplicador
      const kitUnitario =
        Math.abs(qtdAcessorio('ALA-059') - 1) < 0.0001 &&
        Math.abs(qtdAcessorio('ARR-10001') - 6) < 0.0001 &&
        Math.abs(qtdAcessorio('CON456') - 1) < 0.0001 &&
        Math.abs(qtdAcessorio('PIV753') - 2) < 0.0001

      if (kitUnitario && (item.Vidros || []).length > 0) {
        const formula = FIXTURE_BAS3_SUPREMA_ATLAS_REFERENCIA
        refs.push({
          id: 'referencia-local-bas3-suprema-dominante',
          tipologia_id: formula.tipologia_id,
          configuracao_label: formula.configuracao_label,
          status: 'referencia_historica',
          ativo: false,
          variaveis: formula.variaveis,
          pecas: formula.pecas,
          vidro: formula.vidro,
          acessorios: formula.acessorios || [],
        })
      }
    }
  }

  return refs
}

async function carregarFormula(item: WVetroItemTecnico, formulaId?: string) {
  if (formulaId) {
    const localSelecionada = formulasReferenciaLocal(item).find((f: any) => f.id === formulaId)
    if (localSelecionada) {
      const locais = formulasReferenciaLocal(item)
      return {
        formula: formulaDoBanco(localSelecionada),
        formulaBanco: localSelecionada,
        formulasBanco: locais,
        referencia: null,
        disponiveis: locais.map((f: any) => ({
          id: f.id,
          configuracao_label: f.configuracao_label,
          status: f.status,
          ativo: f.ativo,
        })),
      }
    }

    const { data, error } = await supabaseAdmin
      .from('engenharia_tipologia_formulas_corte')
      .select('id,tipologia_id,configuracao_label,status,ativo,variaveis,pecas,vidro,acessorios')
      .eq('id', formulaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Fórmula Atlas não encontrada.')
    const { data: irmas, error: erroIrmas } = await supabaseAdmin
      .from('engenharia_tipologia_formulas_corte')
      .select('id,tipologia_id,configuracao_label,status,ativo,variaveis,pecas,vidro,acessorios')
      .eq('tipologia_id', data.tipologia_id)
    if (erroIrmas) throw erroIrmas
    const disponiveis = [...(irmas || [])].sort((a: any, b: any) => {
      const ativo = Number(Boolean(b.ativo)) - Number(Boolean(a.ativo))
      return ativo !== 0 ? ativo : rankStatus(a.status) - rankStatus(b.status)
    }).map((f: any) => ({
      id: f.id,
      configuracao_label: f.configuracao_label,
      status: f.status,
      ativo: f.ativo,
    }))
    return { formula: formulaDoBanco(data), formulaBanco: data, formulasBanco: [data, ...(irmas || []).filter((f: any) => f.id !== data.id)], referencia: null, disponiveis }
  }

  const linha = String(item.Linha || '').trim()
  const modelo = String(item.Modelo || '').trim()
  const familiaPc2 = classificarFamiliaPc2Suprema(item)
  if (familiaPc2 !== 'outra' && !formulasReferenciaLocal(item).length) {
    const variante = extrairVariantesPc2Suprema(item)
    throw new Error(
      `Variante PC2 Suprema ainda não validada tecnicamente: familia=${variante.familia}; montagem=${variante.montagem}; contramarco=${variante.contramarco}; arremate=${variante.arremate}; trilho=${variante.trilho}; persiana=${variante.persianaAcionamento}; reforco_aba=${variante.reforcoAba ? 'sim' : 'nao'}; reforco_externo=${variante.reforcoExterno ? 'sim' : 'nao'}.`
    )
  }

  const familiaPc4 = classificarFamiliaPc4Suprema(item)
  if (familiaPc4 !== 'outra' && !formulasReferenciaLocal(item).length) {
    throw new Error(`Variante PC4 Suprema ainda não validada tecnicamente: familia=${familiaPc4}.`)
  }

  const { data: referencia, error: refError } = await supabaseAdmin
    .from('wvetro_referencias_tipologias')
    .select('id,linha_raw,modelo_raw,tipologia_atlas_id,status_mapeamento')
    .ilike('linha_raw', linha)
    .ilike('modelo_raw', modelo)
    .limit(1)
    .maybeSingle()

  if (refError) throw refError
  if (!referencia?.tipologia_atlas_id) throw new Error('A tipologia W.Vetro ainda não está vinculada a uma tipologia Atlas.')

  const { data: formulas, error } = await supabaseAdmin
    .from('engenharia_tipologia_formulas_corte')
    .select('id,tipologia_id,configuracao_label,status,ativo,variaveis,pecas,vidro,acessorios')
    .eq('tipologia_id', referencia.tipologia_atlas_id)
  if (error) throw error

  const locais = formulasReferenciaLocal(item)
  const ordenadas = [...(formulas || []), ...locais].sort((a: any, b: any) => {
    const ativo = Number(Boolean(b.ativo)) - Number(Boolean(a.ativo))
    return ativo !== 0 ? ativo : rankStatus(a.status) - rankStatus(b.status)
  })
  if (!ordenadas.length) throw new Error('A tipologia Atlas vinculada ainda não possui fórmula técnica nem referência histórica local.')

  return {
    formula: formulaDoBanco(ordenadas[0]),
    formulaBanco: ordenadas[0],
    formulasBanco: ordenadas,
    referencia,
    disponiveis: ordenadas.map((f: any) => ({
      id: f.id,
      configuracao_label: f.configuracao_label,
      status: f.status,
      ativo: f.ativo,
    })),
  }
}

function pontuarResultado(resultado: ReturnType<typeof compararItemWVetroComFormulaAtlas>) {
  const r = resultado.resumo
  return (
    Number(r.ausente_atlas || 0) * 20 +
    Number(r.ausente_wvetro || 0) * 10 +
    Number(r.quantidade_diferente || 0) * 5 +
    Number(r.regra_pendente_atlas || 0) * 3 +
    Number(r.medida_diferente || 0)
  )
}

function escolherMelhorFormula(
  item: WVetroItemTecnico,
  rows: any[],
  opcoesInformadas: Record<string, string>,
) {
  const avaliadas = rows.flatMap((row: any) => {
    try {
      const formula = formulaDoBanco(row)
      const inferencia = inferirOpcoesTecnicasWVetro(item, formula, opcoesInformadas)
      const resultado = compararItemWVetroComFormulaAtlas({ item, formula, opcoes: inferencia.opcoes })
      return [{
        row,
        formula,
        inferencia,
        resultado,
        score: pontuarResultado(resultado),
      }]
    } catch {
      return []
    }
  })

  avaliadas.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    const ativo = Number(Boolean(b.row.ativo)) - Number(Boolean(a.row.ativo))
    if (ativo !== 0) return ativo
    return rankStatus(a.row.status) - rankStatus(b.row.status)
  })

  if (!avaliadas.length) throw new Error('Nenhuma fórmula Atlas pôde ser avaliada para este item.')
  return {
    melhor: avaliadas[0],
    ranking: avaliadas.map(a => ({
      id: a.row.id,
      configuracao_label: a.row.configuracao_label,
      status: a.row.status,
      ativo: a.row.ativo,
      score: a.score,
      resumo: a.resultado.resumo,
    })),
  }
}

function numeroSeguro(v: unknown, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function familiaHistorica(item: WVetroItemTecnico) {
  const pc2 = classificarFamiliaPc2Suprema(item)
  if (pc2 !== 'outra') return `pc2:${pc2}`
  const pc4 = classificarFamiliaPc4Suprema(item)
  if (pc4 !== 'outra') return `pc4:${pc4}`
  return String(item.Modelo || 'sem_modelo').trim().toLowerCase().replace(/\s+/g, '_')
}

async function matrizHistorica(req: NextRequest) {
  const linha = String(req.nextUrl.searchParams.get('linha') || 'SUPREMA').trim()
  const modelo = String(req.nextUrl.searchParams.get('modelo') || '').trim()
  const limite = Math.max(1, Math.min(5000, Number(req.nextUrl.searchParams.get('limite') || 2500) || 2500))
  const linhaFiltro = linha ? `%${linha}%` : '%'
  const modeloFiltro = modelo ? `%${modelo}%` : '%'
  const sql = neonStaging()

  const rows = await sql`
    with ultimos as (
      select distinct on (recurso, chave_externa_canonica)
        recurso,
        chave_externa_canonica as chave,
        payload,
        capturado_em,
        versao_canonica
      from wvetro_migracao.raw_canonico
      where recurso in ('orcamentos','pedidos')
      order by recurso, chave_externa_canonica, versao_canonica desc, capturado_em desc
    )
    select
      recurso,
      chave,
      payload->>'Nro' as numero,
      capturado_em,
      item,
      item_ordem
    from ultimos
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(payload->'Itens') = 'array' then payload->'Itens' else '[]'::jsonb end
    ) with ordinality as itens(item, item_ordem)
    where coalesce(item->>'Linha','') ilike ${linhaFiltro}
      and coalesce(item->>'Modelo','') ilike ${modeloFiltro}
    order by capturado_em desc
    limit ${limite}
  `

  type Grupo = {
    assinatura: string
    linha: string
    modelo: string
    familia: string
    ocorrencias: number
    pecas: number
    larguraMin: number | null
    larguraMax: number | null
    alturaMin: number | null
    alturaMax: number | null
    perfis: ReturnType<typeof assinaturaComposicaoWVetro>['perfis']
    acessorios: string[]
    vidros: ReturnType<typeof assinaturaComposicaoWVetro>['vidros']
    cobertura: 'referencia_local' | 'nao_validada'
    referenciasLocais: Array<{ id:string; configuracao_label:string }>
    amostras: Array<{
      numero: string
      itemId: string
      codigo: string
      nome: string
      largura: number
      altura: number
      recurso: string
    }>
  }

  const grupos = new Map<string, Grupo>()
  const itensVistos = new Set<string>()
  for (const row of rows as any[]) {
    const item = row?.item as WVetroItemTecnico | undefined
    if (!item || typeof item !== 'object') continue
    const assinatura = assinaturaComposicaoWVetro(item)
    const numeroRegistro = String(row?.numero || '').trim()
    const itemIdRegistro = String((item as any).Id || '').trim()
    const itemOrdem = numeroSeguro(row?.item_ordem, 0)
    const chaveOcorrencia = numeroRegistro
      ? JSON.stringify([numeroRegistro, itemIdRegistro || itemOrdem, assinatura.chave])
      : JSON.stringify([String(row?.chave || ''), itemIdRegistro || itemOrdem, assinatura.chave])
    if (itensVistos.has(chaveOcorrencia)) continue
    itensVistos.add(chaveOcorrencia)
    const linhaItem = String(item.Linha || '').trim()
    const modeloItem = String(item.Modelo || '').trim()
    const familia = familiaHistorica(item)
    const chaveGrupo = JSON.stringify([linhaItem.toUpperCase(), modeloItem.toUpperCase(), familia, assinatura.chave])
    const largura = numeroSeguro(item.Largura, NaN)
    const altura = numeroSeguro(item.Altura, NaN)
    const quantidade = Math.max(1, numeroSeguro(item.Qtde, 1))
    const referenciasLocais = formulasReferenciaLocal(item)
    const grupo = grupos.get(chaveGrupo) || {
      assinatura: assinatura.chave,
      linha: linhaItem,
      modelo: modeloItem,
      familia,
      ocorrencias: 0,
      pecas: 0,
      larguraMin: null,
      larguraMax: null,
      alturaMin: null,
      alturaMax: null,
      perfis: assinatura.perfis,
      acessorios: assinatura.acessorios,
      vidros: assinatura.vidros,
      cobertura: referenciasLocais.length ? 'referencia_local' : 'nao_validada',
      referenciasLocais: referenciasLocais.map((r:any) => ({
        id: String(r.id || ''),
        configuracao_label: String(r.configuracao_label || r.id || ''),
      })),
      amostras: [],
    }

    grupo.ocorrencias += 1
    grupo.pecas += quantidade
    if (Number.isFinite(largura)) {
      grupo.larguraMin = grupo.larguraMin == null ? largura : Math.min(grupo.larguraMin, largura)
      grupo.larguraMax = grupo.larguraMax == null ? largura : Math.max(grupo.larguraMax, largura)
    }
    if (Number.isFinite(altura)) {
      grupo.alturaMin = grupo.alturaMin == null ? altura : Math.min(grupo.alturaMin, altura)
      grupo.alturaMax = grupo.alturaMax == null ? altura : Math.max(grupo.alturaMax, altura)
    }

    const numero = String(row?.numero || '').trim()
    const itemId = String((item as any).Id || '').trim()
    if (grupo.amostras.length < 5 && numero && !grupo.amostras.some(a => a.numero === numero && a.itemId === itemId)) {
      grupo.amostras.push({
        numero,
        itemId,
        codigo: String(item.Codigo || ''),
        nome: String(item.Nome || ''),
        largura: numeroSeguro(item.Largura),
        altura: numeroSeguro(item.Altura),
        recurso: String(row?.recurso || ''),
      })
    }
    grupos.set(chaveGrupo, grupo)
  }

  const assinaturas = [...grupos.values()].sort((a, b) =>
    Number(a.cobertura === 'referencia_local') - Number(b.cobertura === 'referencia_local') ||
    b.ocorrencias - a.ocorrencias ||
    b.pecas - a.pecas ||
    a.modelo.localeCompare(b.modelo, 'pt-BR') ||
    a.familia.localeCompare(b.familia, 'pt-BR')
  )

  return NextResponse.json({
    ok: true,
    modo: 'matriz',
    filtros: { linha, modelo, limite },
    totalItens: itensVistos.size,
    totalLinhasLidas: rows.length,
    truncado: rows.length >= limite,
    totalAssinaturas: assinaturas.length,
    assinaturas,
  })
}

function opcoesDaUrl(req: NextRequest): Record<string, string> {
  const raw = String(req.nextUrl.searchParams.get('opcoes') || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, valor]) => typeof valor === 'string')
        .map(([chave, valor]) => [chave, String(valor)])
    )
  } catch {
    throw new Error('Opções técnicas inválidas.')
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })

  const modo = String(req.nextUrl.searchParams.get('modo') || 'fixture')
  try {
    if (modo === 'fixture') {
      const resultado = compararItemWVetroComFormulaAtlas({
        item: FIXTURE_PC2_SUPREMA_WVETRO,
        formula: FIXTURE_PC2_SUPREMA_ATLAS,
      })
      return NextResponse.json({
        ok: true,
        modo: 'fixture',
        origem: 'Amostra técnica sanitizada do histórico W.Vetro',
        resultado,
        formula: {
          id: 'fixture-pc2-suprema',
          configuracao_label: FIXTURE_PC2_SUPREMA_ATLAS.configuracao_label,
          status: 'snapshot_validada',
          ativo: true,
        },
        formulasDisponiveis: [],
      })
    }

    const neon = statusNeonStaging()
    if (!neon.configurado) return NextResponse.json({ error: 'Staging Neon não configurado para consulta histórica real.' }, { status: 503 })

    if (modo === 'matriz') return matrizHistorica(req)

    const numero = String(req.nextUrl.searchParams.get('numero') || '').trim()
    const itemId = String(req.nextUrl.searchParams.get('itemId') || '').trim()
    const formulaId = String(req.nextUrl.searchParams.get('formulaId') || '').trim() || undefined
    const opcoesInformadas = opcoesDaUrl(req)
    if (!numero) return NextResponse.json({ error: 'Informe o número do orçamento/pedido W.Vetro.' }, { status: 400 })

    const sql = neonStaging()
    const rows = await sql`
      select recurso, chave_externa_canonica as chave, payload
      from wvetro_migracao.raw_canonico
      where recurso in ('orcamentos','pedidos')
        and payload->>'Nro' = ${numero}
      order by case when recurso='orcamentos' then 0 else 1 end
      limit 1
    `
    const registro = rows[0] as any
    if (!registro) return NextResponse.json({ error: 'Registro W.Vetro não encontrado no staging.' }, { status: 404 })

    const itens = itensDoPayload(registro.payload)
    const item = itemId ? itens.find((x: any) => String(x.Id || '') === itemId) : itens[0]
    if (!item) return NextResponse.json({ error: 'Item técnico não encontrado neste registro.' }, { status: 404 })

    const carregada = await carregarFormula(item, formulaId)
    const avaliacao = formulaId
      ? {
          melhor: {
            row: carregada.formulaBanco,
            formula: carregada.formula,
            inferencia: inferirOpcoesTecnicasWVetro(item, carregada.formula, opcoesInformadas),
            resultado: null as ReturnType<typeof compararItemWVetroComFormulaAtlas> | null,
            score: 0,
          },
          ranking: [] as Array<Record<string, unknown>>,
        }
      : escolherMelhorFormula(item, carregada.formulasBanco || [carregada.formulaBanco], opcoesInformadas)

    if (!avaliacao.melhor.resultado) {
      avaliacao.melhor.resultado = compararItemWVetroComFormulaAtlas({
        item,
        formula: avaliacao.melhor.formula,
        opcoes: avaliacao.melhor.inferencia.opcoes,
      })
      avaliacao.melhor.score = pontuarResultado(avaliacao.melhor.resultado)
    }

    const formulaEscolhida = avaliacao.melhor.row
    const formulaAtlas = avaliacao.melhor.formula
    const inferencia = avaliacao.melhor.inferencia
    const resultado = avaliacao.melhor.resultado

    return NextResponse.json({
      ok: true,
      modo: 'historico',
      origem: { recurso: registro.recurso, chave: registro.chave, numero },
      resultado,
      referencia: carregada.referencia,
      formula: {
        id: formulaEscolhida.id,
        configuracao_label: formulaEscolhida.configuracao_label,
        status: formulaEscolhida.status,
        ativo: formulaEscolhida.ativo,
        selecionada_por: formulaId ? 'manual' : 'melhor_compatibilidade_historica',
        score: avaliacao.melhor.score,
      },
      rankingFormulas: avaliacao.ranking,
      variaveis: formulaAtlas.variaveis,
      opcoes: inferencia.opcoes,
      inferencias: inferencia.inferencias,
      formulasDisponiveis: carregada.disponiveis,
      itensDisponiveis: itens.map((x: any) => ({
        id: String(x.Id || ''),
        nome: String(x.Nome || ''),
        modelo: String(x.Modelo || ''),
        linha: String(x.Linha || ''),
        largura: Number(x.Largura || 0),
        altura: Number(x.Altura || 0),
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha no comparador técnico.' }, { status: 500 })
  }
}
