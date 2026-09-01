import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  listarOrcamentosWVetro,
  listarPedidosWVetro,
  listarProdutosWVetroPorTipo,
} from '@/lib/wvetroApi'

function txt(v: unknown) { return String(v ?? '').trim() }
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

type ItemHistorico = { linha: string; modelo: string; raw: Record<string, unknown> }
function itensHistoricos(payload: unknown, out: ItemHistorico[] = []) {
  if (Array.isArray(payload)) { payload.forEach(v => itensHistoricos(v, out)); return out }
  if (!payload || typeof payload !== 'object') return out
  const o = payload as Record<string, unknown>
  const linha = txt(o.Linha ?? o.linha)
  const modelo = txt(o.Modelo ?? o.modelo)
  if (linha && modelo) out.push({ linha, modelo, raw: o })
  Object.values(o).forEach(v => itensHistoricos(v, out))
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
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id,chave,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url'),
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
  const codigo = txt(o.SeuCodigo ?? o.seuCodigo ?? o.Codigo ?? o.codigo)
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
  const itens = [...itensHistoricos(pedidos), ...itensHistoricos(orcamentos)]
  const { mapa: produtos } = await indiceProdutos()
  const { refsMap, tipMap } = await indiceTipologias()
  const refsUsadas = new Set<string>()
  const agregados = new Map<string, any>()

  for (const item of itens) {
    const { ref, tip } = await garantirReferencia(item.linha, item.modelo, urlImagem(item.raw), data, refsMap, tipMap)
    refsUsadas.add(ref.id)
    const grupos: Array<['perfil' | 'acessorio' | 'vidro', unknown[]]> = [
      ['perfil', arr(item.raw, ['Perfil', 'Perfis'])],
      ['acessorio', arr(item.raw, ['Acessorios', 'Acessórios'])],
      ['vidro', arr(item.raw, ['Vidro', 'Vidros'])],
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
  await sincronizarCustosProdutosWVetro()
  return { data, itens: itens.length, tipologias: refsUsadas.size, componentes: linhas.length }
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

export async function resumoBaseTecnicaWVetro() {
  const [bom, mapeados, custos, imgs, tips] = await Promise.all([
    supabaseAdmin.from('wvetro_tipologia_componentes').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('wvetro_tipologia_componentes').select('id', { count: 'exact', head: true }).not('produto_atlas_id', 'is', null),
    supabaseAdmin.from('produtos').select('id', { count: 'exact', head: true }).not('custo_wvetro_ultimo', 'is', null),
    supabaseAdmin.from('produtos').select('id', { count: 'exact', head: true }).not('foto_url', 'is', null).eq('origem', 'wvetro'),
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id', { count: 'exact', head: true }),
  ])
  return { componentesPorTipologia: bom.count || 0, componentesMapeados: mapeados.count || 0, produtosComCustoWvetro: custos.count || 0, produtosWvetroComFoto: imgs.count || 0, tipologiasReferencia: tips.count || 0 }
}
