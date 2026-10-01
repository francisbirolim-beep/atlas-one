import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  listarProdutosWVetroPorTipo,
} from '@/lib/wvetroApi'

function txt(v: unknown) { return String(v ?? '').trim() }
function primeiroTexto(...valores: unknown[]) {
  for (const valor of valores) {
    const s = txt(valor)
    if (s) return s
  }
  return ''
}
function norm(v: unknown) {
  return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()
}
function key(...partes: unknown[]) {
  return createHash('sha1').update(partes.map(norm).join('::')).digest('hex')
}
function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = txt(v)
  if (!s) return null
  const n = Number(/^[-+]?\d+(?:\.\d+)?$/.test(s) ? s : s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function urlImagem(o: Record<string, unknown>) {
  for (const v of [o.URL, o.Url, o.url, o.Imagem, o.ImagemUrl, o.Foto, o.FotoUrl]) {
    const s = txt(v)
    if (/^https?:\/\//i.test(s) && !/\/wvetro\/?$/i.test(s)) return s
  }
  return null
}
function arr(o: Record<string, unknown>, nomes: string[]) {
  const alvos = new Set(nomes.map(norm))
  for (const [k, v] of Object.entries(o)) if (alvos.has(norm(k)) && Array.isArray(v)) return v
  return []
}
function objetosProduto(payload: unknown, out: Record<string, unknown>[] = []) {
  if (Array.isArray(payload)) { payload.forEach(v => objetosProduto(v, out)); return out }
  if (!payload || typeof payload !== 'object') return out
  const o = payload as Record<string, unknown>
  if (o.ProdutoCodigo !== undefined || o.ProdutoDescricao !== undefined || o.ProdutoSeuCodigo !== undefined) out.push(o)
  Object.values(o).forEach(v => objetosProduto(v, out))
  return out
}

type FonteHistorico = 'orcamento' | 'pedido'
type ItemHistorico = {
  fonte: FonteHistorico
  documentoChave: string
  itemIndice: number
  linha: string
  modelo: string
  largura: number | null
  altura: number | null
  ambiente: string | null
  nome: string | null
  codigo: string | null
  quantidade: number | null
  valorTotal: number | null
  raw: Record<string, unknown>
}

function chaveDocumento(o: Record<string, unknown>, fonte: FonteHistorico, ordinal: number) {
  for (const candidato of [
    o.OrcamentoId, o.orcamentoId, o.PedidoId, o.pedidoId, o.VendaId, o.vendaId,
    o.Nro, o.nro, o.Id, o.id, o.Numero, o.numero, o.NumeroOrcamento, o.numeroOrcamento,
    o.NumeroPedido, o.numeroPedido, o.Codigo, o.codigo,
  ]) {
    const valor = txt(candidato)
    if (valor) return valor
  }
  return `SEM-ID-${key(fonte, ordinal, o.Data ?? o.data ?? '', o.Vendedor ?? o.vendedor ?? '')}`
}

function itemHistorico(raw: Record<string, unknown>, fonte: FonteHistorico, documentoChave: string, itemIndice: number): ItemHistorico | null {
  const linha = txt(raw.Linha ?? raw.linha)
  const modelo = txt(raw.Modelo ?? raw.modelo)
  if (!linha || !modelo) return null
  return {
    fonte,
    documentoChave,
    itemIndice,
    linha,
    modelo,
    largura: num(raw.Largura ?? raw.largura),
    altura: num(raw.Altura ?? raw.altura),
    ambiente: txt(raw.Ambiente ?? raw.ambiente) || null,
    nome: txt(raw.Nome ?? raw.nome) || null,
    codigo: txt(raw.Codigo ?? raw.codigo ?? raw.SeuCodigo ?? raw.seuCodigo) || null,
    quantidade: num(raw.Qtde ?? raw.qtde ?? raw.Quantidade ?? raw.quantidade),
    valorTotal: num(raw.ValorTotal ?? raw.valorTotal ?? raw.Total ?? raw.total),
    raw,
  }
}

function itensHistoricos(payload: unknown, fonte: FonteHistorico) {
  const out: ItemHistorico[] = []
  let ordinalDocumento = 0

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) {
      valor.forEach(visitar)
      return
    }
    if (!valor || typeof valor !== 'object') return
    const o = valor as Record<string, unknown>

    const entradaItens = Object.entries(o).find(([k, v]) => norm(k) === 'ITENS' && Array.isArray(v))
    if (entradaItens) {
      const documento = chaveDocumento(o, fonte, ordinalDocumento++)
      const lista = entradaItens[1] as unknown[]
      lista.forEach((raw, itemIndice) => {
        if (!raw || typeof raw !== 'object') return
        const item = itemHistorico(raw as Record<string, unknown>, fonte, documento, itemIndice)
        if (item) out.push(item)
      })
      for (const [k, v] of Object.entries(o)) if (k !== entradaItens[0]) visitar(v)
      return
    }

    Object.values(o).forEach(visitar)
  }

  visitar(payload)

  // Compatibilidade com respostas antigas/alternativas que não venham envolvidas
  // por um objeto pai com Itens[]. O coletor anterior encontrava qualquer objeto
  // com Linha + Modelo; mantemos esse comportamento apenas como fallback para
  // evitar duplicidade quando o formato normal já foi reconhecido.
  if (!out.length) {
    let indiceFallback = 0
    const visitarFallback = (valor: unknown): void => {
      if (Array.isArray(valor)) {
        valor.forEach(visitarFallback)
        return
      }
      if (!valor || typeof valor !== 'object') return
      const o = valor as Record<string, unknown>
      const linha = txt(o.Linha ?? o.linha)
      const modelo = txt(o.Modelo ?? o.modelo)
      if (linha && modelo) {
        const item = itemHistorico(
          o,
          fonte,
          `SEM-ID-${key(fonte, linha, modelo, indiceFallback)}`,
          indiceFallback++,
        )
        if (item) out.push(item)
        return
      }
      Object.values(o).forEach(visitarFallback)
    }
    visitarFallback(payload)
  }

  return out
}

async function indiceProdutos() {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('id,categoria,codigo,codigo_origem,id_externo_wvetro,custo_wvetro_min,custo_wvetro_max,custo_wvetro_ultimo,custo_wvetro_atualizado_em,venda_wvetro_min,venda_wvetro_max,venda_wvetro_ultimo')
    .in('categoria', ['perfil', 'acessorio', 'vidro'])
  if (error) throw error
  const mapa = new Map<string, any[]>()
  for (const p of data || []) {
    for (const c of [p.codigo, p.codigo_origem, p.id_externo_wvetro].map(norm).filter(Boolean)) {
      const k = `${p.categoria}:${c}`
      const lista = mapa.get(k) || []
      lista.push(p)
      mapa.set(k, lista)
    }
  }
  return { mapa, produtos: data || [] }
}

async function indiceTipologias() {
  const [{ data: refs, error: e1 }, { data: tips, error: e2 }] = await Promise.all([
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id,chave,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url,largura_min_mm,largura_max_mm,altura_min_mm,altura_max_mm,ambientes_observados,nomes_observados'),
    supabaseAdmin.from('tipologias').select('id,label,linha_origem_wvetro,modelo_origem_wvetro,foto_url'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const refsMap = new Map<string, any>()
  for (const r of refs || []) refsMap.set(key(r.linha_raw, r.modelo_raw), r)
  const tipMap = new Map<string, any>()
  for (const t of tips || []) {
    const linha = txt(t.linha_origem_wvetro) || txt(t.label).match(/\(([^()]*)\)\s*$/)?.[1] || ''
    const modelo = txt(t.modelo_origem_wvetro) || txt(t.label).replace(/\s*\([^()]*\)\s*$/, '')
    if (linha && modelo) tipMap.set(key(linha, modelo), t)
  }
  return { refsMap, tipMap }
}

async function garantirReferencia(linha: string, modelo: string, imagem: string | null, data: string, refsMap: Map<string, any>, tipMap: Map<string, any>) {
  const k = key(linha, modelo)
  let ref = refsMap.get(k)
  const tip = tipMap.get(k) || null
  if (!ref) {
    const { data: criada, error } = await supabaseAdmin.from('wvetro_referencias_tipologias').upsert({
      chave: k,
      linha_raw: linha,
      modelo_raw: modelo,
      tipologia_atlas_id: tip?.id || null,
      imagem_url: imagem,
      primeiro_visto: data,
      ultimo_visto: data,
      ocorrencias: 0,
      status_mapeamento: tip ? 'mapeada_exata' : 'referencia',
      dados_origem: { fonte: 'base_tecnica_completa_wvetro' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' }).select('id,chave,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url').single()
    if (error) throw error
    ref = criada
    refsMap.set(k, ref)
  } else if (imagem && !ref.imagem_url) {
    await supabaseAdmin.from('wvetro_referencias_tipologias').update({ imagem_url: imagem, updated_at: new Date().toISOString() }).eq('id', ref.id)
    ref.imagem_url = imagem
  }
  return { ref, tip }
}

function componenteDoRaw(tipo: 'perfil' | 'acessorio' | 'vidro', raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const codigo = primeiroTexto(o.SeuCodigo, o.seuCodigo, o.Codigo, o.codigo)
  const codigoWvetro = txt(o.Codigo ?? o.codigo)
  const nome = txt(o.Nome ?? o.nome ?? o.Descricao ?? o.descricao ?? o.Especificacao ?? o.especificacao)
  if (!codigo && !codigoWvetro && !nome) return null
  const cor = txt(o.Cor ?? o.cor)
  return {
    tipo,
    chave: key(tipo, codigo, codigoWvetro, nome, cor),
    codigo: codigo || null,
    codigoWvetro: codigoWvetro || null,
    nome: nome || codigo || codigoWvetro,
    cor: cor || null,
    ncm: txt(o.Ncm ?? o.NCM ?? o.ncm) || null,
    unidade: txt(o.Unidade ?? o.unidade) || null,
    imagem: urlImagem(o),
    quantidade: num(o.Qtde ?? o.qtde ?? o.Quantidade ?? o.quantidade) ?? 1,
    medida: num(o.Medida ?? o.medida ?? o.M2 ?? o.m2),
    custo: num(o.CustoVlr ?? o.custoVlr),
    venda: num(o.VendaVlr ?? o.vendaVlr),
    posicao: txt(o.Posicao ?? o.posicao ?? o.Lado ?? o.lado) || null,
    corte: txt(o.Corte ?? o.corte ?? o.TipoFixacao ?? o.tipoFixacao) || null,
    raw: o,
  }
}

function codigoComponente(raw: unknown) {
  if (!raw || typeof raw !== 'object') return ''
  const o = raw as Record<string, unknown>
  return primeiroTexto(o.SeuCodigo, o.seuCodigo, o.Codigo, o.codigo).toUpperCase()
}

function familiaTecnica(item: ItemHistorico, vidrosRaw: unknown[]) {
  const descricao = norm(`${item.nome || ''} ${item.modelo || ''}`)
  if (descricao.includes('VENEZIANA')) return 'veneziana'
  if (descricao.includes('BANDEIRA')) return 'bandeira'
  if (descricao.includes('ATRAS DA PAREDE')) return 'atras_parede'
  if (descricao.includes('JANELA')) return 'janela'
  if (descricao.includes('TRAVESSA LARGA')) return 'travessa_larga'
  const vidroQtd = vidrosRaw.reduce<number>((s, raw) => {
    if (!raw || typeof raw !== 'object') return s
    const o = raw as Record<string, unknown>
    return s + (num(o.Qtde ?? o.qtde ?? o.Quantidade ?? o.quantidade) || 0)
  }, 0)
  if (norm(item.linha).includes('SUPREMA') && descricao.includes('PORTA DE CORRER 03 FOLHAS') && vidrosRaw.length === 1 && Math.abs(vidroQtd - 3) < 0.001) {
    return 'pc3_vidro_inteiro'
  }
  return 'nao_classificada'
}

function inferirVariaveisObservadas(item: ItemHistorico, perfisRaw: unknown[], vidrosRaw: unknown[]) {
  const codigos = new Set(perfisRaw.map(codigoComponente).filter(Boolean))
  const tem = (...lista: string[]) => lista.some(c => codigos.has(c))

  const contramarco = codigos.has('CM200') ? 'cm200' : codigos.has('CM060') ? 'cm060' : 'nao'
  const perfilMaoAmigo = tem('SU242', 'SU243', 'SU289', 'SU290')
    ? 'largo'
    : tem('SU040', 'SU041', 'SU047', 'SU049') ? 'comum' : 'nao_identificado'
  const reforcoInterno = tem('SU047', 'SU289')
  const reforcoExterno = tem('SU049', 'SU290')
  const reforcoMaoAmigo = reforcoInterno && reforcoExterno
    ? 'interno_e_externo'
    : reforcoInterno ? 'interno' : reforcoExterno ? 'externo' : 'sem'

  const su008 = perfisRaw.find(raw => codigoComponente(raw) === 'SU008')
  let mataJuntaDescontoMm: number | null = null
  if (su008 && item.altura !== null && typeof su008 === 'object') {
    const o = su008 as Record<string, unknown>
    const medidaM = num(o.Medida ?? o.medida)
    if (medidaM !== null) mataJuntaDescontoMm = Number((item.altura - medidaM * 1000).toFixed(3))
  }

  const vidroQuantidadeTotal = vidrosRaw.reduce<number>((s, raw) => {
    if (!raw || typeof raw !== 'object') return s
    const o = raw as Record<string, unknown>
    return s + (num(o.Qtde ?? o.qtde ?? o.Quantidade ?? o.quantidade) || 0)
  }, 0)

  return {
    familia_tecnica: familiaTecnica(item, vidrosRaw),
    item_codigo: item.codigo || null,
    contramarco,
    arremate_face_interna: codigos.has('MP347') ? 'sim' : 'nao',
    perfil_mao_amigo: perfilMaoAmigo,
    reforco_mao_amigo: reforcoMaoAmigo,
    reforco_aba: tem('SU280', 'SU280D') ? 'sim' : 'nao',
    mata_junta: tem('SU008', 'SU291') ? 'sim' : 'nao',
    mata_junta_desconto_mm: mataJuntaDescontoMm,
    grupos_vidro: vidrosRaw.length,
    vidro_quantidade_total: Number(vidroQuantidadeTotal.toFixed(3)),
    assinatura_perfis: Array.from(codigos).sort(),
  }
}

function montarCasoIndividual(item: ItemHistorico, ref: any, tip: any, data: string) {
  const perfisRaw = arr(item.raw, ['Perfil', 'Perfis'])
  const acessoriosRaw = arr(item.raw, ['Acessorios', 'Acessórios'])
  const vidrosRaw = arr(item.raw, ['Vidro', 'Vidros'])
  const payloadHash = createHash('sha256').update(JSON.stringify(item.raw)).digest('hex')
  const variaveisObservadas = inferirVariaveisObservadas(item, perfisRaw, vidrosRaw)
  return {
    perfisRaw,
    acessoriosRaw,
    vidrosRaw,
    caso: {
      referencia_tipologia_id: ref.id,
      tipologia_atlas_id: ref.tipologia_atlas_id || tip?.id || null,
      fonte: item.fonte,
      documento_chave: item.documentoChave,
      item_indice: item.itemIndice,
      caso_chave: key(item.fonte, item.documentoChave, item.itemIndice, item.codigo, item.linha, item.modelo),
      data_referencia: data,
      item_codigo: item.codigo,
      item_nome: item.nome,
      ambiente: item.ambiente,
      largura_mm: item.largura,
      altura_mm: item.altura,
      quantidade: item.quantidade,
      valor_total: item.valorTotal,
      perfis: perfisRaw,
      acessorios: acessoriosRaw,
      vidros: vidrosRaw,
      variaveis_observadas: variaveisObservadas,
      item_raw: item.raw,
      payload_hash: payloadHash,
      updated_at: new Date().toISOString(),
    },
  }
}

async function salvarCasosIndividuais(casos: any[]) {
  for (let i = 0; i < casos.length; i += 100) {
    const { error } = await supabaseAdmin
      .from('wvetro_tipologia_casos')
      .upsert(casos.slice(i, i + 100), { onConflict: 'caso_chave' })
    if (error) throw error
  }
}

export async function capturarCasosParidadeWVetroDia(data: string) {
  const [pedidos, orcamentos] = await Promise.all([
    listarPedidosWVetro<unknown>(data, data),
    listarOrcamentosWVetro<unknown>(data, data),
  ])
  const itens = [...itensHistoricos(pedidos, 'pedido'), ...itensHistoricos(orcamentos, 'orcamento')]
  const { refsMap, tipMap } = await indiceTipologias()
  const casos: any[] = []
  const refsUsadas = new Set<string>()

  for (const item of itens) {
    const { ref, tip } = await garantirReferencia(item.linha, item.modelo, urlImagem(item.raw), data, refsMap, tipMap)
    refsUsadas.add(ref.id)
    casos.push(montarCasoIndividual(item, ref, tip, data).caso)
  }

  await salvarCasosIndividuais(casos)
  return { data, itens: itens.length, casos: casos.length, tipologias: refsUsadas.size }
}

function min(a: number | null, b: number | null) { return a == null ? b : b == null ? a : Math.min(a, b) }
function max(a: number | null, b: number | null) { return a == null ? b : b == null ? a : Math.max(a, b) }
function unico(lista: unknown[], valor: unknown) {
  const s = txt(valor)
  if (!s) return lista
  return lista.some(v => txt(v) === s) ? lista : [...lista, s]
}

export async function processarBaseTecnicaWVetroDia(data: string) {
  const [pedidos, orcamentos] = await Promise.all([
    listarPedidosWVetro<unknown>(data, data),
    listarOrcamentosWVetro<unknown>(data, data),
  ])
  const itens = [...itensHistoricos(pedidos, 'pedido'), ...itensHistoricos(orcamentos, 'orcamento')]
  const { mapa: produtos } = await indiceProdutos()
  const { refsMap, tipMap } = await indiceTipologias()
  const refsUsadas = new Set<string>()
  const agregados = new Map<string, any>()
  const casosIndividuais: any[] = []
  // Agregação em memória de Largura/Altura/Ambiente/Nome por referência (achado
  // 2026-09-01/02: a API já entrega esses campos por item, não eram capturados).
  const dimensoes = new Map<string, { largura: number[]; altura: number[]; ambientes: Set<string>; nomes: Set<string> }>()

  for (const item of itens) {
    const { ref, tip } = await garantirReferencia(item.linha, item.modelo, urlImagem(item.raw), data, refsMap, tipMap)
    refsUsadas.add(ref.id)
    const dim = dimensoes.get(ref.id) || { largura: [], altura: [], ambientes: new Set<string>(), nomes: new Set<string>() }
    if (item.largura != null) dim.largura.push(item.largura)
    if (item.altura != null) dim.altura.push(item.altura)
    if (item.ambiente) dim.ambientes.add(item.ambiente)
    if (item.nome) dim.nomes.add(item.nome)
    dimensoes.set(ref.id, dim)

    const { perfisRaw, acessoriosRaw, vidrosRaw, caso } = montarCasoIndividual(item, ref, tip, data)
    casosIndividuais.push(caso)

    const grupos: Array<['perfil' | 'acessorio' | 'vidro', unknown[]]> = [
      ['perfil', perfisRaw],
      ['acessorio', acessoriosRaw],
      ['vidro', vidrosRaw],
    ]
    for (const [tipo, lista] of grupos) {
      for (const raw of lista) {
        const c = componenteDoRaw(tipo, raw)
        if (!c) continue
        const categoria = tipo === 'vidro' ? 'vidro' : tipo
        const candidatos = new Map<string, any>()
        for (const codigo of [c.codigo, c.codigoWvetro].map(norm).filter(Boolean)) {
          for (const p of produtos.get(`${categoria}:${codigo}`) || []) candidatos.set(p.id, p)
        }
        const produto = candidatos.size === 1 ? Array.from(candidatos.values())[0] : null
        const ak = `${ref.id}:${tipo}:${c.chave}`
        const atual = agregados.get(ak) || {
          referencia_tipologia_id: ref.id,
          tipologia_atlas_id: ref.tipologia_atlas_id || tip?.id || null,
          tipo,
          chave_componente: c.chave,
          produto_atlas_id: produto?.id || null,
          codigo: c.codigo,
          codigo_wvetro: c.codigoWvetro,
          nome: c.nome,
          cor: c.cor,
          unidade_origem: c.unidade,
          ncm: c.ncm,
          imagem_url: c.imagem,
          ocorrencias: 0,
          quantidade_min: null,
          quantidade_max: null,
          quantidade_soma: 0,
          medida_min: null,
          medida_max: null,
          custo_min: null,
          custo_max: null,
          custo_ultimo: null,
          venda_min: null,
          venda_max: null,
          venda_ultimo: null,
          ultimo_custo_em: null,
          posicoes: [],
          cortes: [],
          dados_origem: { fonte: 'W.Vetro vendas/pedidos e vendas/orcamentos' },
          primeiro_visto: data,
          ultimo_visto: data,
          status_mapeamento: produto ? 'mapeada_exata' : (candidatos.size > 1 ? 'pendente_revisao' : 'referencia'),
          updated_at: new Date().toISOString(),
        }
        atual.ocorrencias += 1
        atual.quantidade_min = min(atual.quantidade_min, c.quantidade)
        atual.quantidade_max = max(atual.quantidade_max, c.quantidade)
        atual.quantidade_soma += c.quantidade
        atual.medida_min = min(atual.medida_min, c.medida)
        atual.medida_max = max(atual.medida_max, c.medida)
        atual.custo_min = min(atual.custo_min, c.custo)
        atual.custo_max = max(atual.custo_max, c.custo)
        if (c.custo != null) { atual.custo_ultimo = c.custo; atual.ultimo_custo_em = data }
        atual.venda_min = min(atual.venda_min, c.venda)
        atual.venda_max = max(atual.venda_max, c.venda)
        if (c.venda != null) atual.venda_ultimo = c.venda
        atual.posicoes = unico(atual.posicoes, c.posicao)
        atual.cortes = unico(atual.cortes, c.corte)
        if (!atual.imagem_url && c.imagem) atual.imagem_url = c.imagem
        agregados.set(ak, atual)
      }
    }
  }

  const refIds = Array.from(refsUsadas)
  const existentes: any[] = []
  for (let i = 0; i < refIds.length; i += 100) {
    const { data: rows, error } = await supabaseAdmin.from('wvetro_tipologia_componentes').select('*').in('referencia_tipologia_id', refIds.slice(i, i + 100))
    if (error) throw error
    existentes.push(...(rows || []))
  }
  const indiceExistentes = new Map(existentes.map(r => [`${r.referencia_tipologia_id}:${r.tipo}:${r.chave_componente}`, r]))
  const linhas: any[] = []
  for (const [ak, novo] of agregados) {
    const velho = indiceExistentes.get(ak)
    if (!velho) { linhas.push(novo); continue }
    const novoMaisRecente = !velho.ultimo_custo_em || data >= velho.ultimo_custo_em
    linhas.push({
      ...novo,
      ocorrencias: Number(velho.ocorrencias || 0) + novo.ocorrencias,
      quantidade_min: min(num(velho.quantidade_min), novo.quantidade_min),
      quantidade_max: max(num(velho.quantidade_max), novo.quantidade_max),
      quantidade_soma: Number(velho.quantidade_soma || 0) + novo.quantidade_soma,
      medida_min: min(num(velho.medida_min), novo.medida_min),
      medida_max: max(num(velho.medida_max), novo.medida_max),
      custo_min: min(num(velho.custo_min), novo.custo_min),
      custo_max: max(num(velho.custo_max), novo.custo_max),
      custo_ultimo: novoMaisRecente && novo.custo_ultimo != null ? novo.custo_ultimo : velho.custo_ultimo,
      venda_min: min(num(velho.venda_min), novo.venda_min),
      venda_max: max(num(velho.venda_max), novo.venda_max),
      venda_ultimo: novoMaisRecente && novo.venda_ultimo != null ? novo.venda_ultimo : velho.venda_ultimo,
      ultimo_custo_em: novoMaisRecente && novo.custo_ultimo != null ? data : velho.ultimo_custo_em,
      primeiro_visto: velho.primeiro_visto && velho.primeiro_visto < data ? velho.primeiro_visto : data,
      ultimo_visto: velho.ultimo_visto && velho.ultimo_visto > data ? velho.ultimo_visto : data,
      posicoes: [...new Set([...(Array.isArray(velho.posicoes) ? velho.posicoes : []), ...novo.posicoes])],
      cortes: [...new Set([...(Array.isArray(velho.cortes) ? velho.cortes : []), ...novo.cortes])],
      imagem_url: velho.imagem_url || novo.imagem_url,
      produto_atlas_id: velho.produto_atlas_id || novo.produto_atlas_id,
      status_mapeamento: velho.produto_atlas_id || novo.produto_atlas_id ? 'mapeada_exata' : (velho.status_mapeamento === 'pendente_revisao' || novo.status_mapeamento === 'pendente_revisao' ? 'pendente_revisao' : 'referencia'),
      updated_at: new Date().toISOString(),
    })
  }
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await supabaseAdmin.from('wvetro_tipologia_componentes').upsert(linhas.slice(i, i + 200), { onConflict: 'referencia_tipologia_id,tipo,chave_componente' })
    if (error) throw error
  }

  await salvarCasosIndividuais(casosIndividuais)

  // Grava Largura/Altura/Ambiente/Nome agregados por referência (achado 2026-09-01/02).
  // Mescla com o que já estava salvo em refsMap (lido no início desta execução), não
  // sobrescreve — mesmo cuidado de min/max/união já usado para componentes acima.
  for (const [refId, dim] of dimensoes) {
    const refAtual = Array.from(refsMap.values()).find((r: any) => r.id === refId)
    if (!refAtual) continue
    const largurasNovas = dim.largura.length ? Math.min(...dim.largura) : null
    const largurasNovasMax = dim.largura.length ? Math.max(...dim.largura) : null
    const alturasNovas = dim.altura.length ? Math.min(...dim.altura) : null
    const alturasNovasMax = dim.altura.length ? Math.max(...dim.altura) : null
    const ambientesUniao = [...new Set([...(refAtual.ambientes_observados || []), ...dim.ambientes])].slice(0, 20)
    const nomesUniao = [...new Set([...(refAtual.nomes_observados || []), ...dim.nomes])].slice(0, 20)
    const patch = {
      largura_min_mm: min(refAtual.largura_min_mm, largurasNovas),
      largura_max_mm: max(refAtual.largura_max_mm, largurasNovasMax),
      altura_min_mm: min(refAtual.altura_min_mm, alturasNovas),
      altura_max_mm: max(refAtual.altura_max_mm, alturasNovasMax),
      ambientes_observados: ambientesUniao,
      nomes_observados: nomesUniao,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabaseAdmin.from('wvetro_referencias_tipologias').update(patch).eq('id', refId)
    if (error) throw error
  }

  await sincronizarCustosProdutosWVetro()
  return { data, itens: itens.length, tipologias: refsUsadas.size, componentes: linhas.length, casos: casosIndividuais.length }
}

export async function sincronizarCustosProdutosWVetro() {
  const { data: rows, error } = await supabaseAdmin
    .from('wvetro_tipologia_componentes')
    .select('produto_atlas_id,custo_min,custo_max,custo_ultimo,venda_min,venda_max,venda_ultimo,ultimo_custo_em')
    .not('produto_atlas_id', 'is', null)
  if (error) throw error
  const agg = new Map<string, any>()
  for (const r of rows || []) {
    const id = r.produto_atlas_id as string
    const a = agg.get(id) || { custoMin: null, custoMax: null, custoUltimo: null, vendaMin: null, vendaMax: null, vendaUltimo: null, dataUltimo: null }
    a.custoMin = min(a.custoMin, num(r.custo_min))
    a.custoMax = max(a.custoMax, num(r.custo_max))
    a.vendaMin = min(a.vendaMin, num(r.venda_min))
    a.vendaMax = max(a.vendaMax, num(r.venda_max))
    if (r.ultimo_custo_em && (!a.dataUltimo || r.ultimo_custo_em >= a.dataUltimo)) {
      a.dataUltimo = r.ultimo_custo_em
      if (r.custo_ultimo != null) a.custoUltimo = num(r.custo_ultimo)
      if (r.venda_ultimo != null) a.vendaUltimo = num(r.venda_ultimo)
    }
    agg.set(id, a)
  }
  let atualizados = 0
  for (const [id, a] of agg) {
    const { error: e } = await supabaseAdmin.from('produtos').update({
      custo_wvetro_min: a.custoMin,
      custo_wvetro_max: a.custoMax,
      custo_wvetro_ultimo: a.custoUltimo,
      custo_wvetro_atualizado_em: a.dataUltimo ? `${a.dataUltimo}T12:00:00Z` : new Date().toISOString(),
      venda_wvetro_min: a.vendaMin,
      venda_wvetro_max: a.vendaMax,
      venda_wvetro_ultimo: a.vendaUltimo,
    }).eq('id', id)
    if (e) throw e
    atualizados += 1
  }
  return { produtosAtualizados: atualizados }
}

export async function mapearReferenciasComponentesExatas() {
  const { data: refs, error: er } = await supabaseAdmin.from('wvetro_referencias_componentes').select('id,tipo,codigo,codigo_wvetro,produto_atlas_id,status_mapeamento')
  if (er) throw er
  const { mapa } = await indiceProdutos()
  let mapeadas = 0, ambiguas = 0, semMatch = 0
  for (const ref of refs || []) {
    if (ref.produto_atlas_id) continue
    const categoria = ref.tipo === 'perfil' ? 'perfil' : ref.tipo === 'acessorio' ? 'acessorio' : null
    if (!categoria) continue
    const candidatos = new Map<string, any>()
    for (const codigo of [ref.codigo, ref.codigo_wvetro].map(norm).filter(Boolean)) for (const p of mapa.get(`${categoria}:${codigo}`) || []) candidatos.set(p.id, p)
    if (candidatos.size === 1) {
      const p = Array.from(candidatos.values())[0]
      const { error } = await supabaseAdmin.from('wvetro_referencias_componentes').update({ produto_atlas_id: p.id, status_mapeamento: 'mapeada_exata', updated_at: new Date().toISOString() }).eq('id', ref.id)
      if (error) throw error
      mapeadas += 1
    } else if (candidatos.size > 1) {
      await supabaseAdmin.from('wvetro_referencias_componentes').update({ status_mapeamento: 'pendente_revisao', updated_at: new Date().toISOString() }).eq('id', ref.id)
      ambiguas += 1
    } else semMatch += 1
  }
  return { mapeadas, ambiguas, semMatch }
}

export async function sincronizarCatalogoEsquadriasWVetro() {
  const payload = await listarProdutosWVetroPorTipo<unknown>('E')
  const objetos = objetosProduto(payload)
  const unicos = new Map<string, Record<string, unknown>>()
  for (const o of objetos) {
    const codigo = txt(o.ProdutoCodigo ?? o.ProdutoSeuCodigo)
    const descricao = txt(o.ProdutoDescricao)
    const linha = txt(o.LinhaNome)
    if (codigo || descricao) unicos.set(key(codigo || descricao, linha), o)
  }
  if (unicos.size <= 1) return { suportado: false, encontrados: unicos.size, mapeados: 0, imagens: 0 }
  const { refsMap, tipMap } = await indiceTipologias()
  let mapeados = 0, imagens = 0
  const snapshots: any[] = []
  for (const o of unicos.values()) {
    const codigo = txt(o.ProdutoCodigo ?? o.ProdutoSeuCodigo)
    const modelo = txt(o.ProdutoDescricao) || codigo
    const linha = txt(o.LinhaNome)
    const imagem = urlImagem(o)
    const k = linha && modelo ? key(linha, modelo) : ''
    const ref = k ? refsMap.get(k) : null
    const tip = k ? tipMap.get(k) : null
    if (ref) {
      const patch: any = { updated_at: new Date().toISOString() }
      if (imagem && !ref.imagem_url) { patch.imagem_url = imagem; ref.imagem_url = imagem; imagens += 1 }
      if (!ref.tipologia_atlas_id && tip?.id) patch.tipologia_atlas_id = tip.id
      if (Object.keys(patch).length > 1) await supabaseAdmin.from('wvetro_referencias_tipologias').update(patch).eq('id', ref.id)
      mapeados += 1
    }
    if (tip?.id && imagem && !tip.foto_url) {
      await supabaseAdmin.from('tipologias').update({ foto_url: imagem }).eq('id', tip.id)
    }
    snapshots.push({
      tipo: 'E', codigo: codigo || key(linha, modelo).slice(0, 24), produto_atlas_id: null,
      produto_wvetro_id: txt(o.ProdutoId ?? o.produtoId) || null,
      seu_codigo: txt(o.ProdutoSeuCodigo) || null,
      descricao: modelo || null,
      ativo: o.ProdutoAtivo === undefined ? null : ['S','TRUE','1'].includes(txt(o.ProdutoAtivo).toUpperCase()),
      linha_id_wvetro: txt(o.LinhaId) || null, linha_nome_wvetro: linha || null,
      especie_id: txt(o.EspecieId) || null, especie_nome: txt(o.EspecieNome) || null,
      tipo_id: txt(o.TipoId) || null, tipo_nome: txt(o.TipoNome) || null,
      unidade: txt(o.Unidade) || null, ncm: txt(o.ProdutoNCM) || null,
      url_origem: imagem, payload: o, consultado_em: new Date().toISOString(), erro: null,
    })
  }
  for (let i = 0; i < snapshots.length; i += 200) {
    const { error } = await supabaseAdmin.from('wvetro_produtos_snapshot').upsert(snapshots.slice(i, i + 200), { onConflict: 'tipo,codigo' })
    if (error) throw error
  }
  return { suportado: true, encontrados: unicos.size, mapeados, imagens }
}

function tabelaCasosParidadeAusente(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string }
  const texto = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return e.code === '42P01'
    || e.code === 'PGRST205'
    || (texto.includes('wvetro_tipologia_casos') && (texto.includes('schema cache') || texto.includes('does not exist') || texto.includes('could not find')))
}

export async function resumoBaseTecnicaWVetro() {
  const [bom, mapeados, custos, imgs, tips, casos] = await Promise.all([
    supabaseAdmin.from('wvetro_tipologia_componentes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('wvetro_tipologia_componentes').select('id', { count: 'exact', head: true }).not('produto_atlas_id', 'is', null),
    supabaseAdmin.from('produtos').select('id', { count: 'exact', head: true }).not('custo_wvetro_ultimo', 'is', null),
    supabaseAdmin.from('produtos').select('id', { count: 'exact', head: true }).not('foto_url', 'is', null).eq('origem', 'wvetro'),
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('wvetro_tipologia_casos').select('id', { count: 'exact', head: true }),
  ])
  for (const resposta of [bom, mapeados, custos, imgs, tips]) if (resposta.error) throw resposta.error
  if (casos.error && !tabelaCasosParidadeAusente(casos.error)) throw casos.error
  return {
    componentesPorTipologia: bom.count || 0,
    componentesMapeados: mapeados.count || 0,
    produtosComCustoWvetro: custos.count || 0,
    produtosWvetroComFoto: imgs.count || 0,
    tipologiasReferencia: tips.count || 0,
    casosIndividuais: casos.error ? 0 : (casos.count || 0),
    paridadeSchemaPronto: !casos.error,
  }
}