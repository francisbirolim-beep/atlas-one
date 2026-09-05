import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ItemImportado = {
  codigo?: string | null
  descricao?: string | null
  categoria?: string | null
  unidade?: string | null
  preco?: number | string | null
  prazo_dias?: number | string | null
  pedido_minimo?: number | string | null
  embalagem?: string | null
}

function texto(v: unknown, max = 500) {
  return String(v ?? '').trim().slice(0, max)
}

function numero(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function normalizarCodigo(v: unknown) {
  return texto(v, 80).toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function normalizarTexto(v: unknown) {
  return texto(v, 300)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function categoriaPorDescricao(descricao: string) {
  const t = normalizarTexto(descricao)
  if (/\bVIDRO\b|LAMINADO|TEMPERADO|REFLETIVO|INCOLOR/.test(t)) return 'vidro'
  if (/\bKIT\b/.test(t)) return 'kit'
  if (/ROLDANA|FECHADURA|PUXADOR|PARAFUSO|ESCOVA|BORRACHA|VEDA|GUIA|CONCHA|CREMONA|DOBRADICA|ACESSORIO/.test(t)) return 'acessorio'
  if (/PERFIL|TUBO|CANTONEIRA|BARRA|MONTANTE|TRAVESSA|MARCO|CONTRAMARCO/.test(t)) return 'perfil'
  return 'outro'
}

function extrairItensTextoPdf(textoPdf: string): ItemImportado[] {
  const linhas = textoPdf
    .split(/\r?\n/)
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(l => l.length >= 6 && l.length <= 220)

  const vistos = new Set<string>()
  const itens: ItemImportado[] = []

  for (const linha of linhas) {
    const m = linha.match(/^([A-Z0-9][A-Z0-9._\/-]{2,24})\s+(.{3,160}?)(?:\s+(?:R\$\s*)?(\d{1,7}(?:[.,]\d{2,4})?))?$/i)
    if (!m) continue
    const codigo = texto(m[1], 80)
    const codNorm = normalizarCodigo(codigo)
    if (!/[0-9]/.test(codNorm) || codNorm.length < 3) continue

    const descricao = texto(m[2], 180)
    if (!descricao || /^PAG(?:INA)?\b/i.test(descricao)) continue

    let preco: number | null = null
    if (m[3] && /R\$|PRE[CÇ]O|VALOR/i.test(linha)) preco = numero(m[3])

    const chave = `${codNorm}|${normalizarTexto(descricao)}`
    if (vistos.has(chave)) continue
    vistos.add(chave)

    itens.push({
      codigo,
      descricao,
      categoria: categoriaPorDescricao(descricao),
      preco,
    })
    if (itens.length >= 1500) break
  }

  return itens
}

async function reconciliarItens(params: {
  fornecedorId: string
  documentoId: string
  itens: ItemImportado[]
  usuario: { id: string; nome: string; empresa_id: string }
  origem: 'pdf_local' | 'analise_assistida'
}) {
  const { fornecedorId, documentoId, usuario, origem } = params
  const empresaId = usuario.empresa_id
  const itens = params.itens
    .map(i => ({
      codigo: texto(i.codigo, 80) || null,
      descricao: texto(i.descricao, 300),
      categoria: texto(i.categoria, 80) || null,
      unidade: texto(i.unidade, 30) || null,
      preco: numero(i.preco),
      prazo_dias: numero(i.prazo_dias),
      pedido_minimo: numero(i.pedido_minimo),
      embalagem: texto(i.embalagem, 120) || null,
    }))
    .filter(i => i.descricao)
    .slice(0, 2000)

  if (!itens.length) return { total: 0, vinculados: 0, criados: 0, revisar: 0 }

  const { data: produtos, error: produtosError } = await supabaseAdmin
    .from('produtos')
    .select('id,nome,codigo,codigo_origem,categoria,unidade,ativo,status_validacao')
    .eq('empresa_id', empresaId)
    .limit(10000)
  if (produtosError) throw new Error(produtosError.message)

  const porCodigo = new Map<string, any>()
  const porNome = new Map<string, any[]>()
  for (const p of produtos || []) {
    for (const c of [p.codigo, p.codigo_origem]) {
      const n = normalizarCodigo(c)
      if (n && !porCodigo.has(n)) porCodigo.set(n, p)
    }
    const nome = normalizarTexto(p.nome)
    if (nome) porNome.set(nome, [...(porNome.get(nome) || []), p])
  }

  let vinculados = 0
  let criados = 0
  let revisar = 0

  for (const item of itens) {
    const codigoNorm = normalizarCodigo(item.codigo)
    const nomeNorm = normalizarTexto(item.descricao)
    let produto = codigoNorm ? porCodigo.get(codigoNorm) : null
    if (!produto) {
      const iguais = porNome.get(nomeNorm) || []
      if (iguais.length === 1) produto = iguais[0]
    }

    let status = 'revisar'
    const confianca = produto ? 0.99 : origem === 'analise_assistida' ? 0.9 : codigoNorm ? 0.82 : 0.55

    if (!produto && (origem === 'analise_assistida' || codigoNorm)) {
      const categoria = ['perfil','acessorio','vidro','kit','produto','outro'].includes(item.categoria || '')
        ? item.categoria
        : categoriaPorDescricao(item.descricao)
      const { data: criado, error: criarError } = await supabaseAdmin
        .from('produtos')
        .insert({
          empresa_id: empresaId,
          nome: item.descricao.toUpperCase(),
          codigo: item.codigo || null,
          categoria: categoria || 'outro',
          unidade: item.unidade || 'UN',
          preco: 0,
          ativo: false,
          status_validacao: 'pendente',
          origem: 'catalogo_fornecedor',
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          dados_origem: {
            fornecedor_id: fornecedorId,
            documento_id: documentoId,
            origem,
          },
        })
        .select('id,nome,codigo,categoria,unidade,ativo,status_validacao')
        .single()
      if (criarError) throw new Error(criarError.message)
      produto = criado
      status = 'criado_pendente'
      criados += 1
      if (codigoNorm) porCodigo.set(codigoNorm, criado)
      porNome.set(nomeNorm, [criado])
    } else if (produto) {
      status = 'vinculado'
      vinculados += 1
    } else {
      revisar += 1
    }

    const { data: catalogoItem, error: itemError } = await supabaseAdmin
      .from('fornecedor_catalogo_itens')
      .insert({
        empresa_id: empresaId,
        documento_id: documentoId,
        fornecedor_id: fornecedorId,
        produto_id: produto?.id || null,
        codigo_fornecedor: item.codigo,
        descricao: item.descricao,
        categoria_sugerida: item.categoria || categoriaPorDescricao(item.descricao),
        unidade: item.unidade,
        preco: item.preco,
        prazo_dias: item.prazo_dias,
        pedido_minimo: item.pedido_minimo,
        embalagem: item.embalagem,
        status,
        confianca,
        dados_extraidos: { origem },
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
      })
      .select('id')
      .single()
    if (itemError) throw new Error(itemError.message)

    if (!produto) continue

    let produtoFornecedor: any = null
    if (item.codigo) {
      const { data, error } = await supabaseAdmin
        .from('produto_fornecedores')
        .upsert({
          empresa_id: empresaId,
          produto_id: produto.id,
          fornecedor_id: fornecedorId,
          codigo_fornecedor: item.codigo,
          descricao_fornecedor: item.descricao,
          unidade_compra: item.unidade || produto.unidade || null,
          preco_atual: item.preco,
          prazo_entrega_dias: item.prazo_dias,
          pedido_minimo: item.pedido_minimo,
          embalagem: item.embalagem,
          documento_origem_id: documentoId,
          preco_atualizado_em: item.preco != null ? new Date().toISOString() : null,
          ativo: true,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'fornecedor_id,codigo_fornecedor' })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      produtoFornecedor = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('produto_fornecedores')
        .insert({
          empresa_id: empresaId,
          produto_id: produto.id,
          fornecedor_id: fornecedorId,
          codigo_fornecedor: null,
          descricao_fornecedor: item.descricao,
          unidade_compra: item.unidade || produto.unidade || null,
          preco_atual: item.preco,
          prazo_entrega_dias: item.prazo_dias,
          pedido_minimo: item.pedido_minimo,
          embalagem: item.embalagem,
          documento_origem_id: documentoId,
          preco_atualizado_em: item.preco != null ? new Date().toISOString() : null,
          ativo: true,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      produtoFornecedor = data
    }

    if (item.preco != null && produtoFornecedor?.id) {
      const { error: historicoError } = await supabaseAdmin.from('produto_fornecedor_precos_historico').insert({
        empresa_id: empresaId,
        produto_fornecedor_id: produtoFornecedor.id,
        fornecedor_id: fornecedorId,
        produto_id: produto.id,
        preco: item.preco,
        unidade_compra: item.unidade || produto.unidade || null,
        documento_origem_id: documentoId,
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
      })
      if (historicoError) throw new Error(historicoError.message)
    }

    await supabaseAdmin
      .from('fornecedor_catalogo_itens')
      .update({ produto_id: produto.id, status, updated_at: new Date().toISOString() })
      .eq('id', catalogoItem.id)
      .eq('empresa_id', empresaId)
  }

  return { total: itens.length, vinculados, criados, revisar }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const fornecedorId = params.id
  const { data: fornecedor } = await supabaseAdmin
    .from('fornecedores')
    .select('id')
    .eq('id', fornecedorId)
    .eq('empresa_id', usuario.empresa_id)
    .maybeSingle()
  if (!fornecedor) return NextResponse.json({ error: 'Fornecedor não encontrado.' }, { status: 404 })

  const [{ data: documentos, error: docError }, { data: itens, error: itensError }, { data: vinculos, error: vincError }] = await Promise.all([
    supabaseAdmin.from('fornecedor_documentos').select('*').eq('empresa_id', usuario.empresa_id).eq('fornecedor_id', fornecedorId).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('fornecedor_catalogo_itens').select('*').eq('empresa_id', usuario.empresa_id).eq('fornecedor_id', fornecedorId).order('created_at', { ascending: false }).limit(3000),
    supabaseAdmin.from('produto_fornecedores').select('*, produtos(id,nome,codigo,categoria,ativo,status_validacao)').eq('empresa_id', usuario.empresa_id).eq('fornecedor_id', fornecedorId).eq('ativo', true).order('updated_at', { ascending: false }).limit(3000),
  ])
  if (docError || itensError || vincError) {
    return NextResponse.json({ error: docError?.message || itensError?.message || vincError?.message }, { status: 500 })
  }

  return NextResponse.json({ documentos: documentos || [], itens: itens || [], vinculos: vinculos || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  const fornecedorId = params.id
  try {
    const body = await req.json()
    const acao = texto(body.acao, 50)

    const { data: fornecedor } = await supabaseAdmin
      .from('fornecedores')
      .select('id')
      .eq('id', fornecedorId)
      .eq('empresa_id', usuario.empresa_id)
      .maybeSingle()
    if (!fornecedor) return NextResponse.json({ error: 'Fornecedor não encontrado.' }, { status: 404 })

    if (acao === 'registrar_documento') {
      const nomeArquivo = texto(body.nome_arquivo, 240)
      const url = texto(body.url, 2000)
      const mimeType = texto(body.mime_type, 160) || null
      if (!nomeArquivo || !url) return NextResponse.json({ error: 'Arquivo inválido.' }, { status: 400 })

      const { data: documento, error: inserirError } = await supabaseAdmin
        .from('fornecedor_documentos')
        .insert({
          empresa_id: usuario.empresa_id,
          fornecedor_id: fornecedorId,
          tipo: texto(body.tipo, 60) || 'catalogo',
          nome_arquivo: nomeArquivo,
          url,
          mime_type: mimeType,
          tamanho_bytes: numero(body.tamanho_bytes),
          status: 'enviado',
          custo_modelo: 0,
          criado_por_id: usuario.id,
          criado_por_nome: usuario.nome,
        })
        .select('*')
        .single()
      if (inserirError) throw new Error(inserirError.message)

      const ehPdf = mimeType === 'application/pdf' || nomeArquivo.toLowerCase().endsWith('.pdf')
      if (!ehPdf) {
        await supabaseAdmin.from('fornecedor_documentos').update({ status: 'precisa_analise_ia', extracao_metodo: 'arquivo_visual', updated_at: new Date().toISOString() }).eq('id', documento.id).eq('empresa_id', usuario.empresa_id)
        return NextResponse.json({ documento: { ...documento, status: 'precisa_analise_ia' }, resumo: { total: 0, vinculados: 0, criados: 0, revisar: 0 }, custo_modelo: 0 }, { status: 201 })
      }

      try {
        const resposta = await fetch(url)
        if (!resposta.ok) throw new Error(`Falha ao baixar PDF (${resposta.status}).`)
        const buffer = Buffer.from(await resposta.arrayBuffer())
        const parsed = await pdfParse(buffer)
        const textoExtraido = texto(parsed.text, 250000)
        if (textoExtraido.length < 80) {
          await supabaseAdmin.from('fornecedor_documentos').update({ status: 'precisa_analise_ia', extracao_metodo: 'pdf_sem_texto', texto_extraido: textoExtraido || null, updated_at: new Date().toISOString() }).eq('id', documento.id).eq('empresa_id', usuario.empresa_id)
          return NextResponse.json({ documento: { ...documento, status: 'precisa_analise_ia' }, resumo: { total: 0, vinculados: 0, criados: 0, revisar: 0 }, custo_modelo: 0 }, { status: 201 })
        }

        const candidatos = extrairItensTextoPdf(textoExtraido)
        const resumo = await reconciliarItens({ fornecedorId, documentoId: documento.id, itens: candidatos, usuario, origem: 'pdf_local' })
        const status = candidatos.length ? 'processado' : 'extraido'
        await supabaseAdmin.from('fornecedor_documentos').update({ status, texto_extraido: textoExtraido, extracao_metodo: 'pdf_parse_local', custo_modelo: 0, updated_at: new Date().toISOString() }).eq('id', documento.id).eq('empresa_id', usuario.empresa_id)
        return NextResponse.json({ documento: { ...documento, status }, resumo, custo_modelo: 0 }, { status: 201 })
      } catch (e) {
        await supabaseAdmin.from('fornecedor_documentos').update({ status: 'precisa_analise_ia', extracao_metodo: 'pdf_falha_local', erro: e instanceof Error ? e.message.slice(0, 500) : 'Falha na extração local', updated_at: new Date().toISOString() }).eq('id', documento.id).eq('empresa_id', usuario.empresa_id)
        return NextResponse.json({ documento: { ...documento, status: 'precisa_analise_ia' }, resumo: { total: 0, vinculados: 0, criados: 0, revisar: 0 }, custo_modelo: 0 }, { status: 201 })
      }
    }

    if (acao === 'importar_analise') {
      const documentoId = texto(body.documento_id, 80)
      const itens = Array.isArray(body.itens) ? body.itens as ItemImportado[] : []
      if (!documentoId || !itens.length) return NextResponse.json({ error: 'Informe o documento e os itens analisados.' }, { status: 400 })

      const { data: documento } = await supabaseAdmin
        .from('fornecedor_documentos')
        .select('id')
        .eq('id', documentoId)
        .eq('empresa_id', usuario.empresa_id)
        .eq('fornecedor_id', fornecedorId)
        .maybeSingle()
      if (!documento) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })

      await supabaseAdmin.from('fornecedor_catalogo_itens').delete().eq('empresa_id', usuario.empresa_id).eq('documento_id', documentoId).eq('status', 'revisar')
      const resumo = await reconciliarItens({ fornecedorId, documentoId, itens, usuario, origem: 'analise_assistida' })
      await supabaseAdmin.from('fornecedor_documentos').update({ status: 'processado', extracao_metodo: 'analise_assistida_importada', custo_modelo: 0, erro: null, updated_at: new Date().toISOString() }).eq('id', documentoId).eq('empresa_id', usuario.empresa_id)
      return NextResponse.json({ resumo, custo_modelo: 0 })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  } catch (e) {
    console.error('Erro no catálogo do fornecedor:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Não foi possível processar o catálogo.' }, { status: 500 })
  }
}
