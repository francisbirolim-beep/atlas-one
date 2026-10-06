import { supabaseAdmin } from '@/lib/supabaseAdmin'

type AmostraAprendizadoWVetro = {
  itens: any[]
  numeroWvetro?: string | null
  dataReferencia?: string | null
}

type VariavelObservada = {
  referencia_tipologia_id: string
  tipologia_atlas_id: string | null
  variavel_chave_raw: string
  variavel_label_raw: string
  valor_raw: string
  valor_normalizado: string
  evidencia: string
  dados_origem: Record<string, unknown>
}

function txt(...vs: unknown[]) {
  for (const v of vs) {
    const s = String(v ?? '').replace(/\s+/g, ' ').trim()
    if (s) return s
  }
  return ''
}

function norm(v: unknown) {
  return txt(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function slug(v: unknown) {
  return txt(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 180)
}

function lista(v: unknown): any[] {
  return Array.isArray(v) ? v : []
}

function referenciaId(item: any) {
  return txt(item?.referencia_wvetro?.referencia_id)
}

function tipologiaId(item: any) {
  return txt(item?.tipologia_id || item?.referencia_wvetro?.tipologia_id) || null
}

function nomeItem(item: any) {
  return txt(item?.wvetro_item?.Nome, item?.wvetro_item?.Descricao, item?.descricao, item?.configuracao_nome)
}

function vidrosItem(item: any) {
  const composicao = item?.wvetro_composicao
  if (Array.isArray(composicao?.vidros)) return composicao.vidros
  return lista(item?.wvetro_item?.Vidros)
}

function adicionar(
  destino: VariavelObservada[],
  base: { referenciaId: string; tipologiaId: string | null; evidencia: string; dadosOrigem: Record<string, unknown> },
  chave: string,
  label: string,
  valorRaw: string,
  valorNormalizado?: string,
) {
  const bruto = txt(valorRaw)
  const normalizado = txt(valorNormalizado || slug(bruto))
  if (!base.referenciaId || !bruto || !normalizado) return
  destino.push({
    referencia_tipologia_id: base.referenciaId,
    tipologia_atlas_id: base.tipologiaId,
    variavel_chave_raw: chave,
    variavel_label_raw: label,
    valor_raw: bruto,
    valor_normalizado: normalizado,
    evidencia: base.evidencia,
    dados_origem: base.dadosOrigem,
  })
}

function extrairVariaveis(item: any, numeroWvetro?: string | null, dataReferencia?: string | null) {
  const refId = referenciaId(item)
  if (!refId) return { variaveis: [] as VariavelObservada[], temVidro: false, tipologiaId: tipologiaId(item) }

  const nome = nomeItem(item)
  const nomeNorm = norm(nome)
  const vidros = vidrosItem(item)
  const temVidro = vidros.length > 0
  const numero = txt(numeroWvetro)
  const evidencia = [
    numero ? `Orçamento W.Vetro #${numero}` : 'Orçamento W.Vetro',
    nome ? `item: ${nome}` : '',
  ].filter(Boolean).join(' · ').slice(0, 900)
  const dadosOrigem = {
    fonte: 'orcamento_wvetro',
    numero_wvetro: numero || null,
    data_referencia: txt(dataReferencia) || null,
    nome_item: nome || null,
  }

  const base = { referenciaId: refId, tipologiaId: tipologiaId(item), evidencia, dadosOrigem }
  const variaveis: VariavelObservada[] = []

  const temLambri = /LAMBRI/.test(nomeNorm)
  const temVeneziana = /VENEZIANA/.test(nomeNorm)
  const temRipado = /RIPAD/.test(nomeNorm)

  let preenchimento = ''
  let preenchimentoLabel = ''
  if (temVidro && temVeneziana) {
    preenchimento = 'vidro_veneziana'
    preenchimentoLabel = 'Vidro + veneziana'
  } else if (temVidro) {
    preenchimento = 'vidro'
    preenchimentoLabel = 'Vidro'
  } else if (temLambri) {
    preenchimento = 'lambri'
    preenchimentoLabel = 'Lambri'
  } else if (temVeneziana) {
    preenchimento = 'veneziana'
    preenchimentoLabel = 'Veneziana'
  } else if (temRipado) {
    preenchimento = 'ripado'
    preenchimentoLabel = 'Ripado'
  }
  if (preenchimento) adicionar(variaveis, base, 'preenchimento', 'Preenchimento da folha', preenchimentoLabel, preenchimento)

  if (/COM CONTRAMARCO/.test(nomeNorm)) adicionar(variaveis, base, 'contramarco', 'Contramarco', 'Com contramarco', 'com')
  else if (/SEM CONTRAMARCO/.test(nomeNorm)) adicionar(variaveis, base, 'contramarco', 'Contramarco', 'Sem contramarco', 'sem')

  if (/FECHADURA\s+CONVENC/.test(nomeNorm)) adicionar(variaveis, base, 'fechadura', 'Fechadura', 'Convencional', 'convencional')
  else if (/FECHADURA\s+TRADICIONAL/.test(nomeNorm)) adicionar(variaveis, base, 'fechadura', 'Tradicional', 'Tradicional', 'tradicional')

  if (temLambri) {
    if (/DUPLO/.test(nomeNorm)) adicionar(variaveis, base, 'lambri_tipo', 'Tipo de lambri', 'Duplo', 'duplo')
    else adicionar(variaveis, base, 'lambri_tipo', 'Tipo de lambri', 'Simples', 'simples')
    if (/HORIZONTAL/.test(nomeNorm)) adicionar(variaveis, base, 'lambri_orientacao', 'Orientação do lambri', 'Horizontal', 'horizontal')
    else if (/VERTICAL/.test(nomeNorm)) adicionar(variaveis, base, 'lambri_orientacao', 'Orientação do lambri', 'Vertical', 'vertical')
  }

  if (temVeneziana) {
    if (/VENTILADA/.test(nomeNorm)) adicionar(variaveis, base, 'veneziana_tipo', 'Tipo de veneziana', 'Ventilada', 'ventilada')
    else if (/CEGA/.test(nomeNorm)) adicionar(variaveis, base, 'veneziana_tipo', 'Tipo de veneziana', 'Cega', 'cega')
  }

  if (temVidro) {
    if (/VIDRO SUPERIOR/.test(nomeNorm)) adicionar(variaveis, base, 'vidro_posicao', 'Posição do vidro', 'Superior', 'superior')
    const especificacoes = new Set<string>()
    for (const vidro of vidros) {
      const especificacao = txt(vidro?.Especificacao, vidro?.Descricao, vidro?.Nome)
      if (!especificacao || especificacoes.has(norm(especificacao))) continue
      especificacoes.add(norm(especificacao))
      adicionar(variaveis, base, 'vidro_especificacao', 'Especificação do vidro', especificacao, slug(especificacao))
    }
  }

  return { variaveis, temVidro, tipologiaId: base.tipologiaId }
}

export async function observarAprendizadoTecnicoWVetro(amostras: AmostraAprendizadoWVetro[]) {
  const extraidas: VariavelObservada[] = []
  const tipologiasComVidro = new Set<string>()
  let itensObservados = 0

  for (const amostra of amostras || []) {
    for (const item of amostra.itens || []) {
      if (!referenciaId(item)) continue
      itensObservados += 1
      const extraida = extrairVariaveis(item, amostra.numeroWvetro, amostra.dataReferencia)
      extraidas.push(...extraida.variaveis)
      if (extraida.temVidro && extraida.tipologiaId) tipologiasComVidro.add(extraida.tipologiaId)
    }
  }

  const unicas = new Map<string, VariavelObservada>()
  for (const v of extraidas) {
    const chave = [v.referencia_tipologia_id, v.variavel_chave_raw, v.valor_normalizado, 'explicita_wvetro'].join('|')
    if (!unicas.has(chave)) unicas.set(chave, v)
  }
  const candidatas = [...unicas.values()]
  const refs = [...new Set(candidatas.map(v => v.referencia_tipologia_id))]

  const existentes = new Set<string>()
  if (refs.length) {
    for (let i = 0; i < refs.length; i += 200) {
      const { data, error } = await supabaseAdmin
        .from('wvetro_referencias_variaveis')
        .select('referencia_tipologia_id,variavel_chave_raw,valor_normalizado,origem_tipo')
        .in('referencia_tipologia_id', refs.slice(i, i + 200))
      if (error) throw error
      for (const v of data || []) {
        existentes.add([
          v.referencia_tipologia_id,
          v.variavel_chave_raw,
          txt(v.valor_normalizado),
          v.origem_tipo,
        ].join('|'))
      }
    }
  }

  const novas = candidatas.filter(v => !existentes.has([
    v.referencia_tipologia_id,
    v.variavel_chave_raw,
    v.valor_normalizado,
    'explicita_wvetro',
  ].join('|')))

  for (let i = 0; i < novas.length; i += 200) {
    const lote = novas.slice(i, i + 200).map(v => ({
      ...v,
      variavel_atlas_id: null,
      origem_tipo: 'explicita_wvetro',
      confianca: 1,
      status_mapeamento: 'referencia',
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabaseAdmin.from('wvetro_referencias_variaveis').insert(lote)
    if (error && (error as any)?.code !== '23505') throw error
  }

  if (tipologiasComVidro.size) {
    const { error } = await supabaseAdmin
      .from('tipologias')
      .update({ usa_vidro: true })
      .in('id', [...tipologiasComVidro])
    if (error) throw error
  }

  return {
    itensObservados,
    variaveisEncontradas: candidatas.length,
    variaveisNovas: novas.length,
    tipologiasComVidro: tipologiasComVidro.size,
  }
}

export async function reprocessarAprendizadoTecnicoWVetro(empresaId: string) {
  const amostras: AmostraAprendizadoWVetro[] = []
  let inicio = 0
  const tamanho = 500

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('orcamentos')
      .select('itens,wvetro_fluxo')
      .eq('empresa_id', empresaId)
      .contains('wvetro_fluxo', { origem: 'wvetro_api' })
      .range(inicio, inicio + tamanho - 1)
    if (error) throw error
    const lote = data || []
    for (const o of lote) {
      const fluxo = o.wvetro_fluxo && typeof o.wvetro_fluxo === 'object' ? o.wvetro_fluxo as any : {}
      amostras.push({
        itens: Array.isArray(o.itens) ? o.itens : [],
        numeroWvetro: txt(fluxo.numero),
        dataReferencia: txt(fluxo.data_referencia),
      })
    }
    if (lote.length < tamanho) break
    inicio += tamanho
  }

  return observarAprendizadoTecnicoWVetro(amostras)
}
