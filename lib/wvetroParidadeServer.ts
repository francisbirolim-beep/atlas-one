import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { calcularFormulasCorte, calcularVidroFormula, type OpcoesEscolhidas, type ResultadoPeca, type TipologiaFormulasCorte } from '@/lib/formulasCorteEngine'
import { calcularAcessoriosTecnicos } from '@/lib/formulasAcessoriosEngine'
import type { AcessorioFormulaCorte, VidroFormulaCorte } from '@/lib/engenhariaFormulasCorte'

type FormulaBanco = TipologiaFormulasCorte & {
  id: string
  status: string
  ativo: boolean
  versao: number
  configuracao_chave: string | null
  configuracao_label: string | null
  vidro: VidroFormulaCorte | null
  acessorios: AcessorioFormulaCorte[] | null
}

type Referencia = {
  id: string
  linha_raw: string
  modelo_raw: string
  tipologia_atlas_id: string | null
  ocorrencias: number
  primeiro_visto: string | null
  ultimo_visto: string | null
  status_mapeamento: string
  largura_min_mm: number | string | null
  largura_max_mm: number | string | null
  altura_min_mm: number | string | null
  altura_max_mm: number | string | null
}

type ComponenteWVetro = {
  id: string
  tipo: 'perfil' | 'acessorio' | 'vidro' | string
  codigo: string | null
  codigo_wvetro: string | null
  nome: string | null
  cor: string | null
  produto_atlas_id: string | null
  ocorrencias: number
  quantidade_min: number | string | null
  quantidade_max: number | string | null
  medida_min: number | string | null
  medida_max: number | string | null
  unidade: string | null
  posicoes: string[] | null
  cortes: string[] | null
}


function tabelaParidadeAusente(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string }
  const texto = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return e.code === '42P01'
    || e.code === 'PGRST205'
    || (texto.includes('wvetro_tipologia_casos') && (texto.includes('schema cache') || texto.includes('does not exist') || texto.includes('could not find')))
}

function n(v: unknown): number | null {
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

function codigo(v: unknown) {
  return String(v ?? '').trim().toUpperCase()
}

function folhasDoModelo(modelo: string) {
  const m = modelo.match(/(\d{1,2})\s*folhas?/i)
  return m ? Math.max(1, Number(m[1])) : 1
}

function faixa(v: number, min: number | null, max: number | null) {
  if (min === null && max === null) return null
  const a = min ?? max!
  const b = max ?? min!
  return v >= a - 0.5 && v <= b + 0.5
}

function medidasHistoricasMm(c: ComponenteWVetro) {
  const min = n(c.medida_min)
  const max = n(c.medida_max)
  if (min === null && max === null) return { min: null, max: null }
  // Os relatórios W.Vetro preservados nesta base trazem comprimentos de perfil em metros.
  return {
    min: min === null ? null : min * 1000,
    max: max === null ? null : max * 1000,
  }
}

type CasoIndividual = {
  id: string
  fonte: string
  documento_chave: string
  item_indice: number
  data_referencia: string | null
  item_codigo: string | null
  item_nome: string | null
  largura_mm: number | string | null
  altura_mm: number | string | null
  quantidade: number | string | null
  perfis: unknown
  acessorios: unknown
  vidros: unknown
  variaveis_observadas: unknown
}

function rawObjeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
}

function rawLista(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(rawObjeto).filter((x): x is Record<string, unknown> => Boolean(x)) : []
}

function rawCodigo(o: Record<string, unknown>) {
  for (const valor of [o.SeuCodigo, o.seuCodigo, o.Codigo, o.codigo]) {
    const c = codigo(valor)
    if (c) return c
  }
  return ''
}

function rawQuantidade(o: Record<string, unknown>) {
  return n(o.Qtde ?? o.qtde ?? o.Quantidade ?? o.quantidade)
}

function rawMedidaMm(o: Record<string, unknown>) {
  const medida = n(o.Medida ?? o.medida)
  return medida === null ? null : medida * 1000
}

function rawPosicao(o: Record<string, unknown>) {
  return codigo(o.Posicao ?? o.posicao ?? o.Lado ?? o.lado)
}

function opcoesObservadas(caso: CasoIndividual) {
  return rawObjeto(caso.variaveis_observadas) || {}
}

function compatibilidadeOpcoes(caso: CasoIndividual, opcoes: OpcoesEscolhidas) {
  const observadas = opcoesObservadas(caso)
  let compatíveis = 0
  let conflitos = 0
  for (const [chave, escolhido] of Object.entries(opcoes)) {
    if (!escolhido) continue
    const observado = observadas[chave]
    if (observado === undefined || observado === null || String(observado) === '' || String(observado) === 'nao_identificado') continue
    if (String(observado) === String(escolhido)) compatíveis += 1
    else conflitos += 1
  }
  return { compatíveis, conflitos }
}

function melhorCaso(casos: CasoIndividual[], perfis: ResultadoPeca[], opcoes: OpcoesEscolhidas) {
  if (!casos.length) return null
  const esperados = new Set(perfis.map(p => codigo(p.codigo)).filter(Boolean))
  const avaliados = casos.map(caso => {
    const observados = new Set(rawLista(caso.perfis).map(rawCodigo).filter(Boolean))
    let comuns = 0
    esperados.forEach(c => { if (observados.has(c)) comuns += 1 })
    const cobertura = esperados.size ? comuns / esperados.size : 0
    const { compatíveis, conflitos } = compatibilidadeOpcoes(caso, opcoes)
    // Um conflito explícito de configuração pesa mais que a simples sobreposição
    // de perfis. Isso evita escolher, por exemplo, um caso com contramarco para
    // comparar uma configuração sem contramarco só porque largura/altura coincidem.
    const score = cobertura * 100 + compatíveis * 20 - conflitos * 250
    return { caso, score, comuns, conflitos, compatíveis }
  })
  return avaliados
    .sort((a, b) => a.conflitos - b.conflitos || b.score - a.score || b.comuns - a.comuns)[0]?.caso || null
}

function perfilNoCaso(resultado: ResultadoPeca, caso: CasoIndividual | null) {
  if (!caso) return {
    casoEncontrado: false,
    medidasCasoMm: [] as number[],
    quantidadesCaso: [] as number[],
    corteBateCaso: null as boolean | null,
    quantidadeBateCaso: null as boolean | null,
  }
  const codigoEsperado = codigo(resultado.codigo)
  let candidatos = rawLista(caso.perfis).filter(o => rawCodigo(o) === codigoEsperado)
  const eixo = codigo(resultado.eixo)
  if (eixo) {
    const porEixo = candidatos.filter(o => rawPosicao(o) === eixo)
    if (porEixo.length) candidatos = porEixo
  }
  const medidas = candidatos.map(rawMedidaMm).filter((x): x is number => x !== null)
  const quantidades = candidatos.map(rawQuantidade).filter((x): x is number => x !== null)
  const quantidadeEsperada = Number(resultado.quantidade || 1)
  return {
    casoEncontrado: candidatos.length > 0,
    medidasCasoMm: medidas,
    quantidadesCaso: quantidades,
    corteBateCaso: medidas.length ? medidas.some(m => Math.abs(m - resultado.tamanho) <= 1) : null,
    quantidadeBateCaso: quantidades.length ? quantidades.some(q => Math.abs(q - quantidadeEsperada) <= 0.001) : null,
  }
}

function vidroNoCaso(
  quantidadeAtlas: number,
  larguraAtlasMm: number | null,
  alturaAtlasMm: number | null,
  caso: CasoIndividual | null,
) {
  const candidatos = caso ? rawLista(caso.vidros) : []
  const observados = candidatos.map(o => ({
    codigo: rawCodigo(o),
    larguraMm: n(o.Largura ?? o.largura),
    alturaMm: n(o.Altura ?? o.altura),
    quantidade: rawQuantidade(o),
    especificacao: String(o.Especificacao ?? o.especificacao ?? o.Nome ?? o.nome ?? '').trim(),
  }))
  const bate = quantidadeAtlas <= 0
    ? null
    : observados.some(v =>
        v.larguraMm !== null
        && v.alturaMm !== null
        && v.quantidade !== null
        && larguraAtlasMm !== null
        && alturaAtlasMm !== null
        && Math.abs(v.larguraMm - larguraAtlasMm) <= 1
        && Math.abs(v.alturaMm - alturaAtlasMm) <= 1
        && Math.abs(v.quantidade - quantidadeAtlas) <= 0.001
      )
  return {
    casoEncontrado: observados.length > 0,
    observados,
    bateCaso: bate,
  }
}

function acessorioNoCaso(codigoAcessorio: string, valor: number | null, caso: CasoIndividual | null) {
  if (!caso) return {
    casoEncontrado: false,
    quantidadesCaso: [] as number[],
    quantidadeBateCaso: null as boolean | null,
  }
  const candidatos = rawLista(caso.acessorios).filter(o => rawCodigo(o) === codigo(codigoAcessorio))
  const quantidades = candidatos.map(rawQuantidade).filter((x): x is number => x !== null)
  return {
    casoEncontrado: candidatos.length > 0,
    quantidadesCaso: quantidades,
    quantidadeBateCaso: valor === null || !quantidades.length
      ? null
      : quantidades.some(q => Math.abs(q - valor) <= 0.001),
  }
}

function resumirPerfil(resultado: ResultadoPeca, componentes: ComponenteWVetro[]) {
  const candidatos = componentes.filter(c => c.tipo === 'perfil' && codigo(c.codigo_wvetro || c.codigo) === codigo(resultado.codigo))
  const faixas = candidatos.map(medidasHistoricasMm)
  const min = faixas.map(x => x.min).filter((x): x is number => x !== null)
  const max = faixas.map(x => x.max).filter((x): x is number => x !== null)
  const histMin = min.length ? Math.min(...min) : null
  const histMax = max.length ? Math.max(...max) : null
  return {
    codigo: resultado.codigo,
    descricao: resultado.descricao || candidatos[0]?.nome || '',
    eixo: resultado.eixo || null,
    quantidadeAtlas: Number(resultado.quantidade || 1),
    corteAtlasMm: Number(resultado.tamanho.toFixed(3)),
    encontradoWVetro: candidatos.length > 0,
    ocorrenciasWVetro: candidatos.reduce((s, c) => s + Number(c.ocorrencias || 0), 0),
    medidaHistoricaMinMm: histMin,
    medidaHistoricaMaxMm: histMax,
    corteDentroFaixaHistorica: faixa(resultado.tamanho, histMin, histMax),
    cortesObservados: Array.from(new Set(candidatos.flatMap(c => c.cortes || []))),
  }
}

function resumirAcessorio(item: AcessorioFormulaCorte, valor: number | null, calculo: string, erro: string | undefined, componentes: ComponenteWVetro[]) {
  const candidatos = componentes.filter(c => c.tipo === 'acessorio' && codigo(c.codigo_wvetro || c.codigo) === codigo(item.codigo))
  const mins = candidatos.map(c => n(c.quantidade_min)).filter((x): x is number => x !== null)
  const maxs = candidatos.map(c => n(c.quantidade_max)).filter((x): x is number => x !== null)
  const min = mins.length ? Math.min(...mins) : null
  const max = maxs.length ? Math.max(...maxs) : null
  return {
    codigo: item.codigo,
    descricao: item.descricao || candidatos[0]?.nome || '',
    statusFormula: item.status || 'referencia',
    valorAtlas: valor,
    calculo,
    erro: erro || null,
    encontradoWVetro: candidatos.length > 0,
    ocorrenciasWVetro: candidatos.reduce((s, c) => s + Number(c.ocorrencias || 0), 0),
    quantidadeHistoricaMin: min,
    quantidadeHistoricaMax: max,
    quantidadeDentroFaixaHistorica: valor === null ? null : faixa(valor, min, max),
  }
}

export async function listarParidadeWVetro(filtro = 'correr') {
  let query = supabaseAdmin
    .from('wvetro_referencias_tipologias')
    .select('id,linha_raw,modelo_raw,tipologia_atlas_id,ocorrencias,primeiro_visto,ultimo_visto,status_mapeamento,largura_min_mm,largura_max_mm,altura_min_mm,altura_max_mm')
    .not('tipologia_atlas_id', 'is', null)
    .order('linha_raw')
    .order('modelo_raw')

  if (filtro) query = query.ilike('modelo_raw', `%${filtro}%`)
  const { data: refs, error } = await query
  if (error) throw error

  const ids = (refs || []).map(r => r.id)
  const tipIds = (refs || []).map(r => r.tipologia_atlas_id).filter(Boolean)
  const [componentesResp, formulasResp, tipologiasResp, casosResp] = await Promise.all([
    ids.length
      ? supabaseAdmin.from('wvetro_tipologia_componentes').select('referencia_tipologia_id,tipo').in('referencia_tipologia_id', ids)
      : Promise.resolve({ data: [], error: null }),
    tipIds.length
      ? supabaseAdmin.from('engenharia_tipologia_formulas_corte').select('id,tipologia_id,status,ativo,versao,configuracao_label,variaveis').in('tipologia_id', tipIds).eq('ativo', true)
      : Promise.resolve({ data: [], error: null }),
    tipIds.length
      ? supabaseAdmin.from('tipologias').select('id,label').in('id', tipIds)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabaseAdmin.from('wvetro_tipologia_casos').select('referencia_tipologia_id').in('referencia_tipologia_id', ids)
      : Promise.resolve({ data: [], error: null }),
  ])
  const erroBase = componentesResp.error || formulasResp.error || tipologiasResp.error
  if (erroBase) throw erroBase
  if (casosResp.error && !tabelaParidadeAusente(casosResp.error)) throw casosResp.error

  const componentes = componentesResp.data || []
  const formulas = formulasResp.data || []
  const casos = casosResp.error ? [] : (casosResp.data || [])
  const tipologias = new Map((tipologiasResp.data || []).map(t => [t.id, t.label]))

  return (refs || []).map((r: Referencia) => {
    const comps = componentes.filter((c: any) => c.referencia_tipologia_id === r.id)
    const formula = formulas.find((f: any) => f.tipologia_id === r.tipologia_atlas_id) || null
    return {
      ...r,
      tipologiaAtlasLabel: r.tipologia_atlas_id ? tipologias.get(r.tipologia_atlas_id) || null : null,
      componentes: {
        total: comps.length,
        perfis: comps.filter((c: any) => c.tipo === 'perfil').length,
        acessorios: comps.filter((c: any) => c.tipo === 'acessorio').length,
        vidros: comps.filter((c: any) => c.tipo === 'vidro').length,
      },
      casosIndividuais: casos.filter((c: any) => c.referencia_tipologia_id === r.id).length,
      formula: formula ? {
        id: formula.id,
        status: formula.status,
        ativo: formula.ativo,
        versao: formula.versao,
        configuracaoLabel: formula.configuracao_label,
        variaveis: Array.isArray(formula.variaveis) ? formula.variaveis : [],
      } : null,
      nivel: !formula ? 'sem_formula' : formula.status === 'validada' ? 'formula_validada' : 'formula_em_validacao',
    }
  })
}

export async function compararParidadeWVetro(params: {
  referenciaId: string
  largura: number
  altura: number
  opcoes?: OpcoesEscolhidas
}) {
  const [
    { data: ref, error: refError },
    { data: componentes, error: compError },
    { data: casosMesmaMedida, error: casosError },
  ] = await Promise.all([
    supabaseAdmin
      .from('wvetro_referencias_tipologias')
      .select('id,linha_raw,modelo_raw,tipologia_atlas_id,ocorrencias,primeiro_visto,ultimo_visto,status_mapeamento,largura_min_mm,largura_max_mm,altura_min_mm,altura_max_mm')
      .eq('id', params.referenciaId)
      .single(),
    supabaseAdmin
      .from('wvetro_tipologia_componentes')
      .select('id,tipo,codigo,codigo_wvetro,nome,cor,produto_atlas_id,ocorrencias,quantidade_min,quantidade_max,medida_min,medida_max,unidade,posicoes,cortes')
      .eq('referencia_tipologia_id', params.referenciaId),
    supabaseAdmin
      .from('wvetro_tipologia_casos')
      .select('id,fonte,documento_chave,item_indice,data_referencia,item_codigo,item_nome,largura_mm,altura_mm,quantidade,perfis,acessorios,vidros,variaveis_observadas')
      .eq('referencia_tipologia_id', params.referenciaId)
      .eq('largura_mm', params.largura)
      .eq('altura_mm', params.altura)
      .order('data_referencia', { ascending: false })
      .limit(20),
  ])
  if (refError) throw refError
  if (compError) throw compError
  if (casosError && !tabelaParidadeAusente(casosError)) throw casosError
  if (!ref?.tipologia_atlas_id) throw new Error('Referência W.Vetro ainda não está ligada a uma tipologia Atlas.')

  const { data: formula, error: formulaError } = await supabaseAdmin
    .from('engenharia_tipologia_formulas_corte')
    .select('id,tipologia_id,variaveis,pecas,status,ativo,versao,configuracao_chave,configuracao_label,vidro,acessorios')
    .eq('tipologia_id', ref.tipologia_atlas_id)
    .eq('ativo', true)
    .order('status', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (formulaError) throw formulaError

  const comp = (componentes || []) as ComponenteWVetro[]
  if (!formula) {
    return {
      referencia: ref,
      formula: null,
      entrada: { largura: params.largura, altura: params.altura, opcoes: params.opcoes || {} },
      componentesWVetro: comp,
      mensagem: 'Há evidência histórica W.Vetro, mas ainda não existe fórmula ativa no Atlas para calcular esta tipologia.',
    }
  }

  const f = formula as unknown as FormulaBanco
  const perfisCalculados = calcularFormulasCorte(f, params.largura, params.altura, params.opcoes || {})
  const caso = melhorCaso((casosError ? [] : (casosMesmaMedida || [])) as unknown as CasoIndividual[], perfisCalculados, params.opcoes || {})
  const perfis = perfisCalculados.map(p => ({
    ...resumirPerfil(p, comp),
    ...perfilNoCaso(p, caso),
  }))
  const folhas = folhasDoModelo(ref.modelo_raw)
  const acessoriosDef = Array.isArray(f.acessorios) ? f.acessorios : []
  const acessoriosCalc = calcularAcessoriosTecnicos(acessoriosDef, params.largura, params.altura, folhas, perfisCalculados)
  const acessorios = acessoriosDef.map((item, index) => {
    const r = acessoriosCalc[index]
    return {
      ...resumirAcessorio(item, r?.valor ?? null, r?.calculo || '', r?.erro, comp),
      ...acessorioNoCaso(item.codigo, r?.valor ?? null, caso),
    }
  })

  const vidroDef = f.vidro || {}
  const vidroCalculado = calcularVidroFormula(
    vidroDef,
    params.largura,
    params.altura,
    params.opcoes || {},
  )
  const quantidadeVidroAtlas = vidroCalculado?.quantidade || 0
  const larguraVidroAtlas = vidroCalculado?.largura ?? null
  const alturaVidroAtlas = vidroCalculado?.altura ?? null
  const vidroCaso = vidroNoCaso(quantidadeVidroAtlas, larguraVidroAtlas, alturaVidroAtlas, caso)
  const vidro = {
    quantidadeAtlas: quantidadeVidroAtlas,
    larguraAtlasMm: larguraVidroAtlas,
    alturaAtlasMm: alturaVidroAtlas,
    ...vidroCaso,
    referenciasWVetro: comp.filter(c => c.tipo === 'vidro').map(c => ({
      nome: c.nome,
      ocorrencias: c.ocorrencias,
      quantidadeMin: n(c.quantidade_min),
      quantidadeMax: n(c.quantidade_max),
      medidaMin: n(c.medida_min),
      medidaMax: n(c.medida_max),
    })),
  }

  const perfisComEvidencia = perfis.filter(p => p.encontradoWVetro).length
  const acessoriosComEvidencia = acessorios.filter(a => a.encontradoWVetro).length
  const acessoriosCalculados = acessorios.filter(a => a.valorAtlas !== null).length
  const perfisNoCaso = perfis.filter(p => p.casoEncontrado).length
  const perfisCorteBatendo = perfis.filter(p => p.corteBateCaso === true).length
  const acessoriosNoCaso = acessorios.filter(a => a.casoEncontrado).length
  const acessoriosCalculadosPositivos = acessorios.filter(a => a.valorAtlas !== null && a.valorAtlas > 0)
  const acessoriosQuantidadeBatendo = acessoriosCalculadosPositivos.filter(a => a.casoEncontrado && a.quantidadeBateCaso === true).length
  const vidroPrecisaComparar = quantidadeVidroAtlas > 0
  const vidroCompatívelComCaso = Boolean(caso)
    && vidroPrecisaComparar === vidro.casoEncontrado
    && (!vidroPrecisaComparar || vidro.bateCaso === true)
  const calculadoBateNoCaso = Boolean(caso)
    && perfis.length > 0
    && perfis.every(p =>
      p.casoEncontrado
      && p.corteBateCaso === true
      && p.quantidadeBateCaso === true
    )
    && acessoriosCalculadosPositivos.every(a => a.casoEncontrado && a.quantidadeBateCaso === true)
    && vidroCompatívelComCaso

  return {
    referencia: ref,
    formula: {
      id: f.id,
      status: f.status,
      ativo: f.ativo,
      versao: f.versao,
      configuracaoChave: f.configuracao_chave,
      configuracaoLabel: f.configuracao_label,
      variaveis: f.variaveis || [],
    },
    entrada: { largura: params.largura, altura: params.altura, opcoes: params.opcoes || {}, folhas },
    cobertura: {
      perfisCalculados: perfis.length,
      perfisComEvidencia,
      acessoriosDefinidos: acessorios.length,
      acessoriosCalculados,
      acessoriosComEvidencia,
      componentesHistoricos: comp.length,
      perfisNoCaso,
      perfisCorteBatendo,
      acessoriosNoCaso,
      acessoriosQuantidadeBatendo,
    },
    casoComparavel: caso ? {
      id: caso.id,
      fonte: caso.fonte,
      documentoChave: caso.documento_chave,
      itemIndice: caso.item_indice,
      dataReferencia: caso.data_referencia,
      itemCodigo: caso.item_codigo,
      itemNome: caso.item_nome,
      largura: n(caso.largura_mm),
      altura: n(caso.altura_mm),
      variaveisObservadas: caso.variaveis_observadas,
      opcoesCompativeis: compatibilidadeOpcoes(caso, params.opcoes || {}),
      calculadoBateNoCaso,
    } : null,
    perfis,
    acessorios,
    vidro,
    aviso: caso
      ? 'Foi encontrado um caso W.Vetro com a mesma largura e altura. O Atlas compara corte e quantidade componente a componente; a configuração ainda deve ser confirmada quando as variáveis observadas estiverem completas.'
      : 'Esta comparação usa evidência histórica agregada do W.Vetro. Faixa histórica não significa paridade exata do mesmo orçamento; a paridade exata depende da captura de ocorrências individuais.',
  }
}