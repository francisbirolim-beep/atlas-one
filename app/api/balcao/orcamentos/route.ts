import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarBalcao } from '@/lib/balcaoServer'
import { correspondeBuscaAtlas } from '@/lib/buscaAtlas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const usuario = await autenticarBalcao(req, 'venda-balcao', 'consulta')
  if (!usuario) return NextResponse.json({ error: 'Sem acesso aos orçamentos do balcão.' }, { status: 403 })

  try {
    const q = (req.nextUrl.searchParams.get('q') || '').trim()
    const { data, error } = await supabaseAdmin
      .from('orcamentos')
      .select('id,numero,cliente_id,cliente_nome,cliente_whatsapp,cidade,valor_estimado,status,created_at,condicoes,clientes(id,nome,apelido,cpf_cnpj,telefone,whatsapp,email,cidade,bairro,endereco,cep)')
      .eq('modo_entrada', 'balcao')
      .order('created_at', { ascending: false })
      .limit(400)

    if (error) throw error

    const lista = (data || []).filter((o: any) => {
      if (!q) return true
      const c = o.clientes || {}
      return correspondeBuscaAtlas(
        q,
        o.numero,
        o.cliente_nome,
        o.cliente_whatsapp,
        o.cidade,
        o.status,
        o.condicoes,
        c.nome,
        c.apelido,
        c.cpf_cnpj,
        c.telefone,
        c.whatsapp,
        c.email,
        c.cidade,
        c.bairro,
        c.endereco,
        c.cep
      )
    }).slice(0, 120)

    return NextResponse.json({ ok: true, orcamentos: lista })
  } catch (e) {
    console.error('Erro orçamentos balcão', e)
    return NextResponse.json({ error: 'Não foi possível carregar os orçamentos.' }, { status: 500 })
  }
}
