import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  buscarProdutoWVetro,
  listarLinhasWVetro,
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  listarProdutosWVetroPorTipo,
  type WVetroProdutoTipo,
} from '@/lib/wvetroApi'

function txt(v: unknown) {
  return String(v ?? '').trim()
}

function n(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const bruto = txt(v)
  if (!bruto) return null
  if (/^-?\d+(?:\.\d+)?$/.test(bruto)) {
    const numero = Number(bruto)
    return Number.isFinite(numero) ? numero : null
  }
  const numero = Number(bruto.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) ? numero : null
}

function norm(v: unknown) {
  return txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR')
}

function hash(...partes: unknown[]) {
  return createHash('md5').update(partes.map(v => norm(v)).join('::')).digest('hex')
}

function urlImagem(obj: Record<string, unknown>) {
  const candidatos = [obj.URL, obj.Url, obj.url, obj.Imagem, obj.ImagemUrl, obj.imagemUrl, obj.Foto, obj.FotoUrl, obj.fotoUrl]
  for (const item of candidatos) {
    const valor = txt(item)
    if (/^https?:\/\//i.test(valor)) return valor
  }
  return null
}

function primeiroObjetoProduto(payload: unknown): Record<string, unknown> | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const achado = primeiroObjetoProduto(item)
      if (achado) return achado
    }
    return null
  }
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  if (obj.ProdutoCodigo !== undefined || obj.ProdutoSeuCodigo !== undefined || obj.ProdutoDescricao !== undefined) return obj
  for (const valor of Object.values(obj)) {
    const achado = primeiroObjetoProduto(valor)
    if (achado) return achado
  }
  return null
}

function todosObjetosProduto(payload: unknown, saida: Record<string, unknown>[] = []) {
  if (Array.isArray(payload)) {
    payload.forEach(item => todosObjetosProduto(item, saida))
    return saida
  }
  if (!payload || typeof payload !== 'object') return saida
  const obj = payload as Record<string, unknown>
  if (obj.ProdutoCodigo !== undefined || obj.ProdutoSeuCodigo !== undefined || obj.ProdutoDescricao !== undefined) saida.push(obj)
  Object.values(obj).forEach(v => todosObjetosProduto(v, saida))
  return saida
}

function todosObjetosLinha(payload: unknown, saida: Array<{ id: string; nome: string; raw: Record<string, unknown> }> = []) {
  if (Array.isArray(payload)) {
    payload.forEach(item => todosObjetosLinha(item, saida))
    return saida
  }
  if (!payload || typeof payload !== 'object') return saida
  const obj = payload as Record<string, unknown>
  const nome = txt(obj.LinhaNome ?? obj.linhaNome)
  if (nome) saida.push({ id: txt(obj.LinhaId ?? obj.linhaId), nome, raw: obj })
  Object.values(obj).forEach(v => todosObjetosLinha(v, saida))
  return saida
}

type LinhaCache = {
  id: string
  nome: string
  apelidos: string[] | null
  origem_referencia?: string | null
  linha_wvetro_raw?: string | null
  ativo: boolean
}

async function carregarLinhasCache() {
  const { data, error } = await supabaseAdmin
    .from('linhas_tecnicas')
    .select('id,nome,apelidos,origem_referencia,linha_wvetro_raw,ativo')
  if (error) throw error
  return (data || []) as LinhaCache[]
}

function acharLinhaExata(linhas: LinhaCache[], linhaRaw: string) {
  const alvo = norm(linhaRaw)
  return linhas.find(linha => {
    if (norm(linha.nome) === alvo) return true
    if (linha.linha_wvetro_raw && norm(linha.linha_wvetro_raw) === alvo) return true
    return (linha.apelidos || []).some(a => norm(a) === alvo)
  }) || null
}

async function garantirLinhaReferencia(
  linhas: LinhaCache[],
  linhaRaw: string,
  fonte: 'api' | 'tipologia' | 'produto',
  ativa: boolean,
) {
  const nome = txt(linhaRaw)
  if (!nome) return null

  let linha = acharLinhaExata(linhas, nome)
  if (!linha) {
    const chave = `wvetro_${hash(nome).slice(0, 16)}`
    const { data, error } = await supabaseAdmin
      .from('linhas_tecnicas')
      .upsert({
        chave,
        nome,
        descricao: 'Importada como referência exata do W.Vetro. Pendente de validação técnica no Atlas.',
        apelidos: [],
        ativo: ativa,
        ordem: ativa ? 950 : 1250,
        origem_referencia: 'wvetro',
        linha_wvetro_raw: nome,
        status_validacao: 'referencia_wvetro',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'chave', ignoreDuplicates: true })
      .select('id,nome,apelidos,origem_referencia,linha_wvetro_raw,ativo')
      .maybeSingle()
    if (error) throw error
    if (data) {
      linha = data as LinhaCache
      linhas.push(linha)
    } else {
      const recarregadas = await carregarLinhasCache()
      linhas.splice(0, linhas.length, ...recarregadas)
      linha = acharLinhaExata(linhas, nome)
    }
  }

  const { data: ref } = await supabaseAdmin
    .from('wvetro_referencias_linhas')
    .select('linha_raw,origem_tipologias,origem_acessorios,origem_api_linhas,qtd_tipologias,qtd_acessorios')
    .eq('linha_raw', nome)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    linha_raw: nome,
    linha_tecnica_id: linha?.id || null,
    status_mapeamento: linha ? 'mapeada_exata' : 'referencia',
    origem_tipologias: Boolean(ref?.origem_tipologias) || fonte === 'tipologia',
    origem_acessorios: Boolean(ref?.origem_acessorios),
    origem_api_linhas: Boolean(ref?.origem_api_linhas) || fonte === 'api' || fonte === 'produto',
    qtd_tipologias: Number(ref?.qtd_tipologias || 0),
    qtd_acessorios: Number(ref?.qtd_acessorios || 0),
    updated_at: new Date().toISOString(),
  }
  await supabaseAdmin.from('wvetro_referencias_linhas').upsert(payload, { onConflict: 'linha_raw' })
  return linha
}

function coletarHistorico(payload: unknown) {
  const tipologias = new Map<string, { linha: string; modelo: string; ocorrencias: number; imagem: string | null }>()
  const componentes = new Map<string, any>()
  const vidros = new Map<string, any>()

  function addComponente(tipo: 'perfil' | 'acessorio', valor: unknown) {
    if (!valor || typeof valor !== 'object') return
    const o = valor as Record<string, unknown>
    const codigo = txt(o.SeuCodigo ?? o.seuCodigo ?? o.Codigo ?? o.codigo)
    const codigoWvetro = txt(o.Codigo ?? o.codigo)
    const nome = txt(o.Nome ?? o.nome ?? o.Descricao ?? o.descricao)
    if (!codigo && !nome) return
    const cor = txt(o.Cor ?? o.cor)
    const chave = hash(tipo, codigo, codigoWvetro, nome, cor)
    const custo = n(o.CustoVlr ?? o.custoVlr)
    const venda = n(o.VendaVlr ?? o.vendaVlr)
    const atual = componentes.get(chave)
    if (!atual) {
      componentes.set(chave, {
        chave, tipo, codigo: codigo || null, codigo_wvetro: codigoWvetro || null,
        nome: nome || codigo || codigoWvetro, cor: cor || null,
        ncm: txt(o.Ncm ?? o.NCM ?? o.ncm) || null,
        imagem_url: urlImagem(o), ocorrencias: 1,
        custo_min: custo, custo_max: custo, venda_min: venda, venda_max: venda,
      })
      return
    }
    atual.ocorrencias += 1
    if (custo !== null) {
      atual.custo_min = atual.custo_min === null ? custo : Math.min(atual.custo_min, custo)
      atual.custo_max = atual.custo_max === null ? custo : Math.max(atual.custo_max, custo)
    }
    if (venda !== null) {
      atual.venda_min = atual.venda_min === null ? venda : Math.min(atual.venda_min, venda)
      atual.venda_max = atual.venda_max === null ? venda : Math.max(atual.venda_max, venda)
    }
    if (!atual.imagem_url) atual.imagem_url = urlImagem(o)
  }

  function addVidro(valor: unknown) {
    if (!valor || typeof valor !== 'object') return
    const o = valor as Record<string, unknown>
    const codigo = txt(o.Codigo ?? o.codigo)
    const especificacao = txt(o.Especificacao ?? o.especificacao ?? o.Nome ?? o.nome)
    if (!codigo && !especificacao) return
    const chave = hash(codigo, especificacao)
    const atual = vidros.get(chave)
    if (atual) {
      atual.ocorrencias += 1
      if (!atual.imagem_url) atual.imagem_url = urlImagem(o)
      return
    }
    vidros.set(chave, {
      chave,
      codigo: codigo || null,
      especificacao: especificacao || codigo,
      ncm: txt(o.Ncm ?? o.NCM ?? o.ncm) || null,
      tipo_fixacao: txt(o.TipoFixacao ?? o.tipoFixacao) || null,
      imagem_url: urlImagem(o),
      ocorrencias: 1,
      dados_origem: o,
    })
  }

  function visitar(valor: unknown) {
    if (Array.isArray(valor)) {
      valor.forEach(visitar)
      return
    }
    if (!valor || typeof valor !== 'object') return
    const o = valor as Record<string, unknown>
    const linha = txt(o.Linha ?? o.linha)
    const modelo = txt(o.Modelo ?? o.modelo)
    if (linha && modelo) {
      const chave = hash(linha, modelo)
      const atual = tipologias.get(chave)
      if (atual) atual.ocorrencias += 1
      else tipologias.set(chave, { linha, modelo, ocorrencias: 1, imagem: urlImagem(o) })
    }

    for (const [chave, conteudo] of Object.entries(o)) {
      const k = norm(chave)
      if (Array.isArray(conteudo)) {
        if (k === 'PERFIL' || k === 'PERFIS') conteudo.forEach(v => addComponente('perfil', v))
        if (k === 'ACESSORIOS' || k === 'ACESSÓRIOS') conteudo.forEach(v => addComponente('acessorio', v))
        if (k === 'VIDRO' || k === 'VIDROS') conteudo.forEach(addVidro)
      }
      visitar(conteudo)
    }
  }

  visitar(payload)
  return {
    tipologias: Array.from(tipologias.values()),
    componentes: Array.from(componentes.values()),
    vidros: Array.from(vidros.values()),
  }
}

async function indiceProdutosAtlas() {
  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('id,codigo,codigo_origem,id_externo_wvetro,categoria,foto_url,dados_origem')
  if (error) throw error
  const mapa = new Map<string, any[]>()
  for (const p of data || []) {
    for (const codigo of [p.codigo, p.codigo_origem, p.id_externo_wvetro].map(norm).filter(Boolean)) {
      const lista = mapa.get(codigo) || []
      lista.push(p)
      mapa.set(codigo, lista)
    }
  }
  return mapa
}

async function upsertHistorico(payload: unknown, inicio: string, fim: string) {
  const extraido = coletarHistorico(payload)
  const linhas = await carregarLinhasCache()
  const produtos = await indiceProdutosAtlas()
  const { data: tipologiasAtlas } = await supabaseAdmin
    .from('tipologias')
    .select('id,label,linha_origem_wvetro,modelo_origem_wvetro')

  const mapaTipologias = new Map<string, string>()
  for (const t of tipologiasAtlas || []) {
    const linha = txt(t.linha_origem_wvetro) || txt(t.label).match(/\(([^()]*)\)\s*$/)?.[1] || ''
    const modelo = txt(t.modelo_origem_wvetro) || txt(t.label).replace(/\s*\([^()]*\)\s*$/, '')
    if (linha && modelo) mapaTipologias.set(hash(linha, modelo), t.id)
  }

  for (const item of extraido.tipologias) {
    const linha = await garantirLinhaReferencia(linhas, item.linha, 'tipologia', true)
    const tipologiaAtlasId = mapaTipologias.get(hash(item.linha, item.modelo)) || null
    const { data: existente } = await supabaseAdmin
      .from('wvetro_referencias_tipologias')
      .select('ocorrencias,primeiro_visto,ultimo_visto')
      .eq('chave', hash(item.linha, item.modelo))
      .maybeSingle()
    await supabaseAdmin.from('wvetro_referencias_tipologias').upsert({
      chave: hash(item.linha, item.modelo),
      linha_raw: item.linha,
      modelo_raw: item.modelo,
      tipologia_atlas_id: tipologiaAtlasId,
      imagem_url: item.imagem,
      primeiro_visto: existente?.primeiro_visto && existente.primeiro_visto < inicio ? existente.primeiro_visto : inicio,
      ultimo_visto: existente?.ultimo_visto && existente.ultimo_visto > fim ? existente.ultimo_visto : fim,
      ocorrencias: Number(existente?.ocorrencias || 0) + item.ocorrencias,
      status_mapeamento: tipologiaAtlasId ? 'mapeada_exata' : 'referencia',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })

    if (linha && tipologiaAtlasId) {
      await supabaseAdmin.from('linha_tipologias').upsert({ linha_id: linha.id, tipologia_id: tipologiaAtlasId }, { onConflict: 'linha_id,tipologia_id', ignoreDuplicates: true })
    }
  }

  for (const item of extraido.componentes) {
    const candidatos = new Map<string, any>()
    for (const codigo of [item.codigo, item.codigo_wvetro].map(norm).filter(Boolean)) {
      for (const p of produtos.get(codigo) || []) candidatos.set(p.id, p)
    }
    const lista = Array.from(candidatos.values())
    const produto = lista.length === 1 ? lista[0] : null
    const { data: existente } = await supabaseAdmin
      .from('wvetro_referencias_componentes')
      .select('ocorrencias,custo_min,custo_max,venda_min,venda_max,primeiro_visto,ultimo_visto,imagem_url')
      .eq('chave', item.chave)
      .maybeSingle()

    const minimo = (a: number | null, b: number | null) => a === null ? b : b === null ? a : Math.min(a, b)
    const maximo = (a: number | null, b: number | null) => a === null ? b : b === null ? a : Math.max(a, b)
    await supabaseAdmin.from('wvetro_referencias_componentes').upsert({
      ...item,
      produto_atlas_id: produto?.id || null,
      status_mapeamento: produto ? 'mapeada_exata' : (lista.length > 1 ? 'pendente_revisao' : 'referencia'),
      ocorrencias: Number(existente?.ocorrencias || 0) + item.ocorrencias,
      custo_min: minimo(n(existente?.custo_min), item.custo_min),
      custo_max: maximo(n(existente?.custo_max), item.custo_max),
      venda_min: minimo(n(existente?.venda_min), item.venda_min),
      venda_max: maximo(n(existente?.venda_max), item.venda_max),
      primeiro_visto: existente?.primeiro_visto && existente.primeiro_visto < inicio ? existente.primeiro_visto : inicio,
      ultimo_visto: existente?.ultimo_visto && existente.ultimo_visto > fim ? existente.ultimo_visto : fim,
      imagem_url: existente?.imagem_url || item.imagem_url,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })

    if (produto && !produto.foto_url && item.imagem_url) {
      await supabaseAdmin.from('produtos').update({ foto_url: item.imagem_url, updated_at: new Date().toISOString() }).eq('id', produto.id)
    }
  }

  for (const item of extraido.vidros) {
    const candidatos = new Map<string, any>()
    if (item.codigo) {
      for (const p of produtos.get(norm(item.codigo)) || []) candidatos.set(p.id, p)
    }
    const lista = Array.from(candidatos.values())
    const produto = lista.length === 1 ? lista[0] : null
    const { data: existente } = await supabaseAdmin
      .from('wvetro_referencias_vidros')
      .select('ocorrencias,primeiro_visto,ultimo_visto,imagem_url')
      .eq('chave', item.chave)
      .maybeSingle()
    await supabaseAdmin.from('wvetro_referencias_vidros').upsert({
      ...item,
      produto_atlas_id: produto?.id || null,
      status_validacao: produto ? 'em_validacao' : 'referencia_wvetro',
      ocorrencias: Number(existente?.ocorrencias || 0) + item.ocorrencias,
      primeiro_visto: existente?.primeiro_visto && existente.primeiro_visto < inicio ? existente.primeiro_visto : inicio,
      ultimo_visto: existente?.ultimo_visto && existente.ultimo_visto > fim ? existente.ultimo_visto : fim,
      imagem_url: existente?.imagem_url || item.imagem_url,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'chave' })
  }

  return {
    tipologias: extraido.tipologias.length,
    perfis: extraido.componentes.filter((x: any) => x.tipo === 'perfil').length,
    acessorios: extraido.componentes.filter((x: any) => x.tipo === 'acessorio').length,
    vidros: extraido.vidros.length,
  }
}

export async function sincronizarLinhasApiWVetro() {
  const payload = await listarLinhasWVetro<unknown>()
  const linhasApi = todosObjetosLinha(payload)
  const cache = await carregarLinhasCache()
  const unicas = new Map<string, { id: string; nome: string; raw: Record<string, unknown> }>()
  for (const l of linhasApi) if (!unicas.has(norm(l.nome))) unicas.set(norm(l.nome), l)

  for (const l of unicas.values()) {
    const linha = await garantirLinhaReferencia(cache, l.nome, 'api', false)
    await supabaseAdmin.from('wvetro_referencias_linhas').upsert({
      linha_raw: l.nome,
      linha_tecnica_id: linha?.id || null,
      origem_api_linhas: true,
      status_mapeamento: linha ? 'mapeada_exata' : 'referencia',
      dados_origem: { fonte: '/Produtos/linhas', LinhaId: l.id, raw: l.raw },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'linha_raw' })
  }
  return { encontradas: unicas.size }
}

export async function processarPeriodoWVetro(inicio: string, fim: string) {
  const [pedidos, orcamentos] = await Promise.all([
    listarPedidosWVetro<unknown>(inicio, fim),
    listarOrcamentosWVetro<unknown>(inicio, fim),
  ])
  const a = await upsertHistorico(pedidos, inicio, fim)
  const b = await upsertHistorico(orcamentos, inicio, fim)
  return {
    tipologias: a.tipologias + b.tipologias,
    perfis: a.perfis + b.perfis,
    acessorios: a.acessorios + b.acessorios,
    vidros: a.vidros + b.vidros,
  }
}

function produtoSnapshot(tipo: WVetroProdutoTipo, obj: Record<string, unknown>, produtoAtlasId: string | null, payload: unknown) {
  return {
    tipo,
    codigo: txt(obj.ProdutoCodigo ?? obj.ProdutoSeuCodigo),
    produto_atlas_id: produtoAtlasId,
    produto_wvetro_id: txt(obj.ProdutoId ?? obj.produtoId) || null,
    seu_codigo: txt(obj.ProdutoSeuCodigo) || null,
    descricao: txt(obj.ProdutoDescricao) || null,
    ativo: obj.ProdutoAtivo === undefined ? null : Boolean(obj.ProdutoAtivo),
    linha_id_wvetro: txt(obj.LinhaId) || null,
    linha_nome_wvetro: txt(obj.LinhaNome) || null,
    especie_id: txt(obj.EspecieId) || null,
    especie_nome: txt(obj.EspecieNome) || null,
    tipo_id: txt(obj.TipoId) || null,
    tipo_nome: txt(obj.TipoNome) || null,
    unidade: txt(obj.Unidade) || null,
    ncm: txt(obj.ProdutoNCM) || null,
    url_origem: urlImagem(obj),
    payload,
    consultado_em: new Date().toISOString(),
    erro: null,
  }
}

async function aplicarProdutoApi(tipo: WVetroProdutoTipo, produtoAtlas: any, payload: unknown, linhas: LinhaCache[]) {
  const obj = primeiroObjetoProduto(payload)
  if (!obj) {
    await supabaseAdmin.from('wvetro_produtos_snapshot').upsert({
      tipo,
      codigo: produtoAtlas.codigo || produtoAtlas.codigo_origem,
      produto_atlas_id: produtoAtlas.id,
      payload: payload ?? {},
      consultado_em: new Date().toISOString(),
      erro: 'Resposta sem objeto de produto reconhecível.',
    }, { onConflict: 'tipo,codigo' })
    return { ok: false, imagem: false, linha: false }
  }

  const snap = produtoSnapshot(tipo, obj, produtoAtlas.id, payload)
  if (!snap.codigo) snap.codigo = produtoAtlas.codigo || produtoAtlas.codigo_origem
  await supabaseAdmin.from('wvetro_produtos_snapshot').upsert(snap, { onConflict: 'tipo,codigo' })

  const linhaNome = txt(obj.LinhaNome)
  let linha: LinhaCache | null = null
  if (linhaNome) {
    linha = await garantirLinhaReferencia(linhas, linhaNome, 'produto', false)
    if (linha) {
      await supabaseAdmin.from('linha_produtos').upsert({ linha_id: linha.id, produto_id: produtoAtlas.id }, { onConflict: 'linha_id,produto_id', ignoreDuplicates: true })
    }
  }

  const foto = urlImagem(obj)
  const dadosOrigem = {
    ...(produtoAtlas.dados_origem || {}),
    wvetro_api: {
      consultado_em: new Date().toISOString(),
      ProdutoCodigo: txt(obj.ProdutoCodigo) || null,
      ProdutoSeuCodigo: txt(obj.ProdutoSeuCodigo) || null,
      ProdutoDescricao: txt(obj.ProdutoDescricao) || null,
      LinhaId: txt(obj.LinhaId) || null,
      LinhaNome: linhaNome || null,
      Unidade: txt(obj.Unidade) || null,
      ProdutoNCM: txt(obj.ProdutoNCM) || null,
      URL: foto,
    },
  }
  const update: Record<string, unknown> = { dados_origem: dadosOrigem, updated_at: new Date().toISOString() }
  if (!produtoAtlas.foto_url && foto) update.foto_url = foto
  await supabaseAdmin.from('produtos').update(update).eq('id', produtoAtlas.id)

  return { ok: true, imagem: Boolean(foto), linha: Boolean(linhaNome) }
}

export async function processarLoteProdutosWVetro(offset: number, limite = 12) {
  const inicio = Math.max(0, offset)
  const tamanho = Math.min(25, Math.max(1, limite))
  const { count } = await supabaseAdmin
    .from('produtos')
    .select('id', { count: 'exact', head: true })
    .eq('origem', 'wvetro')
    .in('categoria', ['perfil','acessorio'])

  const { data, error } = await supabaseAdmin
    .from('produtos')
    .select('id,codigo,codigo_origem,categoria,foto_url,dados_origem')
    .eq('origem', 'wvetro')
    .in('categoria', ['perfil','acessorio'])
    .order('categoria')
    .order('codigo')
    .range(inicio, inicio + tamanho - 1)
  if (error) throw error

  const linhas = await carregarLinhasCache()
  let ok = 0, erros = 0, imagens = 0, comLinha = 0
  for (const produto of data || []) {
    const codigo = txt(produto.codigo || produto.codigo_origem)
    if (!codigo) continue
    const tipo: WVetroProdutoTipo = produto.categoria === 'perfil' ? 'P' : 'A'
    try {
      const payload = await buscarProdutoWVetro<unknown>(tipo, codigo)
      const resultado = await aplicarProdutoApi(tipo, produto, payload, linhas)
      if (resultado.ok) ok += 1; else erros += 1
      if (resultado.imagem) imagens += 1
      if (resultado.linha) comLinha += 1
    } catch (e) {
      erros += 1
      await supabaseAdmin.from('wvetro_produtos_snapshot').upsert({
        tipo, codigo, produto_atlas_id: produto.id, consultado_em: new Date().toISOString(),
        erro: e instanceof Error ? e.message : 'Falha na consulta', payload: {},
      }, { onConflict: 'tipo,codigo' })
    }
  }

  return { offset: inicio, processados: (data || []).length, total: count || 0, ok, erros, imagens, comLinha, proximoOffset: inicio + (data || []).length }
}

export async function descobrirCatalogoPorTipoWVetro(tipo: 'P' | 'A') {
  try {
    const payload = await listarProdutosWVetroPorTipo<unknown>(tipo)
    const objetos = todosObjetosProduto(payload)
    const unicos = new Map<string, Record<string, unknown>>()
    for (const obj of objetos) {
      const codigo = txt(obj.ProdutoCodigo ?? obj.ProdutoSeuCodigo)
      if (codigo) unicos.set(norm(codigo), obj)
    }
    return { suportado: unicos.size > 1, quantidade: unicos.size, codigos: Array.from(unicos.values()).map(o => txt(o.ProdutoCodigo ?? o.ProdutoSeuCodigo)) }
  } catch (e) {
    return { suportado: false, quantidade: 0, codigos: [] as string[], erro: e instanceof Error ? e.message : 'Falha na descoberta' }
  }
}

export async function resumoAuditoriaWVetro() {
  const [produtos, linhas, tipologias, comp, vidros, snapshots] = await Promise.all([
    supabaseAdmin.from('produtos').select('categoria,origem,foto_url', { count: 'exact' }).eq('origem','wvetro'),
    supabaseAdmin.from('wvetro_referencias_linhas').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id,status_mapeamento', { count: 'exact' }),
    supabaseAdmin.from('wvetro_referencias_componentes').select('tipo,status_mapeamento', { count: 'exact' }),
    supabaseAdmin.from('wvetro_referencias_vidros').select('id,status_validacao,imagem_url', { count: 'exact' }),
    supabaseAdmin.from('wvetro_produtos_snapshot').select('id,url_origem,linha_nome_wvetro,erro', { count: 'exact' }),
  ])

  const ps = produtos.data || []
  const ts = tipologias.data || []
  const cs = comp.data || []
  const vs = vidros.data || []
  const ss = snapshots.data || []
  return {
    catalogoAtlas: {
      perfisWvetro: ps.filter((p: any) => p.categoria === 'perfil').length,
      acessoriosWvetro: ps.filter((p: any) => p.categoria === 'acessorio').length,
      produtosComFoto: ps.filter((p: any) => Boolean(p.foto_url)).length,
    },
    referencias: {
      linhas: linhas.count || 0,
      tipologias: ts.length,
      tipologiasMapeadas: ts.filter((t: any) => t.status_mapeamento === 'mapeada_exata').length,
      perfisHistoricos: cs.filter((c: any) => c.tipo === 'perfil').length,
      acessoriosHistoricos: cs.filter((c: any) => c.tipo === 'acessorio').length,
      vidros: vs.length,
      vidrosComImagem: vs.filter((v: any) => Boolean(v.imagem_url)).length,
    },
    apiProdutos: {
      snapshots: ss.length,
      comImagem: ss.filter((s: any) => Boolean(s.url_origem)).length,
      comLinha: ss.filter((s: any) => Boolean(s.linha_nome_wvetro)).length,
      erros: ss.filter((s: any) => Boolean(s.erro)).length,
    },
  }
}
