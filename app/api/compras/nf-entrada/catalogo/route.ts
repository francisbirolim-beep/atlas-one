import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function autenticar(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  const usuario = await autenticar(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })

  try {
    const produtos: any[] = []
    const pagina = 1000
    for (let inicio = 0; ; inicio += pagina) {
      const { data, error } = await supabaseAdmin
        .from('produtos')
        .select('id,codigo,codigo_origem,id_externo_wvetro,nome,unidade,custo,preco,margem_percentual,preco_minimo,preco_promocional,ultimo_preco_vendido')
        .eq('ativo', true)
        .order('nome')
        .range(inicio, inicio + pagina - 1)
      if (error) throw error
      const lote = data || []
      produtos.push(...lote)
      if (lote.length < pagina) break
    }

    return NextResponse.json({
      ok: true,
      produtos: produtos.map(p => ({
        id: p.id,
        codigo: p.codigo || p.codigo_origem || p.id_externo_wvetro || '',
        nome: p.nome,
        unidade: p.unidade || null,
        custo: p.custo == null ? null : Number(p.custo),
        preco: p.preco == null ? 0 : Number(p.preco),
        margemPercentual: p.margem_percentual == null ? null : Number(p.margem_percentual),
        precoMinimo: p.preco_minimo == null ? null : Number(p.preco_minimo),
        precoPromocional: p.preco_promocional == null ? null : Number(p.preco_promocional),
        ultimoPrecoVendido: p.ultimo_preco_vendido == null ? null : Number(p.ultimo_preco_vendido),
      })),
    })
  } catch (error) {
    console.error('Erro ao carregar catálogo para entrada de NF:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo de produtos.' }, { status: 500 })
  }
}
