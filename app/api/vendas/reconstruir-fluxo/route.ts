import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { autenticarMasterWVetro, type UsuarioWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sincronizar } from '@/app/api/integracoes/wvetro/orcamentos/sincronizar/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function txt(v: unknown) { return String(v ?? '').trim() }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0 }
function arr(v: unknown): any[] { return Array.isArray(v) ? v : [] }
function obj(v: unknown): Record<string, any> { return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : {} }

function tituloItem(item: any, indice: number) {
  return txt(item?.tipo_outro_texto) || txt(item?.configuracao_nome) || txt(item?.descricao) ||
    txt(item?.tipo_esquadria) || txt(item?.ambiente) || `Item ${indice + 1}`
}

function itemRef(item: any, indice: number) {
  return txt(item?.id) || `item-${indice + 1}`
}

async function carregarVenda(empresaId: string, vendaId: string) {
  const { data: venda, error } = await supabaseAdmin
    .from('vendas_obras')
    .select('id,empresa_id,numero,orcamento_id,cliente_id,obra_id,valor_venda,custo_previsto,itens_snapshot,config_snapshot,versao,status')
    .eq('empresa_id', empresaId)
    .eq('id', vendaId)
    .maybeSingle()
  if (error) throw error
  if (!venda) throw new Error('Venda não encontrada nesta empresa.')

  const [{ data: orcamento, error: erroOrc }, { data: cliente, error: erroCliente }, { data: revisao, error: erroRev }] = await Promise.all([
    supabaseAdmin.from('orcamentos').select('*').eq('empresa_id', empresaId).eq('id', venda.orcamento_id).maybeSingle(),
    supabaseAdmin.from('clientes').select('id,nome,cidade,endereco,bairro,cep').eq('empresa_id', empresaId).eq('id', venda.cliente_id).maybeSingle(),
    supabaseAdmin.from('venda_obra_revisoes').select('id,versao,depois,created_at').eq('empresa_id', empresaId).eq('venda_obra_id', venda.id).order('versao', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (erroOrc) throw erroOrc
  if (erroCliente) throw erroCliente
  if (erroRev) throw erroRev
  if (!orcamento || !cliente) throw new Error('Orçamento ou cliente da venda não encontrado.')
  return { venda, orcamento, cliente, revisao }
}

function estadoAtualVenda(venda: any, revisao: any) {
  if (revisao?.depois && typeof revisao.depois === 'object') return revisao.depois
  return {
    valor_venda: venda.valor_venda,
    custo_previsto: venda.custo_previsto,
    itens_snapshot: arr(venda.itens_snapshot),
    config_snapshot: obj(venda.config_snapshot),
    versao: Number(venda.versao || 1),
  }
}

async function escolherHistorico(empresaId: string, venda: any, estado: any, numeroSolicitado?: string) {
  let q = supabaseAdmin
    .from('wvetro_orcamentos_historico')
    .select('id,wvetro_numero,cliente_id,cliente_nome,cidade,obra_nome,situacao,data_emissao,data_venda,valor_total,custo_com_sobra,custo_sem_sobra,total_m2,itens_qtd,match_status,match_confianca')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', venda.cliente_id)
    .order('data_venda', { ascending: false, nullsFirst: false })
    .order('data_emissao', { ascending: false, nullsFirst: false })
    .limit(30)
  if (numeroSolicitado) q = q.eq('wvetro_numero', numeroSolicitado)
  const { data, error } = await q
  if (error) throw error
  const lista = data || []
  if (!lista.length) throw new Error('Não encontrei histórico W.Vetro vinculado a este cliente.')

  const itensVenda = arr(estado?.itens_snapshot).length
  const valorVenda = num(estado?.valor_venda || venda.valor_venda)
  const pontuados = lista.map((h: any) => {
    let score = 0
    if (String(h.situacao || '').toUpperCase() === 'V') score += 60
    if (itensVenda > 0 && Number(h.itens_qtd || 0) === itensVenda) score += 50
    const vh = num(h.valor_total)
    const dif = valorVenda > 0 && vh > 0 ? Math.abs(vh - valorVenda) / valorVenda : 1
    if (dif <= 0.02) score += 40
    else if (dif <= 0.05) score += 30
    else if (dif <= 0.15) score += 10
    if (String(h.match_status || '') === 'vinculado') score += 10
    score += Math.min(10, num(h.match_confianca) * 10)
    return { ...h, score, diferencaValorPct: dif * 100 }
  }).sort((a: any, b: any) => b.score - a.score)

  const melhor: any = pontuados[0]
  const segundo: any = pontuados[1]
  if (!numeroSolicitado && segundo && melhor.score - segundo.score < 20) {
    return { ambiguo: true as const, candidatos: pontuados.slice(0, 5) }
  }
  return { ambiguo: false as const, historico: melhor, candidatos: pontuados.slice(0, 5) }
}

async function garantirObra(empresaId: string, usuario: UsuarioWVetro, venda: any, orcamento: any, cliente: any, historico: any) {
  const obraExistenteId = venda.obra_id || orcamento.obra_id
  if (obraExistenteId) {
    const { data } = await supabaseAdmin.from('obras').select('id,nome,numero').eq('empresa_id', empresaId).eq('id', obraExistenteId).maybeSingle()
    if (data) return data
  }

  const nome = txt(historico?.obra_nome) || `Obra W.Vetro #${txt(historico?.wvetro_numero) || orcamento.numero || venda.numero || ''}`
  const { data: existente } = await supabaseAdmin
    .from('obras')
    .select('id,nome,numero')
    .eq('empresa_id', empresaId)
    .eq('cliente_id', venda.cliente_id)
    .ilike('nome', nome)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existente) return existente

  const { data: criada, error } = await supabaseAdmin.from('obras').insert({
    empresa_id: empresaId,
    cliente_id: venda.cliente_id,
    nome,
    status: 'planejamento',
    cidade: txt(historico?.cidade) || cliente.cidade || orcamento.cidade || null,
    endereco: cliente.endereco || null,
    bairro: cliente.bairro || null,
    cep: cliente.cep || null,
    observacoes: `Obra reconstruída a partir do histórico W.Vetro #${historico?.wvetro_numero || '—'}.`,
    criado_por_id: usuario.id,
    criado_por_nome: usuario.nome || 'Master',
  }).select('id,nome,numero').single()
  if (error) throw error
  return criada
}

async function registrarRevisaoTecnica(empresaId: string, usuario: UsuarioWVetro, venda: any, revisao: any, itens: any[], numeroWvetro: string) {
  const antes = estadoAtualVenda(venda, revisao)
  const configAntes = obj(antes?.config_snapshot)
  const jaReconstruido =
    txt(configAntes.wvetro_numero) === numeroWvetro &&
    arr(antes?.itens_snapshot).some((i: any) => Object.keys(obj(i?.wvetro_composicao)).length > 0)

  if (jaReconstruido) return { criada: false, versao: Number(antes?.versao || venda.versao || 1) }

  const versaoAtual = Math.max(Number(venda.versao || 1), Number(revisao?.versao || 0), Number(antes?.versao || 0))
  const versao = versaoAtual + 1
  const depois = {
    ...antes,
    itens_snapshot: itens,
    config_snapshot: {
      ...configAntes,
      wvetro_numero: numeroWvetro,
      wvetro_origem_reconstrucao: 'historico_validado',
      wvetro_reconstruido_em: new Date().toISOString(),
    },
    versao,
  }

  const { error: erroRev } = await supabaseAdmin.from('venda_obra_revisoes').insert({
    empresa_id: empresaId,
    venda_obra_id: venda.id,
    versao,
    tipo: 'ajuste',
    justificativa: `Reconstrução técnica auditável a partir do W.Vetro #${numeroWvetro}; valor financeiro original da venda preservado.`,
    antes,
    depois,
    impacto_valor: 0,
    impacto_custo: 0,
    criado_por_id: usuario.id,
    criado_por_nome: usuario.nome || 'Master',
  })
  if (erroRev) throw erroRev

  const { error: erroVenda } = await supabaseAdmin.from('vendas_obras').update({ versao, updated_at: new Date().toISOString() })
    .eq('empresa_id', empresaId).eq('id', venda.id)
  if (erroVenda) throw erroVenda
  return { criada: true, versao }
}

async function garantirOrdens(empresaId: string, usuario: UsuarioWVetro, venda: any, obraId: string, itens: any[]) {
  const { data: existentes, error } = await supabaseAdmin.from('ordens_producao').select('id,item_ref,tipo_producao,status')
    .eq('empresa_id', empresaId).eq('venda_obra_id', venda.id)
  if (error) throw error
  const mapa = new Map((existentes || []).map((o: any) => [`${o.item_ref}|${o.tipo_producao}`, o]))
  let criadas = 0
  let atualizadas = 0

  for (let i = 0; i < itens.length; i += 1) {
    const item = itens[i]
    const ref = itemRef(item, i)
    const chave = `${ref}|esquadria`
    const payload = {
      empresa_id: empresaId,
      cliente_id: venda.cliente_id,
      obra_id: obraId,
      venda_obra_id: venda.id,
      orcamento_id: venda.orcamento_id,
      item_ref: ref,
      item_snapshot: item,
      tipo_producao: 'esquadria',
      titulo: tituloItem(item, i),
      quantidade: Math.max(1, num(item?.quantidade) || 1),
      largura_mm: num(item?.largura_mm) || null,
      altura_mm: num(item?.altura_mm) || null,
      origem: 'reconstrucao_wvetro',
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome || 'Master',
    }
    const existente: any = mapa.get(chave)
    if (existente) {
      const { error: e } = await supabaseAdmin.from('ordens_producao').update({
        cliente_id: payload.cliente_id,
        obra_id: payload.obra_id,
        item_snapshot: payload.item_snapshot,
        titulo: payload.titulo,
        quantidade: payload.quantidade,
        largura_mm: payload.largura_mm,
        altura_mm: payload.altura_mm,
        updated_at: new Date().toISOString(),
      }).eq('empresa_id', empresaId).eq('id', existente.id)
      if (e) throw e
      atualizadas += 1
    } else {
      const { error: e } = await supabaseAdmin.from('ordens_producao').insert({
        ...payload,
        status: 'aguardando',
        bloqueada: true,
        bloqueio_motivo: 'Aguardando conferência da Medição Final e liberação dos materiais',
      })
      if (e) throw e
      criadas += 1
    }
  }
  return { criadas, atualizadas }
}

async function materializarCompras(empresaId: string, usuario: UsuarioWVetro, venda: any, obra: any) {
  const { data: pacote, error: erroPacote } = await supabaseAdmin.from('pacotes_tecnicos').select('id,status')
    .eq('empresa_id', empresaId).eq('orcamento_id', venda.orcamento_id).neq('status', 'substituido')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (erroPacote) throw erroPacote
  if (!pacote) throw new Error('Gere o pacote técnico antes de alimentar Compras.')

  const [{ data: linhas, error: erroLinhas }, { data: existentes, error: erroExistentes }] = await Promise.all([
    supabaseAdmin.from('pacote_tecnico_compras').select('*').eq('empresa_id', empresaId).eq('pacote_id', pacote.id).eq('excluido', false),
    supabaseAdmin.from('compras_necessidades').select('id,status,observacoes').eq('empresa_id', empresaId).eq('obra_id', obra.id),
  ])
  if (erroLinhas) throw erroLinhas
  if (erroExistentes) throw erroExistentes

  const porMarcador = new Map<string, any>()
  for (const ex of existentes || []) {
    const m = String(ex.observacoes || '').match(/\[pacote_compra:([^\]]+)\]/)
    if (m?.[1]) porMarcador.set(m[1], ex)
  }

  let criadas = 0
  let atualizadas = 0
  for (const linha of linhas || []) {
    const quantidade = Math.max(0, num(linha.quantidade_ajustada))
    if (quantidade <= 0) continue
    const marcador = `[pacote_compra:${linha.id}]`
    const base = {
      produto_id: linha.produto_id || null,
      descricao: linha.descricao,
      categoria: linha.categoria,
      quantidade,
      unidade: linha.unidade || 'UN',
      cliente_id: venda.cliente_id,
      cliente_nome: null,
      obra_id: obra.id,
      obra_nome: obra.nome,
      obra_referencia: obra.nome,
      destino: 'obra',
      observacoes: `Gerado do pacote técnico ${pacote.id}. ${marcador}`,
      atualizado_em: undefined,
    }
    const ex = porMarcador.get(String(linha.id))
    if (ex) {
      if (['necessidade', 'cotacao'].includes(String(ex.status || '').toLowerCase())) {
        const { error: e } = await supabaseAdmin.from('compras_necessidades').update({
          produto_id: base.produto_id,
          descricao: base.descricao,
          categoria: base.categoria,
          quantidade: base.quantidade,
          unidade: base.unidade,
          obra_nome: base.obra_nome,
          obra_referencia: base.obra_referencia,
          observacoes: base.observacoes,
          updated_at: new Date().toISOString(),
        }).eq('empresa_id', empresaId).eq('id', ex.id)
        if (e) throw e
        atualizadas += 1
      }
      continue
    }
    const { error: e } = await supabaseAdmin.from('compras_necessidades').insert({
      empresa_id: empresaId,
      ...base,
      cliente_nome: undefined,
      atualizado_em: undefined,
      status: 'necessidade',
      prioridade: 'normal',
      criado_por_id: usuario.id,
      criado_por_nome: usuario.nome || 'Master',
    })
    if (e) throw e
    criadas += 1
  }
  return { pacoteId: pacote.id, criadas, atualizadas, totalLinhas: (linhas || []).filter((l: any) => num(l.quantidade_ajustada) > 0).length }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) return NextResponse.json({ error: 'Esta reconstrução histórica é restrita ao Master.' }, { status: 401 })

  try {
    const body = await req.json().catch(() => ({})) as Record<string, any>
    const vendaId = txt(body.vendaId)
    const acao = txt(body.acao) || 'preparar'
    if (!vendaId) return NextResponse.json({ error: 'Venda não informada.' }, { status: 400 })

    const base = await carregarVenda(usuario.empresa_id, vendaId)
    const estado = estadoAtualVenda(base.venda, base.revisao)

    if (acao === 'preparar') {
      const escolha = await escolherHistorico(usuario.empresa_id, base.venda, estado, txt(body.numeroWvetro) || undefined)
      if (escolha.ambiguo) {
        return NextResponse.json({
          error: 'Encontrei mais de um orçamento W.Vetro possível. Escolha o número correto antes de reconstruir.',
          code: 'wvetro_ambiguo',
          candidatos: escolha.candidatos,
        }, { status: 409 })
      }
      const h: any = escolha.historico
      const numeroWvetro = String(h.wvetro_numero)

      const fluxoAntes = obj(base.orcamento.wvetro_fluxo)
      const { error: preErro } = await supabaseAdmin.from('orcamentos').update({
        wvetro_fluxo: {
          ...fluxoAntes,
          numero: numeroWvetro,
          origem: 'wvetro_vinculo_historico',
          historico_id: h.id,
          vinculo_solicitado_em: new Date().toISOString(),
          vinculo_solicitado_por_id: usuario.id,
          vinculo_solicitado_por_nome: usuario.nome,
        },
        updated_at: new Date().toISOString(),
      }).eq('empresa_id', usuario.empresa_id).eq('id', base.orcamento.id)
      if (preErro) throw preErro

      const inicio = h.data_emissao || h.data_venda
      const fim = h.data_venda || h.data_emissao
      if (!inicio || !fim) throw new Error('O histórico W.Vetro não possui período válido para reconstrução.')

      const reqSync = new NextRequest(new URL('/api/integracoes/wvetro/orcamentos/sincronizar', req.nextUrl.origin), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          inicio,
          fim,
          forcar: true,
          numerosWvetro: [numeroWvetro],
          modo: 'reconstruir_venda_historica',
          clienteAlvoId: base.venda.cliente_id,
          vinculoManualValidado: true,
        }),
      })
      const respSync = await sincronizar(reqSync, usuario, 7)
      const jsonSync = await respSync.json().catch(() => ({}))
      if (!respSync.ok) throw new Error(jsonSync?.error || 'Falha ao buscar composição histórica no W.Vetro.')

      const { data: orcAtual, error: erroAtual } = await supabaseAdmin.from('orcamentos').select('*')
        .eq('empresa_id', usuario.empresa_id).eq('id', base.orcamento.id).single()
      if (erroAtual) throw erroAtual
      const itens = arr(orcAtual.itens)
      const comComposicao = itens.filter((i: any) => {
        const c = obj(i?.wvetro_composicao)
        return arr(c.perfis).length + arr(c.acessorios).length + arr(c.vidros).length > 0
      }).length
      if (!itens.length || !comComposicao) {
        throw new Error('O W.Vetro respondeu o orçamento, mas não devolveu a composição de perfis/acessórios/vidros. Nada foi inventado; confira a fonte antes de seguir.')
      }

      const obra = await garantirObra(usuario.empresa_id, usuario, base.venda, orcAtual, base.cliente, h)
      const agora = new Date().toISOString()
      const fluxoAtual = {
        ...obj(orcAtual.wvetro_fluxo),
        historico_id: h.id,
        obra_nome_historico: h.obra_nome || null,
        custo_com_sobra_referencia: h.custo_com_sobra ?? null,
        custo_sem_sobra_referencia: h.custo_sem_sobra ?? null,
        valor_historico: h.valor_total ?? null,
        reconstruido_em: agora,
      }
      const [{ error: erroOrcObra }, { error: erroVendaObra }] = await Promise.all([
        supabaseAdmin.from('orcamentos').update({ obra_id: obra.id, wvetro_fluxo: fluxoAtual, updated_at: agora }).eq('empresa_id', usuario.empresa_id).eq('id', base.orcamento.id),
        supabaseAdmin.from('vendas_obras').update({ obra_id: obra.id, updated_at: agora }).eq('empresa_id', usuario.empresa_id).eq('id', base.venda.id),
      ])
      if (erroOrcObra) throw erroOrcObra
      if (erroVendaObra) throw erroVendaObra

      const revisao = await registrarRevisaoTecnica(usuario.empresa_id, usuario, base.venda, base.revisao, itens, numeroWvetro)
      const ordens = await garantirOrdens(usuario.empresa_id, usuario, base.venda, obra.id, itens)

      return NextResponse.json({
        ok: true,
        acao,
        obra,
        numeroWvetro,
        historico: {
          valor: h.valor_total,
          custoComSobra: h.custo_com_sobra,
          custoSemSobra: h.custo_sem_sobra,
          itens: h.itens_qtd,
          dataVenda: h.data_venda,
        },
        vendaValorPreservado: base.venda.valor_venda,
        itens: itens.length,
        itensComComposicao: comComposicao,
        revisaoCriada: revisao.criada,
        versaoVenda: revisao.versao,
        ordens,
        mensagem: `W.Vetro #${numeroWvetro} vinculado. Obra, revisão técnica e ${itens.length} item(ns) de produção preparados sem alterar o valor financeiro da venda.`,
      })
    }

    if (acao === 'materializar_compras') {
      const obraId = base.venda.obra_id || base.orcamento.obra_id
      if (!obraId) throw new Error('A venda ainda não está vinculada a uma obra.')
      const { data: obra, error: erroObra } = await supabaseAdmin.from('obras').select('id,nome,numero').eq('empresa_id', usuario.empresa_id).eq('id', obraId).maybeSingle()
      if (erroObra) throw erroObra
      if (!obra) throw new Error('Obra vinculada não encontrada.')
      const compras = await materializarCompras(usuario.empresa_id, usuario, base.venda, obra)
      return NextResponse.json({
        ok: true,
        acao,
        compras,
        mensagem: `${compras.totalLinhas} linha(s) do pacote técnico sincronizadas com Compras da obra.`,
      })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro ao reconstruir fluxo da venda:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao reconstruir fluxo da venda.' }, { status: 500 })
  }
}
