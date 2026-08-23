import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buscarCatalogoProdutos } from '@/lib/nfeEntradaServer'

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
    const produtos = await buscarCatalogoProdutos()
    return NextResponse.json({
      ok: true,
      produtos: produtos.map(p => ({
        id: p.id,
        codigo: p.codigo || p.codigo_origem || p.id_externo_wvetro || '',
        nome: p.nome,
        unidade: p.unidade || null,
        custo: p.custo == null ? null : Number(p.custo),
      })),
    })
  } catch (error) {
    console.error('Erro ao carregar catálogo para entrada de NF:', error)
    return NextResponse.json({ error: 'Não foi possível carregar o catálogo de produtos.' }, { status: 500 })
  }
}
