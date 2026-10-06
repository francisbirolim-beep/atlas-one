import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { autenticarUsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { consultarRecursoOperacionalWVetro } from '@/lib/wvetroOperacionalConsultaServer'
import { transformarPayloadWVetroEmStaging } from '@/lib/wvetroMigracaoOperacionalServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizarNomeClienteWVetro } from '@/lib/wvetroClienteIdentidade'
import { sincronizar } from '../sincronizar/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Historico = {
  id: string
  empresa_id: string
  cliente_id: string | null
  tipo_registro: string
  chave_externa: string
  numero_wvetro: string | null
  situacao_wvetro: string | null
  data_emissao: string | null
  data_venda: string | null
  valor_total: number | null
  cliente_nome_origem: string | null
  status_vinculo: string
  metodo_identidade: string | null
  itens: any[]
}

function txt(...vs: unknown[]) {
  for (const v of vs) {
    const s = String(v ?? '').trim()
    if (s) return s
  }
  return ''
}

function num(v: unknown) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  let s = String(v ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : []
}

function nomePayload(p: Record<string, any>) {
  return txt(p.PessoaNome, p.ClienteNome, p.NomeCliente, p.RazaoSocial, p.Nome)
}

function numeroPayload(p: Record<string, any>) {
  return txt(p.Nro, p.OrcamentoId, p.Orcamentoid)
}

function candidatoPorNome(clienteNome: string, origemNome: string) {
  const alvo = normalizarNomeClienteWVetro(clienteNome)
  const origem = normalizarNomeClienteWVetro(origemNome)
  if (!alvo || !origem) return null
  if (alvo === origem) return 'nome_exato' as const

  const primeiroAlvo = alvo.split(' ')[0] || ''
  const primeiroOrigem = origem.split(' ')[0] || ''
  if (primeiroAlvo.length >= 3 && primeiroAlvo === primeiroOrigem) return 'primeiro_nome' as const
  return null
}

function dataHistorico(h: Historico) {
  return txt(h.tipo_registro === 'venda_historica_pedido' ? h.data_venda : h.data_emissao, h.data_emissao, h.data_venda)
}

function itemHistoricoBruto(x: Record<string, any>, indice: number) {
  return {
    id: txt(x.Id, x.ItemId, x.id, indice + 1),
    nome: txt(x.Nome, x.Descricao, x.ProdutoDescricao, x.nome, x.descricao),
    linha: txt(x.Linha, x.LinhaNome, x.linha),
    modelo: txt(x.Modelo, x.modelo),
    codigo: txt(x.Codigo, x.ProdutoCodigo, x.codigo),
    largura: txt(x.Largura, x.LarguraMM, x.largura),
    altura: txt(x.Altura, x.AlturaMM, x.altura),
    ambiente: txt(x.Ambiente, x.ambiente),
    quantidade: txt(x.Qtde, x.Quantidade, x.quantidade, 1),
    valor_total: txt(x.ValorTotal, x.Total, x.valor_total),
    valor_total_alterado: txt(x.ValorTotalAlterado, x.valor_total_alterado),
  }
}

function itemAtlasHistorico(x: Record<string, any>, indice: number) {
  const largura = num(x.largura)
  const altura = num(x.altura)
  const quantidade = Math.max(1, Math.round(num(x.quantidade) || 1))
  const nome = txt(x.nome, x.modelo, x.codigo, `Item ${indice + 1}`)
  const modelo = txt(x.modelo, x.nome)
  const precoTotal = num(x.valor_total_alterado) || num(x.valor_total)

  return {
    id: randomUUID(),
    item_tipo: 'sob_medida',
    material_categoria: null,
    material_unidade: null,
    produto_nome: null,
    contramarco: null,
    ambiente: txt(x.ambiente) || null,
    tipo_esquadria: 'outro',
    tipo_outro_texto: modelo || nome,
    folhas: null,
    tipo_medida: 'comum',
    largura_mm: largura > 0 ? Math.round(largura) : null,
    altura_mm: altura > 0 ? Math.round(altura) : null,
    quantidade,
    foto_url: null,
    foto_urls: null,
    descricao: nome,
    observacao_tempera: null,
    observacao_producao: null,
    cor: null,
    produto_id: null,
    preco_unit: precoTotal > 0 ? precoTotal / quantidade : null,
    preco_total: precoTotal > 0 ? precoTotal : null,
    linha_id: null,
    linha_nome: txt(x.linha) || null,
    tipologia_id: null,
    configuracao_preset_id: null,
    configuracao_nome: [modelo || nome, txt(x.linha)].filter(Boolean).join(' · '),
    configuracao_validada: false,
    modo_configuracao: 'assistido',
    configuracao_status: 'pendente',
    variaveis: {
      wvetro_importado: 'sim',
      wvetro_historico_validado: 'sim',
      wvetro_ordem: String(indice + 1),
    },
    referencia_wvetro: null,
    wvetro_item: x,
    wvetro_composicao: { perfis: [], acessorios: [], vidros: [] },
  }
}

async function buscarCliente(usuario: { empresa_id: string }, clienteId: string) {
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('id,nome,cidade,whatsapp,telefone')
    .eq('id', clienteId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (error) throw error
  return data
}

async function capturarRecentesComoCandidatos(
  empresaId: string,
  clienteNome: string,
  usuario: { id: string; nome: string | null },
) {
  const fim = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 89)
  const ymd = (d: Date) => d.toISOString().slice(0, 10)

  const [payloadOrcamentos, payloadPedidos] = await Promise.all([
    consultarRecursoOperacionalWVetro('orcamentos', { inicio: ymd(inicio), fim: ymd(fim) }),
    consultarRecursoOperacionalWVetro('pedidos', { inicio: ymd(inicio), fim: ymd(fim) }),
  ])

  const fontes = [
    { tipo: 'orcamento_historico', recurso: 'orcamentos' as const, staging: transformarPayloadWVetroEmStaging('orcamentos', payloadOrcamentos) },
    { tipo: 'venda_historica_pedido', recurso: 'pedidos' as const, staging: transformarPayloadWVetroEmStaging('pedidos', payloadPedidos) },
  ]

  const rows: Record<string, any>[] = []
  for (const fonte of fontes) {
    for (const registro of fonte.staging.registros) {
      const p = registro.payload as Record<string, any>
      const nome = nomePayload(p)
      if (!candidatoPorNome(clienteNome, nome)) continue
      const numero = numeroPayload(p)
      if (!numero) continue
      const rawItens = arr(p.Itens).length ? arr(p.Itens) : arr(p.itens)
      rows.push({
        empresa_id: empresaId,
        cliente_id: null,
        tipo_registro: fonte.tipo,
        chave_externa: registro.chaveExterna,
        numero_wvetro: numero,
        situacao_wvetro: txt(p.Situacao, p.Status) || null,
        data_emissao: registro.dataReferencia,
        data_venda: fonte.tipo === 'venda_historica_pedido' ? registro.dataReferencia : null,
        valor_total: num(p.ValorTotal) || num(p.Total) || num(p.ValorBruto) || num(p.Valor) || null,
        cliente_nome_origem: nome,
        cliente_documento_origem: txt(p.PessoaCPFCNPJ, p.ClienteCPFCNPJ, p.CPFCNPJ, p.Documento) || null,
        cliente_codigo_origem: txt(p.ClienteCodigo, p.PessoaCodigo, p.PessoaId, p.ClienteId) || null,
        metodo_identidade: 'candidato_nome',
        status_vinculo: 'revisao',
        itens: rawItens.map((x, i) => itemHistoricoBruto((x && typeof x === 'object' ? x : {}) as Record<string, any>, i)),
        payload_origem: {
          fonte: 'wvetro_api_candidato',
          recurso: fonte.recurso,
          chave_externa: registro.chaveExterna,
          payload_hash: registro.payloadHash,
        },
        dados_origem: { candidato_medida_final: true },
        somente_historico: true,
        importado_por_id: usuario.id,
        importado_por_nome: usuario.nome,
        updated_at: new Date().toISOString(),
      })
    }
  }

  if (rows.length) {
    const { error } = await supabaseAdmin
      .from('wvetro_historico_comercial')
      .upsert(rows, {
        onConflict: 'empresa_id,tipo_registro,chave_externa',
        ignoreDuplicates: true,
      })
    if (error) throw error
  }

  return rows.length
}

async function listarCandidatos(usuario: any, cliente: any) {
  const primeiroNome = normalizarNomeClienteWVetro(cliente.nome).split(' ')[0] || ''
  let query = supabaseAdmin
    .from('wvetro_historico_comercial')
    .select('id,empresa_id,cliente_id,tipo_registro,chave_externa,numero_wvetro,situacao_wvetro,data_emissao,data_venda,valor_total,cliente_nome_origem,status_vinculo,metodo_identidade,itens')
    .eq('empresa_id', usuario.empresa_id)
    .eq('somente_historico', true)
    .not('numero_wvetro', 'is', null)
    .order('data_emissao', { ascending: false, nullsFirst: false })
    .limit(600)

  if (primeiroNome) query = query.ilike('cliente_nome_origem', `${primeiroNome}%`)
  const { data: historicos, error } = await query
  if (error) throw error

  const candidatosBase = ((historicos || []) as Historico[])
    .filter(h => !!candidatoPorNome(cliente.nome, h.cliente_nome_origem || ''))

  const ids = candidatosBase.map(h => h.id)
  const { data: validacoes, error: valError } = ids.length
    ? await supabaseAdmin
        .from('wvetro_cliente_orcamento_validacoes')
        .select('historico_id,status,validado_por_nome,validado_em')
        .eq('empresa_id', usuario.empresa_id)
        .eq('cliente_id', cliente.id)
        .in('historico_id', ids)
    : { data: [], error: null }
  if (valError) throw valError

  const validacaoPorHistorico = new Map((validacoes || []).map((v: any) => [String(v.historico_id), v]))

  const { data: operacionais, error: opError } = await supabaseAdmin
    .from('orcamentos')
    .select('id,wvetro_fluxo,cliente_id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('cliente_id', cliente.id)
    .contains('wvetro_fluxo', { origem: 'wvetro_api' })
    .neq('modo_entrada', 'wvetro_api_vinculado')
  if (opError) throw opError
  const operacionalPorNumero = new Map(
    (operacionais || [])
      .map((o: any) => [txt(o?.wvetro_fluxo?.numero), o])
      .filter(([n]) => !!n),
  )

  const rankTipo = (tipo: string) => tipo === 'venda_historica_pedido' ? 2 : 1
  const porNumero = new Map<string, any>()

  for (const h of candidatosBase) {
    const numero = txt(h.numero_wvetro)
    if (!numero) continue
    const validacao = validacaoPorHistorico.get(h.id) as any
    const vinculadoOutro = !!h.cliente_id && h.cliente_id !== cliente.id && h.status_vinculo === 'seguro'
    const aprovado = (validacao?.status === 'aprovado') || (h.cliente_id === cliente.id && h.status_vinculo === 'seguro')
    const rejeitado = validacao?.status === 'rejeitado'
    const item = {
      historicoId: h.id,
      numeroWvetro: numero,
      clienteNomeWvetro: h.cliente_nome_origem,
      tipoRegistro: h.tipo_registro,
      data: dataHistorico(h),
      valor: Number(h.valor_total || 0),
      situacao: h.situacao_wvetro,
      quantidadeItens: Array.isArray(h.itens) ? h.itens.length : 0,
      tipoCorrespondencia: candidatoPorNome(cliente.nome, h.cliente_nome_origem || ''),
      statusValidacao: rejeitado ? 'rejeitado' : aprovado ? 'aprovado' : vinculadoOutro ? 'outro_cliente' : 'pendente',
      validadoPor: validacao?.validado_por_nome || null,
      validadoEm: validacao?.validado_em || null,
      orcamentoAtlasId: operacionalPorNumero.get(numero)?.id || null,
    }

    const atual = porNumero.get(numero)
    if (!atual) {
      porNumero.set(numero, item)
      continue
    }
    const exatoAtual = atual.tipoCorrespondencia === 'nome_exato' ? 1 : 0
    const exatoNovo = item.tipoCorrespondencia === 'nome_exato' ? 1 : 0
    if (exatoNovo > exatoAtual || (exatoNovo === exatoAtual && rankTipo(h.tipo_registro) > rankTipo(atual.tipoRegistro))) {
      porNumero.set(numero, item)
    }
  }

  return Array.from(porNumero.values()).sort((a, b) => {
    if (a.statusValidacao === 'aprovado' && b.statusValidacao !== 'aprovado') return -1
    if (b.statusValidacao === 'aprovado' && a.statusValidacao !== 'aprovado') return 1
    return String(b.data || '').localeCompare(String(a.data || ''))
  })
}

async function garantirOrcamentoFallback(usuario: any, cliente: any, h: Historico) {
  const numero = txt(h.numero_wvetro)
  const { data: existentes, error: erroExistentes } = await supabaseAdmin
    .from('orcamentos')
    .select('id,cliente_id,wvetro_fluxo')
    .eq('empresa_id', usuario.empresa_id)
    .contains('wvetro_fluxo', { numero })
    .neq('modo_entrada', 'wvetro_api_vinculado')
    .limit(10)
  if (erroExistentes) throw erroExistentes

  const existente = (existentes || [])[0] as any
  if (existente) {
    if (existente.cliente_id && existente.cliente_id !== cliente.id) {
      throw new Error(`O W.Vetro #${numero} já está vinculado a outro Cliente 360.`)
    }
    if (!existente.cliente_id) {
      const fluxo = { ...(existente.wvetro_fluxo || {}), validacao_manual_cliente: true, historico_id: h.id }
      const { error } = await supabaseAdmin
        .from('orcamentos')
        .update({ cliente_id: cliente.id, cliente_nome: cliente.nome, wvetro_fluxo: fluxo, updated_at: new Date().toISOString() })
        .eq('id', existente.id)
        .eq('empresa_id', usuario.empresa_id)
      if (error) throw error
    }
    return existente.id
  }

  const itens = (Array.isArray(h.itens) ? h.itens : []).map((x: any, i: number) => itemAtlasHistorico(x || {}, i))
  const id = randomUUID()
  const { data: colunas } = await supabaseAdmin
    .from('kanban_colunas')
    .select('id,nome,ordem')
    .order('ordem')
  const coluna = (colunas || []).find((x: any) => normalizarNomeClienteWVetro(x.nome) === 'FAZER ORCAMENTO') || (colunas || [])[0] || null
  const dataRef = dataHistorico(h)

  const { error } = await supabaseAdmin.from('orcamentos').insert({
    id,
    empresa_id: usuario.empresa_id,
    cliente_id: cliente.id,
    cliente_nome: cliente.nome,
    cliente_whatsapp: cliente.whatsapp || cliente.telefone || null,
    cidade: cliente.cidade || null,
    origem: 'W.Vetro',
    tipo_esquadria: itens[0]?.tipo_esquadria || 'outro',
    largura_mm: itens[0]?.largura_mm || null,
    altura_mm: itens[0]?.altura_mm || null,
    quantidade: itens[0]?.quantidade || 1,
    acabamento: null,
    modo_entrada: 'wvetro_api',
    descricao_livre: null,
    valor_estimado: Number(h.valor_total || 0) || null,
    status: 'rascunho',
    contramarco: null,
    itens,
    fotos_urls: [],
    anexos: [],
    tipo_medida: 'comum',
    revisao_grupo_id: id,
    coluna_id: coluna?.id || null,
    coluna_atualizada_em: new Date().toISOString(),
    orcamento_iniciado_em: dataRef ? `${dataRef}T12:00:00Z` : null,
    criado_por_id: usuario.id,
    criado_por_nome: usuario.nome,
    wvetro_fluxo: {
      origem: 'wvetro_api',
      numero,
      fonte_registro: 'historico_validado',
      cliente_nome_wvetro: h.cliente_nome_origem,
      validacao_manual_cliente: true,
      historico_id: h.id,
      sincronizado_em: new Date().toISOString(),
      situacao: h.situacao_wvetro || null,
      mapeamento_versao: 3,
    },
  })
  if (error) throw error
  return id
}

async function aprovar(usuario: any, cliente: any, historicoId: string, req: NextRequest) {
  const { data: h, error } = await supabaseAdmin
    .from('wvetro_historico_comercial')
    .select('id,empresa_id,cliente_id,tipo_registro,chave_externa,numero_wvetro,situacao_wvetro,data_emissao,data_venda,valor_total,cliente_nome_origem,status_vinculo,metodo_identidade,itens')
    .eq('id', historicoId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (error) throw error
  if (!h) throw new Error('Candidato W.Vetro não encontrado.')

  const historico = h as Historico
  if (!candidatoPorNome(cliente.nome, historico.cliente_nome_origem || '')) {
    throw new Error('O nome deste candidato não corresponde ao cliente pesquisado.')
  }
  if (historico.cliente_id && historico.cliente_id !== cliente.id && historico.status_vinculo === 'seguro') {
    throw new Error('Este orçamento já está validado para outro Cliente 360.')
  }

  const agora = new Date().toISOString()
  const { error: valError } = await supabaseAdmin
    .from('wvetro_cliente_orcamento_validacoes')
    .upsert({
      empresa_id: usuario.empresa_id,
      cliente_id: cliente.id,
      historico_id: historico.id,
      numero_wvetro: historico.numero_wvetro,
      cliente_nome_origem: historico.cliente_nome_origem,
      status: 'aprovado',
      validado_por_id: usuario.id,
      validado_por_nome: usuario.nome,
      validado_em: agora,
      updated_at: agora,
    }, { onConflict: 'empresa_id,cliente_id,historico_id' })
  if (valError) throw valError

  const { error: histError } = await supabaseAdmin
    .from('wvetro_historico_comercial')
    .update({
      cliente_id: cliente.id,
      status_vinculo: 'seguro',
      metodo_identidade: 'validacao_manual_nome_numero',
      updated_at: agora,
    })
    .eq('id', historico.id)
    .eq('empresa_id', usuario.empresa_id)
  if (histError) throw histError

  const numero = txt(historico.numero_wvetro)
  const data = dataHistorico(historico)
  let sincronizacao: Record<string, any> | null = null
  if (numero && data) {
    const interna = new NextRequest(new URL('/api/integracoes/wvetro/orcamentos/sincronizar', req.nextUrl.origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inicio: data,
        fim: data,
        numerosWvetro: [numero],
        clienteAlvoId: cliente.id,
        vinculoManualValidado: true,
        forcar: true,
        modo: 'corrigir_tudo',
      }),
    })
    const resposta = await sincronizar(interna, usuario, 1)
    sincronizacao = await resposta.json().catch(() => ({}))
  }

  const orcamentoAtlasId = await garantirOrcamentoFallback(usuario, cliente, historico)
  return { historico, sincronizacao, orcamentoAtlasId }
}

async function rejeitar(usuario: any, cliente: any, historicoId: string) {
  const { data: h, error } = await supabaseAdmin
    .from('wvetro_historico_comercial')
    .select('id,numero_wvetro,cliente_nome_origem,cliente_id,status_vinculo')
    .eq('id', historicoId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (error) throw error
  if (!h) throw new Error('Candidato W.Vetro não encontrado.')
  if (h.cliente_id === cliente.id && h.status_vinculo === 'seguro') {
    throw new Error('Este orçamento já foi validado para o cliente. Use a revisão de vínculo antes de descartá-lo.')
  }

  const agora = new Date().toISOString()
  const { error: valError } = await supabaseAdmin
    .from('wvetro_cliente_orcamento_validacoes')
    .upsert({
      empresa_id: usuario.empresa_id,
      cliente_id: cliente.id,
      historico_id: h.id,
      numero_wvetro: h.numero_wvetro,
      cliente_nome_origem: h.cliente_nome_origem,
      status: 'rejeitado',
      validado_por_id: usuario.id,
      validado_por_nome: usuario.nome,
      validado_em: agora,
      updated_at: agora,
    }, { onConflict: 'empresa_id,cliente_id,historico_id' })
  if (valError) throw valError
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarUsuarioWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida ou sem acesso à integração W.Vetro.' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const clienteId = txt(body.clienteId)
  const acao = txt(body.acao) || 'buscar'
  const historicoId = txt(body.historicoId)
  if (!clienteId) return NextResponse.json({ error: 'Cliente não informado.' }, { status: 400 })

  try {
    const cliente = await buscarCliente(usuario, clienteId)
    if (!cliente) return NextResponse.json({ error: 'Cliente não encontrado nesta empresa.' }, { status: 404 })

    if (acao === 'aprovar') {
      if (!historicoId) return NextResponse.json({ error: 'Candidato não informado.' }, { status: 400 })
      const resultado = await aprovar(usuario, cliente, historicoId, req)
      const candidatos = await listarCandidatos(usuario, cliente)
      return NextResponse.json({
        ok: true,
        mensagem: `W.Vetro #${resultado.historico.numero_wvetro || '—'} validado para ${cliente.nome}.`,
        orcamentoAtlasId: resultado.orcamentoAtlasId,
        candidatos,
      })
    }

    if (acao === 'rejeitar') {
      if (!historicoId) return NextResponse.json({ error: 'Candidato não informado.' }, { status: 400 })
      await rejeitar(usuario, cliente, historicoId)
      const candidatos = await listarCandidatos(usuario, cliente)
      return NextResponse.json({
        ok: true,
        mensagem: 'Candidato descartado para este cliente. O histórico original do W.Vetro foi preservado.',
        candidatos,
      })
    }

    const recentesEncontrados = await capturarRecentesComoCandidatos(usuario.empresa_id, cliente.nome, usuario)
    const candidatos = await listarCandidatos(usuario, cliente)
    return NextResponse.json({
      ok: true,
      cliente: { id: cliente.id, nome: cliente.nome },
      recentesEncontrados,
      candidatos,
      pendentes: candidatos.filter((c: any) => c.statusValidacao === 'pendente').length,
      aprovados: candidatos.filter((c: any) => c.statusValidacao === 'aprovado').length,
      rejeitados: candidatos.filter((c: any) => c.statusValidacao === 'rejeitado').length,
    })
  } catch (e) {
    console.error('Erro ao validar candidato W.Vetro:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao consultar candidatos W.Vetro.' }, { status: 500 })
  }
}
