import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao, nivelBalcaoUsuario } from '@/lib/balcaoServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso à Venda Balcão.' }, { status: 403 })
  const tipo = req.nextUrl.searchParams.get('tipo') || 'produtos'
  const q = (req.nextUrl.searchParams.get('q') || '').trim()

  try {
    if (tipo === 'clientes') {
      let query = supabaseAdmin.from('clientes').select('id,nome,cpf_cnpj,telefone,whatsapp,cidade').order('nome').limit(30)
      if (q) query = query.or(`nome.ilike.%${q}%,cpf_cnpj.ilike.%${q}%,telefone.ilike.%${q}%,whatsapp.ilike.%${q}%`)
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json({ ok: true, clientes: data || [] })
    }

    let query = supabaseAdmin
      .from('produtos')
      .select('id,codigo,nome,descricao,categoria,unidade,custo,preco,margem_percentual,preco_minimo,preco_promocional,foto_url,ativo')
      .eq('ativo', true)
      .not('unidade', 'is', null)
      .order('nome')
      .limit(q ? 120 : 80)
    if (q) query = query.or(`codigo.ilike.%${q}%,nome.ilike.%${q}%,descricao.ilike.%${q}%`)
    const { data: produtos, error } = await query
    if (error) throw error
    const ids = (produtos || []).map(p => p.id)
    const { data: saldos } = ids.length
      ? await supabaseAdmin.from('estoque_saldos').select('produto_id,quantidade,unidade,custo_medio').in('produto_id', ids)
      : { data: [] as any[] }
    const saldoMap = new Map((saldos || []).map(s => [s.produto_id, s]))
    const gestao = await nivelBalcaoUsuario(usuario.id, usuario.role, 'relatorios-balcao')
    const podeVerGestao = gestao !== 'oculto'

    const lista = (produtos || []).map(p => {
      const saldo = saldoMap.get(p.id) as any
      const precoNormal = Number(p.preco || 0)
      const promocional = p.preco_promocional == null ? null : Number(p.preco_promocional)
      const precoEfetivo = promocional != null && promocional >= 0 ? promocional : precoNormal
      return {
        id: p.id,
        codigo: p.codigo || '',
        nome: p.nome,
        descricao: p.descricao || null,
        categoria: p.categoria,
        unidade: p.unidade,
        fotoUrl: p.foto_url || null,
        estoque: Number(saldo?.quantidade || 0),
        unidadeEstoque: saldo?.unidade || p.unidade,
        preco: precoNormal,
        precoPromocional: promocional,
        precoEfetivo,
        ...(podeVerGestao ? {
          custo: saldo?.custo_medio == null ? (p.custo == null ? null : Number(p.custo)) : Number(saldo.custo_medio),
          margem: p.margem_percentual == null ? null : Number(p.margem_percentual),
          precoMinimo: p.preco_minimo == null ? null : Number(p.preco_minimo),
        } : {}),
      }
    })
    return NextResponse.json({ ok: true, produtos: lista, podeVerGestao })
  } catch (e) {
    console.error('Erro catálogo balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo.' }, { status: 500 })
  }
}
