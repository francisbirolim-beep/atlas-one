import { NextRequest, NextResponse } from 'next/server'
import { autenticarCompras } from '@/lib/comprasServer'
import { obterComprasAcessos } from '@/lib/comprasPermissoesServer'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Evita gravar links arbitrários como imagem validada. O arquivo deve ter sido
// enviado para o bucket de produtos do próprio Atlas.
function fotoDoAtlas(url: unknown): url is string {
  if (typeof url !== 'string' || url.length > 2000) return false
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    const candidata = new URL(url)
    return candidata.origin === base.origin &&
      candidata.pathname.startsWith('/storage/v1/object/public/fotos/produtos/') &&
      !candidata.search && !candidata.hash
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const acessos = await obterComprasAcessos(usuario)
    if (!acessos.consultar && !acessos.solicitar) {
      return NextResponse.json({ error: 'Sem autorização para consultar Compras.' }, { status: 403 })
    }
    const produtoId = String(req.nextUrl.searchParams.get('produtoId') || '')
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(produtoId)) {
      return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
    }
    const { data: produto, error: erroProduto } = await supabaseAdmin.from('produtos')
      .select('id').eq('empresa_id', usuario.empresa_id).eq('id', produtoId).maybeSingle()
    if (erroProduto) throw erroProduto
    if (!produto) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 })
    const { data: fotos, error } = await supabaseAdmin.from('produto_imagens')
      .select('url,tipo,principal')
      .eq('produto_id', produto.id).eq('ativo', true).eq('status_validacao', 'validada')
      .order('principal', { ascending: false }).order('created_at', { ascending: false }).limit(12)
    if (error) throw error
    return NextResponse.json({ imagens: (fotos || []).map(foto => ({ url: foto.url, tipo: foto.tipo })) })
  } catch (error) {
    console.error('Erro ao carregar imagens do material:', error)
    return NextResponse.json({ error: 'Não foi possível carregar as imagens.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const body = await req.json()
    const acao = String(body?.acao || '')
    const produtoId = String(body?.produtoId || '')
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(produtoId)) {
      return NextResponse.json({ error: 'Produto inválido.' }, { status: 400 })
    }
    const acessos = await obterComprasAcessos(usuario)
    const permitido = acao === 'inativar'
      ? acessos.inativarProduto
      : acao === 'corrigir_imagem'
        ? acessos.corrigirImagemProduto
        : false
    if (!permitido) return NextResponse.json({ error: 'Sem autorização para esta ação no setor de Compras.' }, { status: 403 })

    const { data: produto, error: erroBusca } = await supabaseAdmin.from('produtos')
      .select('id,codigo,nome,categoria,foto_url,ativo')
      .eq('id', produtoId).eq('empresa_id', usuario.empresa_id).maybeSingle()
    if (erroBusca) throw erroBusca
    if (!produto || !produto.ativo) {
      return NextResponse.json({ error: 'Produto não encontrado entre os cadastros ativos.' }, { status: 404 })
    }

    if (acao === 'inativar') {
      const { error } = await supabaseAdmin.from('produtos')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', produto.id).eq('empresa_id', usuario.empresa_id).eq('ativo', true)
      if (error) throw error
      // Cadastro e histórico permanecem no banco, inclusive em compras antigas.
      return NextResponse.json({ ok: true, produtoId: produto.id, ativo: false })
    }

    if (!fotoDoAtlas(body.fotoUrl)) {
      return NextResponse.json({ error: 'Envie uma imagem válida para o catálogo do Atlas.' }, { status: 400 })
    }
    const fotoUrl = body.fotoUrl as string
    if (fotoUrl === produto.foto_url) return NextResponse.json({ ok: true, produtoId: produto.id, fotoUrl })

    // Criar uma nova versão antes de alterar o produto; nunca apagar a anterior.
    const { data: novaImagem, error: erroImagem } = await supabaseAdmin
      .from('produto_imagens')
      .insert({
        produto_id: produto.id,
        url: fotoUrl,
        tipo: body.tipoImagem === 'desenho_tecnico' ? 'desenho_tecnico' : 'foto',
        origem: 'compras_correcao_manual',
        principal: false,
        status_validacao: 'validada',
        criado_por_id: usuario.id,
        criado_por_nome: usuario.nome,
        metadata: {
          codigo: produto.codigo,
          anterior_url: produto.foto_url || null,
          confirmado_em: new Date().toISOString(),
          finalidade: 'imagem_corrigida_por_usuario_autorizado',
        },
      })
      .select('id')
      .single()
    if (erroImagem) throw erroImagem

    const { error: erroAtualizar } = await supabaseAdmin.from('produtos')
      .update({ foto_url: fotoUrl, updated_at: new Date().toISOString() })
      .eq('id', produto.id).eq('empresa_id', usuario.empresa_id).eq('ativo', true)
    if (erroAtualizar) {
      await supabaseAdmin.from('produto_imagens').update({ ativo: false }).eq('id', novaImagem.id)
      throw erroAtualizar
    }

    // O histórico da atualização de produtos é registrado pelo gatilho do cadastro.
    // A biblioteca mantém as versões anteriores para auditoria.
    const anterior = await supabaseAdmin.from('produto_imagens')
      .update({ principal: false, status_validacao: 'rejeitada' })
      .eq('produto_id', produto.id).eq('principal', true).eq('ativo', true)
      .neq('id', novaImagem.id)
    const principal = anterior.error ? { error: anterior.error } : await supabaseAdmin
      .from('produto_imagens').update({ principal: true }).eq('id', novaImagem.id)
    if (principal.error) console.error('Biblioteca de imagens: não foi possível definir principal', principal.error)

    return NextResponse.json({
      ok: true,
      produtoId: produto.id,
      fotoUrl,
      aviso: principal.error ? 'Imagem principal alterada, mas a biblioteca requer conferência.' : null,
    })
  } catch (error) {
    console.error('Erro na correção de catálogo de Compras:', error)
    return NextResponse.json({ error: 'Não foi possível atualizar o cadastro. Nenhum pedido foi alterado.' }, { status: 500 })
  }
}
