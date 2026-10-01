import { NextRequest, NextResponse } from 'next/server'
import { autenticarMasterWVetro } from '@/lib/wvetroAcessoServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(valor: unknown) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

function custoOficial(valor: unknown) {
  const bruto = typeof valor === 'string' ? valor.replace(',', '.') : valor
  const numero = Number(bruto)
  return Number.isFinite(numero) && numero > 0 ? Number(numero.toFixed(4)) : null
}

function normalizar(valor: unknown) {
  return texto(valor).normalize('NFC').toLocaleUpperCase('pt-BR')
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarMasterWVetro(req)
  if (!usuario) {
    return NextResponse.json({ error: 'Acesso restrito a usuário master.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Corpo JSON inválido.' }, { status: 400 })
  }

  if (body.confirmar !== true) {
    return NextResponse.json(
      { error: 'A homologação exige confirmação explícita do usuário Master.' },
      { status: 400 },
    )
  }

  const referenciaChave = texto(body.referenciaChave)
  const custo = custoOficial(body.custoOficial)
  const observacaoUsuario = texto(body.observacoes).slice(0, 500)

  if (!referenciaChave) {
    return NextResponse.json({ error: 'Referência W.Vetro do vidro não informada.' }, { status: 400 })
  }
  if (custo == null) {
    return NextResponse.json({ error: 'Informe um custo oficial por m² maior que zero.' }, { status: 400 })
  }

  const { data: referencias, error: referenciaErro } = await supabaseAdmin
    .from('wvetro_referencias_vidros')
    .select('id,chave,codigo,especificacao,status_validacao,produto_atlas_id,dados_origem')
    .eq('chave', referenciaChave)
    .limit(2)

  if (referenciaErro) {
    return NextResponse.json(
      { error: `Falha ao localizar referência W.Vetro: ${referenciaErro.message}` },
      { status: 502 },
    )
  }
  if (!referencias?.length) {
    return NextResponse.json({ error: 'Referência de vidro W.Vetro não encontrada.' }, { status: 404 })
  }
  if (referencias.length !== 1) {
    return NextResponse.json(
      { error: 'Referência ambígua. A homologação foi bloqueada para revisão.' },
      { status: 409 },
    )
  }

  const referencia = referencias[0]
  const especificacao = texto(referencia.especificacao)

  if (!especificacao || normalizar(especificacao) === 'SEM VIDRO') {
    return NextResponse.json(
      { error: '“SEM VIDRO” não é material e não pode ser homologado no catálogo de custos.' },
      { status: 400 },
    )
  }

  const chaveCatalogo = `wvetro_vidro:${usuario.empresa_id}:${referencia.chave}`
  const observacoes = [
    'Homologado manualmente a partir da referência W.Vetro.',
    'O custo oficial foi informado e confirmado por usuário Master; valores históricos W.Vetro são apenas evidência.',
    observacaoUsuario || null,
  ].filter(Boolean).join(' ')

  const { data: existente, error: existenteErro } = await supabaseAdmin
    .from('catalogo_custos_tecnicos')
    .select('id')
    .eq('empresa_id', usuario.empresa_id)
    .eq('categoria', 'vidro')
    .eq('chave', chaveCatalogo)
    .eq('ativo', true)
    .maybeSingle()

  if (existenteErro) {
    return NextResponse.json(
      { error: `Falha ao verificar catálogo técnico: ${existenteErro.message}` },
      { status: 502 },
    )
  }

  let catalogoId = existente?.id ? String(existente.id) : ''

  if (catalogoId) {
    const { error } = await supabaseAdmin
      .from('catalogo_custos_tecnicos')
      .update({
        codigo: texto(referencia.codigo) || null,
        descricao: especificacao,
        unidade: 'M2',
        custo_unitario: custo,
        observacoes,
        atualizado_por_id: usuario.id,
        atualizado_por_nome: usuario.nome,
        updated_at: new Date().toISOString(),
      })
      .eq('id', catalogoId)
      .eq('empresa_id', usuario.empresa_id)

    if (error) {
      return NextResponse.json(
        { error: `Falha ao atualizar custo oficial do vidro: ${error.message}` },
        { status: 502 },
      )
    }
  } else {
    const { data: criado, error } = await supabaseAdmin
      .from('catalogo_custos_tecnicos')
      .insert({
        empresa_id: usuario.empresa_id,
        categoria: 'vidro',
        produto_id: referencia.produto_atlas_id || null,
        chave: chaveCatalogo,
        codigo: texto(referencia.codigo) || null,
        descricao: especificacao,
        unidade: 'M2',
        custo_unitario: custo,
        ativo: true,
        observacoes,
        atualizado_por_id: usuario.id,
        atualizado_por_nome: usuario.nome,
      })
      .select('id')
      .single()

    if (error || !criado?.id) {
      return NextResponse.json(
        { error: `Falha ao criar custo oficial do vidro: ${error?.message || 'registro não retornado'}` },
        { status: 502 },
      )
    }
    catalogoId = String(criado.id)
  }

  const dadosOrigem =
    referencia.dados_origem && typeof referencia.dados_origem === 'object'
      ? referencia.dados_origem as Record<string, unknown>
      : {}

  const { error: atualizarReferenciaErro } = await supabaseAdmin
    .from('wvetro_referencias_vidros')
    .update({
      status_validacao: 'validado_atlas',
      dados_origem: {
        ...dadosOrigem,
        homologacao_atlas: {
          empresa_id: usuario.empresa_id,
          catalogo_custo_id: catalogoId,
          custo_oficial_m2: custo,
          unidade: 'M2',
          homologado_por_id: usuario.id,
          homologado_por_nome: usuario.nome,
          homologado_em: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', referencia.id)

  if (atualizarReferenciaErro) {
    return NextResponse.json(
      {
        error:
          'O custo oficial foi salvo no catálogo, mas a referência W.Vetro não pôde ser marcada como homologada. Repetir a operação é seguro.',
        detalhe: atualizarReferenciaErro.message,
        catalogoId,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    especificacao,
    referenciaChave,
    catalogoId,
    categoria: 'vidro',
    unidade: 'M2',
    custoOficial: custo,
    statusValidacao: 'validado_atlas',
    idempotente: true,
  })
}
