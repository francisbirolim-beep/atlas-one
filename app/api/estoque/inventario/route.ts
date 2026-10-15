import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarCompras } from '@/lib/comprasServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type LinhaEntrada = {
  produtoId: string
  quantidadeContada: number
  esperadoSaldoId?: string | null
  esperadoAtualizadoEm?: string | null
  esperadoFisico?: number | null
}
type CriarInventario = { localId: string; observacoes?: string; itens: LinhaEntrada[] }

function numeroSeguro(v: unknown): number | null {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) || n < 0 ? null : n
}

export async function GET(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const empresa = usuario.empresa_id
    const q = String(req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80)
    const localId = String(req.nextUrl.searchParams.get('localId') || '').trim()
    const [locaisRes, inventariosRes] = await Promise.all([
      supabaseAdmin.from('estoque_locais').select('id,codigo,nome').eq('empresa_id', empresa).order('nome'),
      supabaseAdmin.from('estoque_inventarios').select('id,status,created_at,criado_por_nome,local_id,aprovado_em').eq('empresa_id', empresa).order('created_at', { ascending: false }).limit(25),
    ])
    if (locaisRes.error) throw locaisRes.error
    if (inventariosRes.error) throw inventariosRes.error
    const locais = locaisRes.data || []
    const inventarios = inventariosRes.data || []
    if (!q || !localId) return NextResponse.json({ ok: true, master: usuario.role === 'master', locais, inventarios, produtos: [] })
    if (!locais.some(l => l.id === localId)) return NextResponse.json({ error: 'Local de estoque inválido.' }, { status: 400 })

    // Busca por código/nome, sem consulta ou carga completa dos 3 mil produtos.
    const termo = q.replace(/[%,().]/g, ' ').replace(/\s+/g, ' ').trim()
    if (termo.length < 2) return NextResponse.json({ ok: true, master: usuario.role === 'master', locais, inventarios, produtos: [] })
    const { data: encontrados, error: produtoErro } = await supabaseAdmin.from('produtos')
      .select('id,codigo,nome,categoria,unidade,foto_url,custo')
      .eq('empresa_id', empresa).eq('ativo', true)
      .or('codigo.ilike.%' + termo + '%,nome.ilike.%' + termo + '%')
      .order('nome').limit(40)
    if (produtoErro) throw produtoErro
    const produtos = encontrados || []
    const ids = produtos.map(p => p.id)
    let saldos: any[] = []
    let imagens: any[] = []
    if (ids.length) {
      const [saldosRes, imagensRes] = await Promise.all([
        supabaseAdmin.from('estoque_saldos')
          .select('id,produto_id,quantidade,quantidade_reservada,updated_at,custo_medio')
          .eq('empresa_id', empresa).eq('local_id', localId).is('endereco_id', null).in('produto_id', ids),
        supabaseAdmin.from('produto_imagens')
          .select('produto_id,url,principal,status_validacao')
          .eq('empresa_id', empresa).eq('ativo', true).in('produto_id', ids)
          .order('principal', { ascending: false }),
      ])
      if (saldosRes.error) throw saldosRes.error
      if (imagensRes.error) throw imagensRes.error
      saldos = saldosRes.data || []
      imagens = imagensRes.data || []
    }
    const porProduto = new Map(saldos.map(s => [s.produto_id, s]))
    const fotoPorProduto = new Map<string, {url: string, status: string}>()
    for (const i of imagens) {
      if (!fotoPorProduto.has(i.produto_id) && i.url)
        fotoPorProduto.set(i.produto_id, { url: i.url, status: i.status_validacao })
    }
    return NextResponse.json({ ok: true, master: usuario.role === 'master', locais, inventarios,
      produtos: produtos.map(p => {
        const s = porProduto.get(p.id)
        const f = fotoPorProduto.get(p.id)
        return {
          id: p.id, codigo: p.codigo, nome: p.nome, categoria: p.categoria,
          unidade: p.unidade, fotoUrl: p.foto_url || f?.url || null,
          fotoPendente: !p.foto_url && (!f || !['validado', 'aprovado'].includes(f.status)),
          custoReferencia: usuario.role === 'master' ? p.custo : null,
          saldoId: s?.id ?? null, atualizadoEm: s?.updated_at ?? null,
          fisico: s ? Number(s.quantidade) : null,
          reservado: s ? Number(s.quantidade_reservada) : null,
        }
      }),
    })
  } catch (e) {
    console.error('Falha na busca do inventário:', e)
    return NextResponse.json({ error: 'Não foi possível consultar o inventário.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const usuario = await autenticarCompras(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const body = await req.json() as CriarInventario
    if (!body.localId || !Array.isArray(body.itens) || !body.itens.length || body.itens.length > 100)
      return NextResponse.json({ error: 'Selecione local e 1 a 100 produtos.' }, { status: 400 })
    const ids = body.itens.map(i => String(i.produtoId || ''))
    if (ids.some(id => !/^[0-9a-f-]{36}$/i.test(id)) || new Set(ids).size !== ids.length)
      return NextResponse.json({ error: 'Produtos repetidos ou inválidos.' }, { status: 400 })
    if (body.itens.some(i => numeroSeguro(i.quantidadeContada) === null))
      return NextResponse.json({ error: 'Informe uma quantidade física válida para cada produto.' }, { status: 400 })

    const [localRes, produtosRes, saldosRes] = await Promise.all([
      supabaseAdmin.from('estoque_locais').select('id').eq('id', body.localId).eq('empresa_id', usuario.empresa_id).maybeSingle(),
      supabaseAdmin.from('produtos').select('id,custo').eq('empresa_id', usuario.empresa_id).eq('ativo', true).in('id', ids),
      supabaseAdmin.from('estoque_saldos').select('id,produto_id,quantidade,quantidade_reservada,updated_at').eq('empresa_id', usuario.empresa_id).eq('local_id', body.localId).is('endereco_id', null).in('produto_id', ids),
    ])
    if (localRes.error || produtosRes.error || saldosRes.error) throw (localRes.error || produtosRes.error || saldosRes.error)
    if (!localRes.data || produtosRes.data?.length !== ids.length)
      return NextResponse.json({ error: 'Local ou produto não encontrado na sua empresa.' }, { status: 400 })
    const saldos = new Map((saldosRes.data || []).map(s => [s.produto_id, s]))
    const produtos = new Map((produtosRes.data || []).map(p => [p.id, p]))
    for (const linha of body.itens) {
      const atual = saldos.get(linha.produtoId)
      if ((atual?.id || null) !== (linha.esperadoSaldoId || null)
        || (atual?.updated_at || null) !== (linha.esperadoAtualizadoEm || null)
        || (atual ? Number(atual.quantidade) : null) !== (linha.esperadoFisico ?? null))
        return NextResponse.json({ error: 'Um saldo mudou após a consulta. Atualize a busca e reconfira as quantidades.' }, { status: 409 })
      if (atual && linha.quantidadeContada < Number(atual.quantidade_reservada))
        return NextResponse.json({ error: 'Há contagem inferior ao estoque reservado. Regularize a reserva primeiro.' }, { status: 409 })
    }

    const { data: inventario, error: insercaoErro } = await supabaseAdmin
      .from('estoque_inventarios').insert({
        empresa_id: usuario.empresa_id, local_id: body.localId,
        criado_por_id: usuario.id, criado_por_nome: usuario.nome,
        observacoes: String(body.observacoes || '').slice(0, 1000) || null,
        status: 'rascunho',
      }).select('id').single()
    if (insercaoErro) throw insercaoErro
    const linhas = body.itens.map(i => {
      const s = saldos.get(i.produtoId)
      return {
        empresa_id: usuario.empresa_id, inventario_id: inventario.id,
        produto_id: i.produtoId, quantidade_contada: i.quantidadeContada,
        saldo_referencia_id: s?.id || null,
        saldo_referencia: s ? Number(s.quantidade) : null,
        saldo_referencia_atualizado_em: s?.updated_at || null,
        custo_inicial_referencia: numeroSeguro(produtos.get(i.produtoId)?.custo),
      }
    })
    const { error: itensErro } = await supabaseAdmin.from('estoque_inventario_itens').insert(linhas)
    if (itensErro) {
      await supabaseAdmin.from('estoque_inventarios').delete().eq('id', inventario.id).eq('empresa_id', usuario.empresa_id)
      throw itensErro
    }
    return NextResponse.json({ ok: true, inventarioId: inventario.id, itens: linhas.length }, { status: 201 })
  } catch (e) {
    console.error('Erro ao salvar contagem:', e)
    return NextResponse.json({ error: 'Não foi possível salvar a contagem.' }, { status: 500 })
  }
}
