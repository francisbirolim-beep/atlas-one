import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type NivelConfiancaEstimativa = 'baixa' | 'media' | 'alta'

export type PedidoEstimativaOrcamento = {
  solicitado: boolean
  tipologia: string | null
  tipologiaRotulo: string | null
  folhas: number | null
  larguraMm: number | null
  alturaMm: number | null
  linha: string | null
  cor: string | null
  reforco: boolean | null
}

export type ExemploEstimativaOrcamento = {
  orcamentoId: string
  numeroWvetro: string | null
  tipologia: string
  folhas: number | null
  linha: string | null
  larguraMm: number | null
  alturaMm: number | null
  valor: number
  valorAjustado: number
  similaridade: number
  reforco: boolean | null
  atualizadoEm: string | null
}

export type CenarioEstimativaOrcamento = {
  quantidade: number
  estimativa: number
  minimo: number
  maximo: number
}

export type EstimativaOrcamentoHistorico = {
  encontrado: boolean
  pedido: PedidoEstimativaOrcamento
  quantidadeValidadaAnalisada: number
  quantidadeComparaveis: number
  estimativa: number | null
  minimo: number | null
  maximo: number | null
  media: number | null
  confianca: NivelConfiancaEstimativa
  confiancaPct: number
  exemplos: ExemploEstimativaOrcamento[]
  comReforco: CenarioEstimativaOrcamento | null
  semReforco: CenarioEstimativaOrcamento | null
  aviso: string
}

type Candidato = ExemploEstimativaOrcamento & {
  familia: string | null
  precoOriginal: number
  areaM2: number | null
}

const NUMEROS_PT: Array<[RegExp, string]> = [
  [/\bdez\b/g, '10'],
  [/\bnove\b/g, '9'],
  [/\boito\b/g, '8'],
  [/\bsete\b/g, '7'],
  [/\bseis\b/g, '6'],
  [/\bcinco\b/g, '5'],
  [/\bquatro\b/g, '4'],
  [/\btres\b/g, '3'],
  [/\bduas\b/g, '2'],
  [/\bdois\b/g, '2'],
  [/\buma\b/g, '1'],
  [/\bum\b/g, '1'],
]

function normalizar(v: unknown) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function numero(v: unknown) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const s = String(v ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  let n = s
  if (n.includes(',') && n.includes('.')) {
    n = n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, '')
  } else if (n.includes(',')) {
    n = n.replace(/\./g, '').replace(',', '.')
  }
  const out = Number(n)
  return Number.isFinite(out) ? out : 0
}

function textoComNumeros(texto: string) {
  let t = normalizar(texto)
  t = t
    .replace(/\b(dez|nove|oito|sete|seis|cinco|quatro|tres|duas|dois|uma|um) e mei[oa]\b/g, m => {
      const base = NUMEROS_PT.reduce((acc, [rx, valor]) => acc.replace(rx, valor), normalizar(m))
      const n = Number(base.match(/\d+/)?.[0] || 0)
      return n > 0 ? String(n + 0.5).replace('.', ',') : m
    })
  for (const [rx, valor] of NUMEROS_PT) t = t.replace(rx, valor)
  return t
}

function converterMedida(valor: number, unidade?: string | null) {
  if (!Number.isFinite(valor) || valor <= 0) return null
  const u = normalizar(unidade || '')
  if (u === 'mm' || u.includes('milimet')) return Math.round(valor)
  if (u === 'm' || u.includes('metro')) return Math.round(valor * 1000)
  return Math.round(valor <= 20 ? valor * 1000 : valor)
}

function extrairMedidas(texto: string) {
  const t = textoComNumeros(texto)
  const padroes = [
    /(\d+(?:[.,]\d+)?)\s*(mm|m|metro|metros)?\s*(?:de\s+)?(?:largura\s*)?(?:x|por)\s*(\d+(?:[.,]\d+)?)\s*(mm|m|metro|metros)?\s*(?:de\s+)?(?:altura)?/,
    /largura\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(mm|m|metro|metros)?[^\d]{0,20}altura\s*(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(mm|m|metro|metros)?/,
  ]
  for (const rx of padroes) {
    const m = t.match(rx)
    if (!m) continue
    const largura = numero(m[1])
    const altura = numero(m[3])
    return {
      larguraMm: converterMedida(largura, m[2]),
      alturaMm: converterMedida(altura, m[4]),
    }
  }
  return { larguraMm: null, alturaMm: null }
}

function familiaTipologia(texto: unknown) {
  const t = normalizar(texto)
  if (/porta.*correr|correr.*porta/.test(t)) return 'porta_correr'
  if (/janela.*correr|vitro.*correr|correr.*janela/.test(t)) return 'janela_correr'
  if (/porta.*pivot|pivotante/.test(t)) return 'porta_pivotante'
  if (/porta.*giro|giro.*porta/.test(t)) return 'porta_giro'
  if (/porta.*balcao|balcao.*porta/.test(t)) return 'porta_balcao'
  if (/maxi.?ar|maxim.?ar/.test(t)) return 'maxi_ar'
  if (/veneziana/.test(t)) return 'veneziana'
  if (/basculante/.test(t)) return 'basculante'
  if (/tela.*mosquit|mosquit.*tela/.test(t)) return 'tela_mosquiteiro'
  if (/guarda.?corpo/.test(t)) return 'guarda_corpo'
  if (/ripado|lambri/.test(t)) return 'ripado'
  if (/quadro.*fixo|fixo/.test(t)) return 'fixo'
  return null
}

function rotuloFamilia(familia: string | null) {
  const mapa: Record<string, string> = {
    porta_correr: 'porta de correr',
    janela_correr: 'janela de correr',
    porta_pivotante: 'porta pivotante',
    porta_giro: 'porta de giro',
    porta_balcao: 'porta balcão',
    maxi_ar: 'maxi-ar',
    veneziana: 'veneziana',
    basculante: 'basculante',
    tela_mosquiteiro: 'tela mosquiteiro',
    guarda_corpo: 'guarda-corpo',
    ripado: 'ripado/lambri',
    fixo: 'quadro fixo',
  }
  return familia ? mapa[familia] || familia.replace(/_/g, ' ') : null
}

function extrairFolhas(texto: string) {
  const t = textoComNumeros(texto)
  const m = t.match(/\b(\d{1,2})\s*(?:folhas?|f)\b/)
  if (m) return Number(m[1])
  return null
}

function extrairLinha(texto: string) {
  const t = normalizar(texto)
  if (/suprema/.test(t)) return 'suprema'
  if (/\bplus\b/.test(t)) return 'plus'
  if (/\bgold\b/.test(t)) return 'gold'
  if (/linha\s*42|\b42\b/.test(t)) return '42'
  return null
}

function extrairCor(texto: string) {
  const t = normalizar(texto)
  for (const cor of ['preto', 'branco', 'imbuia', 'corten', 'linheiro claro', 'marrom avela', 'avela']) {
    if (t.includes(cor)) return cor
  }
  return null
}

function extrairReforco(texto: string) {
  const t = normalizar(texto)
  if (/sem\s+reforc/.test(t)) return false
  if (/com\s+reforc|reforcad/.test(t)) return true
  return null
}

export function detectarConsultaEstimativaOrcamento(texto: string): PedidoEstimativaOrcamento {
  const t = normalizar(texto)
  const familia = familiaTipologia(t)
  const { larguraMm, alturaMm } = extrairMedidas(t)
  const solicitado = Boolean(
    familia &&
    /(quanto|valor|preco|preço|estimativa|media|média|faixa|custa|custaria|fica|ficaria|sai|sairia)/.test(t)
  )
  return {
    solicitado,
    tipologia: familia,
    tipologiaRotulo: rotuloFamilia(familia),
    folhas: extrairFolhas(t),
    larguraMm,
    alturaMm,
    linha: extrairLinha(t),
    cor: extrairCor(t),
    reforco: extrairReforco(t),
  }
}

function valorItem(item: any, orcamento: any, totalItens: number) {
  const total = numero(item?.preco_total)
  if (total > 0) return total

  const wv = item?.wvetro_item || {}
  const alterado = numero(wv?.ValorTotalAlterado)
  if (alterado > 0) return alterado

  const valorWv = numero(wv?.ValorTotal)
  if (valorWv > 0) return valorWv

  const unit = numero(item?.preco_unit)
  const qtd = Math.max(1, numero(item?.quantidade) || 1)
  if (unit > 0) return unit * qtd

  const geral = numero(orcamento?.valor_estimado)
  if (geral > 0 && totalItens === 1) return geral
  return 0
}

function folhasItem(item: any) {
  const direto = numero(item?.folhas || item?.variaveis?.folhas)
  if (direto > 0) return Math.round(direto)
  return extrairFolhas([
    item?.tipo_esquadria,
    item?.configuracao_nome,
    item?.descricao,
    item?.wvetro_item?.Modelo,
    item?.wvetro_item?.Nome,
  ].filter(Boolean).join(' '))
}

function reforcoItem(item: any): boolean | null {
  const vars = item?.variaveis && typeof item.variaveis === 'object' ? item.variaveis : {}
  for (const [chave, valor] of Object.entries(vars)) {
    if (!/reforc/.test(normalizar(chave))) continue
    const v = normalizar(valor)
    if (!v || /^(nao|sem|false|0|null|nenhum)$/.test(v)) return false
    return true
  }

  const perfis = Array.isArray(item?.wvetro_composicao?.perfis) ? item.wvetro_composicao.perfis : []
  const temPerfilReforco = perfis.some((p: any) => /reforc/.test(normalizar(p?.Nome || p?.nome)))
  if (temPerfilReforco) return true

  const texto = normalizar([item?.descricao, item?.configuracao_nome].filter(Boolean).join(' '))
  if (/sem\s+reforc/.test(texto)) return false
  if (/reforc/.test(texto)) return true
  return null
}

function linhaItem(item: any) {
  const direto = normalizar(item?.linha_nome || item?.wvetro_item?.Linha || item?.referencia_wvetro?.linha)
  if (direto.includes('suprema')) return 'suprema'
  if (direto.includes('plus')) return 'plus'
  if (direto.includes('gold')) return 'gold'
  if (/\b42\b/.test(direto)) return '42'
  return direto || null
}

function corItem(item: any, orcamento: any) {
  const direto = normalizar(item?.cor || item?.wvetro_item?.Perfil?.[0]?.Cor || orcamento?.acabamento)
  if (!direto) return null
  if (direto.includes('preto')) return 'preto'
  if (direto.includes('branco')) return 'branco'
  if (direto.includes('imbuia')) return 'imbuia'
  if (direto.includes('corten')) return 'corten'
  if (direto.includes('linheiro')) return 'linheiro claro'
  if (direto.includes('avela')) return 'avela'
  return direto
}

function similaridadeDimensoes(pedido: PedidoEstimativaOrcamento, larguraMm: number | null, alturaMm: number | null) {
  if (!pedido.larguraMm || !pedido.alturaMm || !larguraMm || !alturaMm) return 10
  const erroL = Math.abs(larguraMm - pedido.larguraMm) / pedido.larguraMm
  const erroA = Math.abs(alturaMm - pedido.alturaMm) / pedido.alturaMm
  const erro = (erroL + erroA) / 2
  return Math.max(0, 30 * (1 - Math.min(1, erro / 0.55)))
}

function ajustarValorPorArea(valor: number, pedido: PedidoEstimativaOrcamento, larguraMm: number | null, alturaMm: number | null) {
  if (!pedido.larguraMm || !pedido.alturaMm || !larguraMm || !alturaMm) return valor
  const areaAlvo = (pedido.larguraMm * pedido.alturaMm) / 1_000_000
  const areaBase = (larguraMm * alturaMm) / 1_000_000
  if (areaAlvo <= 0 || areaBase <= 0) return valor
  const razao = Math.max(0.55, Math.min(1.8, areaAlvo / areaBase))
  return valor * Math.pow(razao, 0.85)
}

function pontuar(pedido: PedidoEstimativaOrcamento, item: any, orcamento: any) {
  const textoTipo = [
    item?.tipo_esquadria,
    item?.configuracao_nome,
    item?.descricao,
    item?.wvetro_item?.Modelo,
    item?.wvetro_item?.Nome,
  ].filter(Boolean).join(' ')
  const familia = familiaTipologia(textoTipo)
  if (pedido.tipologia && familia !== pedido.tipologia) return null

  const folhas = folhasItem(item)
  if (pedido.folhas && folhas && pedido.folhas !== folhas) return null

  const larguraMm = numero(item?.largura_mm || item?.wvetro_item?.Largura || orcamento?.largura_mm) || null
  const alturaMm = numero(item?.altura_mm || item?.wvetro_item?.Altura || orcamento?.altura_mm) || null
  const linha = linhaItem(item)
  const cor = corItem(item, orcamento)
  const reforco = reforcoItem(item)

  let score = 45
  if (pedido.folhas && folhas === pedido.folhas) score += 18
  else if (!pedido.folhas && folhas) score += 5

  score += similaridadeDimensoes(pedido, larguraMm, alturaMm)

  if (pedido.linha) {
    score += linha === pedido.linha ? 8 : -6
  }
  if (pedido.cor) {
    score += cor === pedido.cor ? 5 : -2
  }
  if (pedido.reforco !== null) {
    if (reforco === pedido.reforco) score += 7
    else if (reforco !== null) score -= 8
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    familia,
    folhas,
    larguraMm,
    alturaMm,
    linha,
    cor,
    reforco,
  }
}

function quantil(valores: number[], p: number) {
  if (!valores.length) return 0
  const a = [...valores].sort((x, y) => x - y)
  const pos = (a.length - 1) * Math.max(0, Math.min(1, p))
  const base = Math.floor(pos)
  const resto = pos - base
  return a[base + 1] !== undefined ? a[base] + resto * (a[base + 1] - a[base]) : a[base]
}

function mediaPonderada(itens: Candidato[]) {
  const somaPesos = itens.reduce((s, i) => s + Math.max(1, i.similaridade), 0)
  if (!somaPesos) return 0
  return itens.reduce((s, i) => s + i.valorAjustado * Math.max(1, i.similaridade), 0) / somaPesos
}

function resumoCenario(itens: Candidato[]): CenarioEstimativaOrcamento | null {
  if (itens.length < 2) return null
  const melhores = [...itens].sort((a, b) => b.similaridade - a.similaridade).slice(0, 12)
  const valores = melhores.map(i => i.valorAjustado)
  return {
    quantidade: melhores.length,
    estimativa: mediaPonderada(melhores),
    minimo: melhores.length >= 5 ? quantil(valores, 0.2) : Math.min(...valores),
    maximo: melhores.length >= 5 ? quantil(valores, 0.8) : Math.max(...valores),
  }
}

function confianca(itens: Candidato[]) {
  if (!itens.length) return { nivel: 'baixa' as NivelConfiancaEstimativa, pct: 0 }
  const similaridadeMedia = itens.reduce((s, i) => s + i.similaridade, 0) / itens.length
  const valores = itens.map(i => i.valorAjustado)
  const media = valores.reduce((s, v) => s + v, 0) / valores.length
  const desvio = Math.sqrt(valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / valores.length)
  const dispersao = media > 0 ? Math.min(1, desvio / media) : 1
  const fatorN = Math.min(1, itens.length / 8)
  const fatorSimilaridade = Math.min(1, similaridadeMedia / 90)
  const fatorDispersao = Math.max(0, 1 - dispersao)
  const pct = Math.round(100 * (0.35 * fatorN + 0.45 * fatorSimilaridade + 0.20 * fatorDispersao))
  return {
    nivel: pct >= 78 ? 'alta' as const : pct >= 55 ? 'media' as const : 'baixa' as const,
    pct,
  }
}

export async function estimarOrcamentoHistorico(params: {
  empresaId: string
  pergunta: string
}): Promise<EstimativaOrcamentoHistorico | null> {
  const pedido = detectarConsultaEstimativaOrcamento(params.pergunta)
  if (!pedido.solicitado) return null

  const { data, error } = await supabaseAdmin
    .from('orcamentos')
    .select('id,numero,valor_estimado,tipo_esquadria,largura_mm,altura_mm,quantidade,acabamento,itens,wvetro_fluxo,updated_at')
    .eq('empresa_id', params.empresaId)
    .neq('modo_entrada', 'wvetro_api_vinculado')
    .order('updated_at', { ascending: false })
    .limit(600)

  if (error) {
    return {
      encontrado: false,
      pedido,
      quantidadeValidadaAnalisada: 0,
      quantidadeComparaveis: 0,
      estimativa: null,
      minimo: null,
      maximo: null,
      media: null,
      confianca: 'baixa',
      confiancaPct: 0,
      exemplos: [],
      comReforco: null,
      semReforco: null,
      aviso: 'Não foi possível consultar o histórico validado agora.',
    }
  }

  const validados = (data || []).filter((o: any) => {
    const fluxo = o?.wvetro_fluxo && typeof o.wvetro_fluxo === 'object' ? o.wvetro_fluxo : {}
    return normalizar(fluxo?.origem).includes('wvetro') && normalizar(fluxo?.validacao_status) === 'validado'
  })

  const candidatos: Candidato[] = []
  for (const orcamento of validados as any[]) {
    const itens = Array.isArray(orcamento?.itens) ? orcamento.itens : []
    for (const item of itens) {
      const pontos = pontuar(pedido, item, orcamento)
      if (!pontos || pontos.score < 48) continue
      const valor = valorItem(item, orcamento, itens.length)
      if (!(valor > 0)) continue
      const valorAjustado = ajustarValorPorArea(valor, pedido, pontos.larguraMm, pontos.alturaMm)
      candidatos.push({
        orcamentoId: String(orcamento.id),
        numeroWvetro: String(orcamento?.wvetro_fluxo?.numero || '').trim() || null,
        tipologia: String(item?.configuracao_nome || item?.descricao || item?.tipo_esquadria || pedido.tipologiaRotulo || 'Esquadria'),
        folhas: pontos.folhas,
        linha: pontos.linha,
        larguraMm: pontos.larguraMm,
        alturaMm: pontos.alturaMm,
        valor,
        valorAjustado,
        similaridade: Math.round(pontos.score),
        reforco: pontos.reforco,
        atualizadoEm: orcamento.updated_at || null,
        familia: pontos.familia,
        precoOriginal: valor,
        areaM2: pontos.larguraMm && pontos.alturaMm ? (pontos.larguraMm * pontos.alturaMm) / 1_000_000 : null,
      })
    }
  }

  const melhores = candidatos
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, 14)

  if (!melhores.length) {
    return {
      encontrado: false,
      pedido,
      quantidadeValidadaAnalisada: validados.length,
      quantidadeComparaveis: 0,
      estimativa: null,
      minimo: null,
      maximo: null,
      media: null,
      confianca: 'baixa',
      confiancaPct: 0,
      exemplos: [],
      comReforco: null,
      semReforco: null,
      aviso: 'Ainda não há orçamentos W.Vetro validados suficientemente parecidos para formar uma estimativa confiável.',
    }
  }

  const valores = melhores.map(i => i.valorAjustado)
  const media = mediaPonderada(melhores)
  const minimo = melhores.length >= 5 ? quantil(valores, 0.2) : Math.min(...valores)
  const maximo = melhores.length >= 5 ? quantil(valores, 0.8) : Math.max(...valores)
  const conf = confianca(melhores)

  return {
    encontrado: true,
    pedido,
    quantidadeValidadaAnalisada: validados.length,
    quantidadeComparaveis: melhores.length,
    estimativa: media,
    minimo,
    maximo,
    media,
    confianca: conf.nivel,
    confiancaPct: conf.pct,
    exemplos: melhores.slice(0, 5).map(({ familia, precoOriginal, areaM2, ...resto }) => resto),
    comReforco: resumoCenario(melhores.filter(i => i.reforco === true)),
    semReforco: resumoCenario(melhores.filter(i => i.reforco === false)),
    aviso: 'Estimativa histórica baseada apenas em orçamentos W.Vetro validados. Não substitui o orçamento oficial nem o cálculo do MEE.',
  }
}

function moeda(v: number | null) {
  if (v === null || !Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function formatarEstimativaOrcamento(resultado: EstimativaOrcamentoHistorico) {
  const p = resultado.pedido
  const descricao = [
    p.tipologiaRotulo || 'esquadria',
    p.folhas ? p.folhas + ' folhas' : '',
    p.linha ? 'linha ' + p.linha : '',
    p.larguraMm && p.alturaMm ? `${(p.larguraMm / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} x ${(p.alturaMm / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m` : '',
  ].filter(Boolean).join(', ')

  if (!resultado.encontrado || !resultado.estimativa) {
    return [
      `Para ${descricao}, ainda não tenho histórico validado suficiente para informar um valor com segurança.`,
      `Analisei ${resultado.quantidadeValidadaAnalisada} orçamento(s) W.Vetro validado(s), mas nenhum ficou suficientemente comparável.`,
      'Posso usar essa informação assim que tivermos mais exemplos validados. Não vou inventar preço.',
    ].join('\n')
  }

  const linhas = [
    `Estimativa para ${descricao}: aproximadamente **${moeda(resultado.estimativa)}**.`,
    `Faixa histórica comparável: **${moeda(resultado.minimo)} a ${moeda(resultado.maximo)}**.`,
    `Base: ${resultado.quantidadeComparaveis} referência(s) semelhante(s) entre ${resultado.quantidadeValidadaAnalisada} orçamento(s) W.Vetro validados. Confiança: **${resultado.confianca} (${resultado.confiancaPct}%)**.`,
  ]

  if (resultado.semReforco && resultado.comReforco) {
    linhas.push(
      `Sem reforço: cerca de **${moeda(resultado.semReforco.estimativa)}** (faixa ${moeda(resultado.semReforco.minimo)} a ${moeda(resultado.semReforco.maximo)}).`,
      `Com reforço: cerca de **${moeda(resultado.comReforco.estimativa)}** (faixa ${moeda(resultado.comReforco.minimo)} a ${moeda(resultado.comReforco.maximo)}).`,
    )
  } else if (p.reforco !== null) {
    linhas.push('Ainda não há exemplos suficientes nos dois cenários para comparar com e sem reforço separadamente.')
  }

  const refs = resultado.exemplos.slice(0, 3).map((e, i) => {
    const medida = e.larguraMm && e.alturaMm ? ` · ${e.larguraMm} x ${e.alturaMm} mm` : ''
    return `${i + 1}. W.Vetro #${e.numeroWvetro || '—'}${medida} · ${moeda(e.valor)} · similaridade ${e.similaridade}%`
  })
  if (refs.length) linhas.push('Referências mais próximas:\n' + refs.join('\n'))

  linhas.push('É uma estimativa histórica para consulta rápida; o valor oficial continua sendo calculado no orçamento/MEE com a configuração completa.')
  return linhas.join('\n\n')
}
