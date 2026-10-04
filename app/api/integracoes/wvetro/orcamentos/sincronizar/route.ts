import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro, type UsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { autenticarSchedulerWVetro } from '@/lib/wvetroSchedulerServer'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function obj(v: unknown): Record<string, any> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null
}
function txt(...vs: unknown[]) {
  for (const v of vs) { const s = String(v ?? '').trim(); if (s) return s }
  return ''
}
function num(...vs: unknown[]) {
  for (const v of vs) {
    if (v === null || v === undefined || v === '') continue
    if (typeof v === 'number' && Number.isFinite(v)) return v
    let s = String(v).trim().replace(/[^0-9,.-]/g, '')
    if (!s) continue
    const temVirgula = s.includes(',')
    const temPonto = s.includes('.')
    if (temVirgula && temPonto) {
      // W.Vetro pode devolver número em pt-BR: 1.234,56.
      // O último separador define a casa decimal; os demais são milhares.
      const ultimaVirgula = s.lastIndexOf(',')
      const ultimoPonto = s.lastIndexOf('.')
      if (ultimaVirgula > ultimoPonto) s = s.replace(/\./g, '').replace(',', '.')
      else s = s.replace(/,/g, '')
    } else if (temVirgula) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else if (temPonto) {
      const partes = s.split('.')
      if (partes.length > 2) s = partes.join('')
    }
    const n = Number(s)
    if (Number.isFinite(n)) return n
  }
  return 0
}
function norm(v: unknown) {
  return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()
}
function digitos(v: unknown) { return String(v ?? '').replace(/\D/g, '') }
function mm(v: unknown) {
  const n = num(v)
  if (n <= 0) return null
  return n > 0 && n < 20 ? Math.round(n * 1000) : Math.round(n)
}
function dataIso(v: unknown) {
  const s = txt(v)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}
function arr(v: unknown): any[] { return Array.isArray(v) ? v : [] }

type RefTipologia = {
  id: string
  linha_raw: string
  modelo_raw: string
  tipologia_atlas_id: string | null
  imagem_url: string | null
}
type RefLinha = { linha_raw: string; linha_tecnica_id: string | null }

function nomeCliente(p: Record<string, any>) {
  return txt(p.PessoaNome, p.ClienteNome, p.NomeCliente, p.RazaoSocial, p.Nome, 'Cliente W.Vetro')
}
function telefoneCliente(p: Record<string, any>) {
  return txt(p.PessoaCelular, p.ClienteCelular, p.Celular, p.PessoaTelefone, p.Telefone)
}
function documentoCliente(p: Record<string, any>) {
  return txt(p.PessoaCPFCNPJ, p.ClienteCPFCNPJ, p.ClienteCNPJ, p.CPFCNPJ, p.CpfCnpj, p.Documento)
}

function itemWVetro(
  item: Record<string, any>,
  indice: number,
  refs: Map<string, RefTipologia>,
  linhas: Map<string, RefLinha>,
  tipologias: Map<string, any>,
) {
  const linhaRaw = txt(item.Linha, item.LinhaNome, item.LinhaDescricao)
  const modeloRaw = txt(item.Modelo, item.Nome, item.Descricao, item.Codigo)
  const ref = refs.get(`${norm(linhaRaw)}|${norm(modeloRaw)}`) || null
  const tipologia = ref?.tipologia_atlas_id ? tipologias.get(ref.tipologia_atlas_id) : null
  const linha = linhas.get(norm(linhaRaw)) || null
  const largura = mm(item.Largura ?? item.LarguraMM ?? item.LarguraMm)
  const altura = mm(item.Altura ?? item.AlturaMM ?? item.AlturaMm)
  const quantidade = Math.max(1, Math.round(num(item.Qtde, item.Quantidade, 1) || 1))
  const perfis = arr(item.Perfil).length ? arr(item.Perfil) : arr(item.Perfis)
  const acessorios = arr(item.Acessorios).length ? arr(item.Acessorios) : arr(item.Acessórios)
  const vidros = arr(item.Vidros)
  const vidro = obj(vidros[0])
  const cor = txt(item.Cor, item.CorNome, item.Acabamento)
  const folhasMatch = modeloRaw.match(/(\d+)\s*folhas?/i)
  const folhas = txt(item.Folhas, folhasMatch?.[1])
  const id = randomUUID()
  const precoTotal = num(item.ValorTotal, item.Total)
  const precoUnit = num(item.ValorUnitario, item.ValorUnit, item.PrecoUnitario) || (precoTotal > 0 ? precoTotal / quantidade : 0)

  return {
    id,
    item_tipo: 'sob_medida',
    material_categoria: null,
    material_unidade: null,
    produto_nome: null,
    contramarco: txt(item.Contramarco) || null,
    ambiente: txt(item.Ambiente) || null,
    tipo_esquadria: tipologia?.chave || 'outro',
    tipo_outro_texto: tipologia ? null : (modeloRaw || null),
    folhas: folhas || null,
    tipo_medida: 'comum',
    largura_mm: largura,
    altura_mm: altura,
    quantidade,
    foto_url: null,
    foto_urls: null,
    descricao: txt(item.Descricao) || modeloRaw || undefined,
    observacao_tempera: null,
    observacao_producao: null,
    cor: cor || null,
    produto_id: null,
    preco_unit: precoUnit > 0 ? precoUnit : null,
    preco_total: precoTotal > 0 ? precoTotal : null,
    linha_id: linha?.linha_tecnica_id || null,
    linha_nome: linhaRaw || null,
    tipologia_id: ref?.tipologia_atlas_id || null,
    configuracao_preset_id: null,
    configuracao_nome: tipologia?.label || (modeloRaw ? `${modeloRaw}${linhaRaw ? ` (${linhaRaw})` : ''}` : null),
    configuracao_validada: false,
    modo_configuracao: 'assistido',
    configuracao_status: ref?.tipologia_atlas_id ? 'preenchida' : 'pendente',
    variaveis: {
      ...(folhas ? { folhas } : {}),
      ...(txt(vidro?.Especificacao, vidro?.Descricao) ? { vidro: txt(vidro?.Especificacao, vidro?.Descricao) } : {}),
      wvetro_importado: 'sim',
      wvetro_ordem: String(indice + 1),
    },
    referencia_wvetro: ref ? {
      referencia_id: ref.id,
      tipologia_id: ref.tipologia_atlas_id,
      linha: linhaRaw,
      modelo: modeloRaw,
      imagem_url: ref.imagem_url || null,
      utilizada_como_base: true,
      origem: 'orcamento_api',
    } : null,
    wvetro_item: item,
    wvetro_composicao: { perfis, acessorios, vidros },
  }
}

async function carregarContexto(empresaId: string) {
  const [refsR, linhasR, tipsR, clientesR, colunasR, orcR] = await Promise.all([
    supabaseAdmin.from('wvetro_referencias_tipologias').select('id,linha_raw,modelo_raw,tipologia_atlas_id,imagem_url'),
    supabaseAdmin.from('wvetro_referencias_linhas').select('linha_raw,linha_tecnica_id'),
    supabaseAdmin.from('tipologias').select('id,chave,label'),
    supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj,whatsapp,telefone').eq('empresa_id', empresaId),
    supabaseAdmin.from('kanban_colunas').select('id,nome,ordem').order('ordem'),
    supabaseAdmin.from('orcamentos').select('id,cliente_id,obra_id,wvetro_fluxo').eq('empresa_id', empresaId),
  ])
  for (const r of [refsR, linhasR, tipsR, clientesR, colunasR, orcR]) if (r.error) throw r.error

  const refs = new Map<string, RefTipologia>()
  for (const r of refsR.data || []) refs.set(`${norm(r.linha_raw)}|${norm(r.modelo_raw)}`, r as RefTipologia)
  const linhas = new Map<string, RefLinha>()
  for (const r of linhasR.data || []) linhas.set(norm(r.linha_raw), r as RefLinha)
  const tipologias = new Map<string, any>((tipsR.data || []).map((t: any) => [String(t.id), t]))

  const clientes = (clientesR.data || []) as any[]
  const porDoc = new Map<string, any[]>(), porFone = new Map<string, any[]>(), porNome = new Map<string, any[]>()
  for (const c of clientes) {
    const d = digitos(c.cpf_cnpj); if (d) porDoc.set(d, [...(porDoc.get(d) || []), c])
    const f = digitos(c.whatsapp || c.telefone); if (f) porFone.set(f.slice(-11), [...(porFone.get(f.slice(-11)) || []), c])
    const n = norm(c.nome); if (n) porNome.set(n, [...(porNome.get(n) || []), c])
  }
  const colunas = (colunasR.data || []) as any[]
  const coluna = colunas.find(c => norm(c.nome) === 'FAZER ORCAMENTO') || colunas[0] || null
  const existentes = new Map<string, any>()
  for (const o of orcR.data || []) {
    const fluxo = obj(o.wvetro_fluxo)
    const numero = txt(fluxo?.numero, fluxo?.numero_wvetro)
    if (numero) existentes.set(numero, o)
  }
  return { refs, linhas, tipologias, porDoc, porFone, porNome, coluna, existentes }
}

function acharCliente(p: Record<string, any>, ctx: Awaited<ReturnType<typeof carregarContexto>>) {
  const d = digitos(documentoCliente(p))
  if (d && ctx.porDoc.get(d)?.length === 1) return ctx.porDoc.get(d)![0]
  const f = digitos(telefoneCliente(p)).slice(-11)
  if (f && ctx.porFone.get(f)?.length === 1) return ctx.porFone.get(f)![0]
  const n = norm(nomeCliente(p))
  if (n && ctx.porNome.get(n)?.length === 1) return ctx.porNome.get(n)![0]
  return null
}

function adicionarClienteAoContexto(cliente: any, ctx: Awaited<ReturnType<typeof carregarContexto>>) {
  const d = digitos(cliente?.cpf_cnpj)
  if (d) ctx.porDoc.set(d, [...(ctx.porDoc.get(d) || []), cliente])
  const f = digitos(cliente?.whatsapp || cliente?.telefone).slice(-11)
  if (f) ctx.porFone.set(f, [...(ctx.porFone.get(f) || []), cliente])
  const n = norm(cliente?.nome)
  if (n) ctx.porNome.set(n, [...(ctx.porNome.get(n) || []), cliente])
}

async function garantirCliente(
  p: Record<string, any>,
  ctx: Awaited<ReturnType<typeof carregarContexto>>,
  empresaId: string,
) {
  const existente = acharCliente(p, ctx)
  if (existente) return { cliente: existente, criado: false }

  const nome = nomeCliente(p)
  if (!nome || norm(nome) === 'CLIENTE W.VETRO') return { cliente: null, criado: false }

  const documento = documentoCliente(p)
  const telefone = telefoneCliente(p)
  const nomeNorm = norm(nome)
  const homonimos = ctx.porNome.get(nomeNorm) || []
  if (!documento && !telefone && homonimos.length > 0) {
    return { cliente: null, criado: false }
  }

  const payload = {
    empresa_id: empresaId,
    nome,
    whatsapp: telefone || null,
    telefone: txt(p.PessoaTelefone, p.ClienteTelefone, p.Telefone) || null,
    cpf_cnpj: documento || null,
    cidade: txt(p.PessoaCidade, p.ClienteCidade, p.Cidade) || null,
    endereco: txt(p.PessoaEndereco, p.ClienteEndereco, p.Endereco) || null,
    bairro: txt(p.PessoaBairro, p.ClienteBairro, p.Bairro) || null,
    cep: txt(p.PessoaCEP, p.ClienteCEP, p.CEP, p.Cep) || null,
    email: txt(p.PessoaEmail, p.ClienteEmail, p.Email).toLowerCase() || null,
    origem: 'W.Vetro',
    observacoes: 'Cadastro criado automaticamente pela integração W.Vetro.',
  }

  const { data, error } = await supabaseAdmin
    .from('clientes')
    .insert(payload)
    .select('id,nome,cpf_cnpj,whatsapp,telefone')
    .single()
  if (error) throw error

  const cliente = { ...payload, ...data }
  adicionarClienteAoContexto(cliente, ctx)
  return { cliente, criado: true }
}

async function sincronizar(req: NextRequest, usuarioForcado?: UsuarioWVetro, diasPadrao = 7) {
  const usuario = usuarioForcado || await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })
  const body = await req.json().catch(() => ({})) as Record<string, any>
  const fim = txt(body.fim) || new Date().toISOString().slice(0, 10)
  const inicio = txt(body.inicio) || new Date(Date.now() - (Math.max(1, diasPadrao) - 1) * 86400000).toISOString().slice(0, 10)

  try {
    const payload = await consultarRecursoOperacionalWVetro('orcamentos', { inicio, fim })
    const staging = transformarPayloadWVetroEmStaging('orcamentos', payload)
    const ctx = await carregarContexto(usuario.empresa_id)
    let criados = 0, atualizados = 0, semAlteracao = 0, clientesVinculados = 0, clientesCriados = 0, itensMapeados = 0, itensPendentes = 0
    const resultados: any[] = []

    for (const registro of staging.registros) {
      const p = registro.payload
      const numeroW = txt(p.Nro, p.OrcamentoId, p.Orcamentoid)
      if (!numeroW) continue
      const rawItens = arr(p.Itens).length ? arr(p.Itens) : arr(p.itens)
      const itens = rawItens.map((x, i) => itemWVetro(obj(x) || {}, i, ctx.refs, ctx.linhas, ctx.tipologias))
      itensMapeados += itens.filter(i => i.tipologia_id).length
      itensPendentes += itens.filter(i => !i.tipologia_id).length
      const clienteResolvido = await garantirCliente(p, ctx, usuario.empresa_id)
      const cliente = clienteResolvido.cliente
      if (cliente) clientesVinculados += 1
      if (clienteResolvido.criado) clientesCriados += 1
      const nome = nomeCliente(p)
      const valor = num(p.ValorTotal, p.Total, p.Valor)
      const primeiro = itens[0] || {}
      const fluxo = {
        origem: 'wvetro_api',
        numero: numeroW,
        chave_externa: registro.chaveExterna,
        payload_hash: registro.payloadHash,
        data_referencia: registro.dataReferencia,
        sincronizado_em: new Date().toISOString(),
        situacao: txt(p.Situacao, p.Status) || null,
        vendedor: txt(p.VendedorNome, p.NomeVendedor) || null,
        cliente_codigo_wvetro: txt(p.ClienteCodigo, p.PessoaCodigo) || null,
        payload_bruto: p,
      }
      const existente = ctx.existentes.get(numeroW)
      if (existente) {
        const anterior = obj(existente.wvetro_fluxo)
        const mesmoPayload = txt(anterior?.payload_hash) === registro.payloadHash
        const clienteJaVinculado = !cliente?.id || existente.cliente_id === cliente.id
        if (mesmoPayload && clienteJaVinculado) {
          semAlteracao += 1
          resultados.push({ id: existente.id, numeroWvetro: numeroW, acao: 'sem_alteracao', cliente: nome, itens: itens.length })
          continue
        }
        const patch: any = {
          cliente_nome: nome,
          cliente_whatsapp: telefoneCliente(p) || null,
          cliente_id: cliente?.id || existente.cliente_id || null,
          itens,
          tipo_esquadria: primeiro.tipo_esquadria || 'outro',
          largura_mm: primeiro.largura_mm || null,
          altura_mm: primeiro.altura_mm || null,
          quantidade: primeiro.quantidade || 1,
          acabamento: txt(p.Cor, p.Acabamento) || null,
          valor_estimado: valor > 0 ? valor : null,
          updated_at: new Date().toISOString(),
          wvetro_fluxo: fluxo,
        }
        const { error } = await supabaseAdmin.from('orcamentos').update(patch).eq('id', existente.id).eq('empresa_id', usuario.empresa_id)
        if (error) throw error
        atualizados += 1
        resultados.push({ id: existente.id, numeroWvetro: numeroW, acao: 'atualizado', cliente: nome, itens: itens.length })
      } else {
        const id = randomUUID()
        const { error } = await supabaseAdmin.from('orcamentos').insert({
          id,
          empresa_id: usuario.empresa_id,
          cliente_id: cliente?.id || null,
          cliente_nome: nome,
          cliente_whatsapp: telefoneCliente(p) || null,
          cidade: txt(p.Cidade, p.PessoaCidade) || null,
          origem: 'W.Vetro',
          tipo_esquadria: primeiro.tipo_esquadria || 'outro',
          largura_mm: primeiro.largura_mm || null,
          altura_mm: primeiro.altura_mm || null,
          quantidade: primeiro.quantidade || 1,
          acabamento: txt(p.Cor, p.Acabamento) || null,
          modo_entrada: 'wvetro_api',
          descricao_livre: null,
          valor_estimado: valor > 0 ? valor : null,
          status: 'rascunho',
          contramarco: null,
          itens,
          fotos_urls: [],
          anexos: [],
          tipo_medida: 'comum',
          revisao_grupo_id: id,
          coluna_id: ctx.coluna?.id || null,
          coluna_atualizada_em: new Date().toISOString(),
          orcamento_iniciado_em: registro.dataReferencia ? `${registro.dataReferencia}T12:00:00Z` : null,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          wvetro_fluxo: fluxo,
        })
        if (error) throw error
        ctx.existentes.set(numeroW, { id, cliente_id: cliente?.id || null, obra_id: null, wvetro_fluxo: fluxo })
        criados += 1
        resultados.push({ id, numeroWvetro: numeroW, acao: 'criado', cliente: nome, itens: itens.length })
      }
    }

    return NextResponse.json({
      ok: true, inicio, fim,
      lidos: staging.registros.length,
      semChave: staging.semChave.length,
      criados, atualizados, semAlteracao,
      clientesVinculados, clientesCriados, itensMapeados, itensPendentes,
      resultados: resultados.slice(0, 100),
    })
  } catch (e) {
    console.error('Erro ao sincronizar orçamentos W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao sincronizar orçamentos W.Vetro.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) { return sincronizar(req) }

export async function GET(req: NextRequest) {
  const usuarioCron = await autenticarSchedulerWVetro(req)
  if (usuarioCron) {
    const diasSolicitados = Number(req.nextUrl.searchParams.get('dias') || 2)
    const dias = Math.min(7, Math.max(1, Number.isFinite(diasSolicitados) ? Math.round(diasSolicitados) : 2))
    return sincronizar(req, usuarioCron, dias)
  }

  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Acesso restrito ao Master.' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('orcamentos')
    .select('id,numero,cliente_nome,valor_estimado,updated_at,wvetro_fluxo,itens')
    .eq('empresa_id', usuario.empresa_id)
    .contains('wvetro_fluxo', { origem: 'wvetro_api' })
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    orcamentos: (data || []).map((o: any) => ({
      id: o.id,
      numeroAtlas: o.numero,
      numeroWvetro: txt(o.wvetro_fluxo?.numero),
      cliente: o.cliente_nome,
      valor: o.valor_estimado,
      itens: Array.isArray(o.itens) ? o.itens.length : 0,
      atualizadoEm: o.updated_at,
      situacaoWvetro: txt(o.wvetro_fluxo?.situacao) || null,
    })),
  })
}