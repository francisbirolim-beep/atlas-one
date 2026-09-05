import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras, type UsuarioCompras } from '@/lib/comprasServer'
import { arredondarMoeda, precoPorMargemReal } from '@/lib/precificacaoBalcao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function texto(v: unknown, max = 500) { return String(v ?? '').trim().slice(0, max) }
function digitos(v: unknown) { return String(v ?? '').replace(/\D/g, '') }
function numero(v: unknown) {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function fornecedor(body: any, usuario: UsuarioCompras) {
  const id = texto(body.fornecedorId, 80)
  if (id) {
    const { data } = await supabaseAdmin
      .from('fornecedores')
      .select('id,nome,cnpj_cpf')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', id)
      .maybeSingle()
    if (data) return data
  }
  const cnpj = digitos(body.fornecedorCnpj)
  if (cnpj) {
    const { data } = await supabaseAdmin
      .from('fornecedores')
      .select('id,nome,cnpj_cpf')
      .eq('empresa_id', usuario.empresa_id)
      .not('cnpj_cpf','is',null)
    const achou = (data || []).find(f => digitos(f.cnpj_cpf) === cnpj)
    if (achou) return achou
  }
  const nome = texto(body.fornecedorNome, 250)
  if (!nome && !cnpj) throw new Error('Informe o fornecedor antes de cadastrar/vincular o produto.')
  const { data, error } = await supabaseAdmin.from('fornecedores').insert({
    empresa_id: usuario.empresa_id,
    nome: nome || `Fornecedor ${cnpj}`, cnpj_cpf: cnpj || null, ativo: true,
    criado_por_id: usuario.id, criado_por_nome: usuario.nome,
    observacoes: 'Criado a partir do vínculo de item de NF de compra.',
  }).select('id,nome,cnpj_cpf').single()
  if (error) throw new Error(error.message)
  return data
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const f = await fornecedor(body, usuario)
    const codigoFornecedor = texto(body.codigoFornecedor, 120)
    const descricao = texto(body.descricao, 500)
    const unidadeCompra = texto(body.unidadeCompra, 30) || null
    const unidadeEstoque = texto(body.unidadeEstoque, 30) || null
    const fator = numero(body.fatorConversao)
    const ncm = digitos(body.ncm).slice(0, 8) || null
    const custoCompraUnitario = numero(body.custoCompraUnitario)
    const margemBalcao = numero(body.margemBalcaoPercentual)
    const precoMinimo = numero(body.precoMinimo)
    const precoPromocional = numero(body.precoPromocional)

    if (!codigoFornecedor) return NextResponse.json({ error: 'Código do fornecedor é obrigatório.' }, { status: 400 })
    if (fator !== null && fator <= 0) return NextResponse.json({ error: 'Fator de conversão deve ser maior que zero.' }, { status: 400 })
    if (margemBalcao !== null && (margemBalcao < 0 || margemBalcao >= 100)) {
      return NextResponse.json({ error: 'A margem balcão deve estar entre 0% e menos de 100%.' }, { status: 400 })
    }
    if (precoMinimo !== null && precoMinimo < 0) return NextResponse.json({ error: 'Preço mínimo inválido.' }, { status: 400 })
    if (precoPromocional !== null && precoPromocional < 0) return NextResponse.json({ error: 'Preço promocional inválido.' }, { status: 400 })

    const fatorCusto = fator && fator > 0 ? fator : 1
    const custoEstoque = custoCompraUnitario !== null ? arredondarMoeda(custoCompraUnitario / fatorCusto) : null
    const precoSugerido = arredondarMoeda(precoPorMargemReal(custoEstoque, margemBalcao))

    let produtoId = texto(body.produtoId, 80)
    let criado = false
    if (produtoId) {
      const { data } = await supabaseAdmin
        .from('produtos')
        .select('id,codigo,nome,unidade')
        .eq('empresa_id', usuario.empresa_id)
        .eq('id', produtoId)
        .maybeSingle()
      if (!data) return NextResponse.json({ error: 'Produto escolhido não existe nesta empresa.' }, { status: 404 })
    } else {
      const categoria = texto(body.categoria, 80)
      if (!descricao) return NextResponse.json({ error: 'Descrição é obrigatória para cadastrar novo produto.' }, { status: 400 })
      if (!categoria) return NextResponse.json({ error: 'Escolha a categoria do novo produto.' }, { status: 400 })
      if (!unidadeEstoque) return NextResponse.json({ error: 'Defina a unidade de estoque do novo produto.' }, { status: 400 })
      if (unidadeCompra && unidadeCompra !== unidadeEstoque && (!fator || fator <= 0)) {
        return NextResponse.json({ error: 'Defina o fator de conversão entre unidade de compra e unidade de estoque.' }, { status: 400 })
      }
      const { data: duplicado } = await supabaseAdmin
        .from('produtos')
        .select('id,codigo,nome')
        .eq('empresa_id', usuario.empresa_id)
        .ilike('codigo', codigoFornecedor)
        .maybeSingle()
      if (duplicado) produtoId = duplicado.id
      else {
        const { data, error } = await supabaseAdmin.from('produtos').insert({
          empresa_id: usuario.empresa_id,
          nome: descricao,
          descricao,
          categoria,
          preco: precoSugerido ?? 0,
          preco_minimo: precoMinimo,
          preco_promocional: precoPromocional,
          custo: custoEstoque,
          margem_percentual: margemBalcao,
          unidade: unidadeEstoque,
          codigo: codigoFornecedor,
          codigo_origem: codigoFornecedor,
          origem: 'nf_compra',
          ativo: true,
          unidade_origem: unidadeCompra,
          qtde_embalagem_origem: fator,
          ncm,
          ncm_origem: ncm,
          ncm_status: ncm && ncm.length === 8 ? 'valido' : 'pendente',
          status_validacao: 'revisado',
          fornecedor_id: f.id,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          dados_origem: {
            origem: 'nf_compra', codigoFornecedor, descricaoFornecedor: descricao,
            unidadeCompra, fatorConversao: fator, custoCompraUnitario,
            custoEstoqueInicial: custoEstoque, margemBalcaoPercentual: margemBalcao,
          },
        }).select('id,codigo,nome,unidade,custo,preco,margem_percentual,preco_minimo,preco_promocional').single()
        if (error) throw new Error(`Não foi possível cadastrar o produto: ${error.message}`)
        produtoId = data.id
        criado = true
      }
    }

    const { data: produto } = await supabaseAdmin
      .from('produtos')
      .select('id,codigo,nome,unidade,custo,preco,margem_percentual,preco_minimo,preco_promocional,ultimo_preco_vendido')
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', produtoId)
      .single()

    const { error: mapError } = await supabaseAdmin.from('produto_fornecedores').upsert({
      empresa_id: usuario.empresa_id,
      produto_id: produtoId, fornecedor_id: f.id, codigo_fornecedor: codigoFornecedor,
      descricao_fornecedor: descricao || null, ncm_fornecedor: ncm, unidade_compra: unidadeCompra,
      fator_conversao: fator, preferencial: true, ativo: true,
      criado_por_id: usuario.id, criado_por_nome: usuario.nome, updated_at: new Date().toISOString(),
    }, { onConflict: 'fornecedor_id,codigo_fornecedor' })
    if (mapError) throw new Error(`Produto foi localizado, mas não foi possível salvar o código do fornecedor: ${mapError.message}`)

    return NextResponse.json({
      ok: true,
      criado,
      fornecedor: f,
      produto,
      fatorConversao: fator,
      unidadeCompra,
      precificacao: {
        custoCompraUnitario,
        custoEstoque,
        margemBalcaoPercentual: margemBalcao,
        precoSugerido,
        precoMinimo,
        precoPromocional,
      },
    })
  } catch (error) {
    console.error('Erro ao vincular produto da NF:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao vincular produto.' }, { status: 500 })
  }
}
