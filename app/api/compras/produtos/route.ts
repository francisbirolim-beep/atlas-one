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
    // Pesquisa no banco inteiro: o limite de linhas da API de produtos (1.000)
    // não deve impedir a seleção de códigos existentes, como SU008.
    if (!req.nextUrl.searchParams.has('produtoId')) {
      const busca = String(req.nextUrl.searchParams.get('busca') || '').slice(0, 75)
      const categoria = String(req.nextUrl.searchParams.get('categoria') || 'todos')
      const categorias = new Set(['todos', 'perfil', 'acessorio', 'vidro', 'produto_pronto', 'outros'])
      if (!categorias.has(categoria)) {
        return NextResponse.json({ error: 'Categoria inválida.' }, { status: 400 })
      }
      let query = supabaseAdmin.from('produtos')
        .select('id,nome,codigo,categoria,unidade,ativo,foto_url')
        .eq('empresa_id', usuario.empresa_id).eq('ativo', true)
      if (['perfil', 'acessorio', 'vidro'].includes(categoria)) {
        query = query.eq('categoria', categoria)
      } else if (categoria === 'produto_pronto') {
        query = query.in('categoria', ['produto', 'pu', 'porta_janela_padrao'])
      } else if (categoria === 'outros') {
        query = query.not('categoria', 'in', '("perfil","acessorio","vidro","produto","pu","porta_janela_padrao")')
      }
      const partes = busca.toUpperCase().match(/[A-ZÀ-Ú]+|[0-9]+/g) || []
      // Um % entre blocos permite SU008, SU-008 e SU 008, sem atrair CM008.
      const filtro = partes.join('%').replace(/[^A-Z0-9À-Ú%]/g, '')
      if (filtro) query = query.or('codigo.ilike.%' + filtro + '%,nome.ilike.%' + filtro + '%')
      const { data, error } = await query.order('nome', { ascending: true }).limit(150)
      if (error) throw error
      const normalizarCodigo = (valor: string | null) => (valor || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
      const procurado = normalizarCodigo(busca)
      const itens = (data || []).map(p => ({ ...p, custo: null })).sort((a, b) => {
        const codigoA = normalizarCodigo(a.codigo)
        const codigoB = normalizarCodigo(b.codigo)
        const relevancia = (codigo: string) =>
          !procurado ? 3 : codigo === procurado ? 0 : codigo.startsWith(procurado) ? 1 : codigo.includes(procurado) ? 2 : 3
        return relevancia(codigoA) - relevancia(codigoB) || a.nome.localeCompare(b.nome, 'pt-BR')
      }).slice(0, 100)
      // Alguns produtos têm desenho validado na biblioteca, embora a foto
      // principal do cadastro ainda esteja vazia.
      const semFoto = itens.filter(item => !item.foto_url).map(item => item.id)
      if (semFoto.length) {
        const { data: imagens, error: erroImagens } = await supabaseAdmin.from('produto_imagens')
          .select('produto_id,url,principal')
          .in('produto_id', semFoto).eq('ativo', true).eq('status_validacao', 'validada')
          .order('principal', { ascending: false }).limit(200)
        if (!erroImagens && imagens) {
          const fotoPorProduto = new Map<string, string>()
          for (const imagem of imagens) {
            if (!fotoPorProduto.has(imagem.produto_id)) fotoPorProduto.set(imagem.produto_id, imagem.url)
          }
          for (const item of itens) {
            if (!item.foto_url) item.foto_url = fotoPorProduto.get(item.id) || null
          }
        }
      }
      return NextResponse.json({ produtos: itens, limite: 100 })
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
    // Catálogo oficial já vinculado ao produto. A referência permite abrir o
    // desenho na página correta sem confundir fotos de fornecedores diferentes.
    const { data: refsCatalogo } = await supabaseAdmin.from('fornecedor_catalogo_itens')
      .select('documento_id,codigo_fornecedor,dados_extraidos')
      .eq('empresa_id', usuario.empresa_id).eq('produto_id', produto.id).limit(5)
    let catalogo: { url: string; pagina: number; codigo: string; titulo: string } | null = null
    const ids = [...new Set((refsCatalogo || []).map(ref => ref.documento_id).filter(Boolean))]
    if (ids.length) {
      const { data: docs } = await supabaseAdmin.from('fornecedor_documentos')
        .select('id,url,nome_arquivo').eq('empresa_id', usuario.empresa_id).in('id', ids)
      for (const ref of refsCatalogo || []) {
        const doc = (docs || []).find(item => item.id === ref.documento_id)
        const pagina = Number(ref.dados_extraidos?.pagina_pdf)
        if (doc?.url?.startsWith('https://') && Number.isInteger(pagina) && pagina > 0) {
          catalogo = { url: doc.url, pagina, codigo: ref.codigo_fornecedor || '', titulo: doc.nome_arquivo || 'Catálogo do fornecedor' }
          break
        }
      }
    }
    return NextResponse.json({
      imagens: (fotos || []).map(foto => ({ url: foto.url, tipo: foto.tipo })),
      catalogo,
    })
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
