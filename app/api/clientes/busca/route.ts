import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { autenticarTenant } from '@/lib/tenantServer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLUNAS = 'id,nome,apelido,telefone,whatsapp,cpf_cnpj,email,cidade,bairro,endereco,cep'

export async function GET(req: NextRequest) {
  const usuario = await autenticarTenant(req)
  if (!usuario) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const url = new URL(req.url)
  const id = (url.searchParams.get('id') || '').trim()
  const q = (url.searchParams.get('q') || '').trim()

  if (id) {
    const { data, error } = await supabaseAdmin
      .from('clientes')
      .select(COLUNAS)
      .eq('empresa_id', usuario.empresa_id)
      .eq('id', id)
      .maybeSingle()

    if (error) return NextResponse.json({ error: 'Falha ao localizar cliente' }, { status: 500 })
    return NextResponse.json({ cliente: data || null })
  }

  if (q.length < 2) return NextResponse.json({ clientes: [] })

  const termo = q.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!termo) return NextResponse.json({ clientes: [] })

  const like = `%${termo}%`
  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select(COLUNAS)
    .eq('empresa_id', usuario.empresa_id)
    .or(`nome.ilike.${like},apelido.ilike.${like},telefone.ilike.${like},whatsapp.ilike.${like},cpf_cnpj.ilike.${like},email.ilike.${like},cidade.ilike.${like}`)
    .order('nome')
    .limit(20)

  if (error) return NextResponse.json({ error: 'Falha ao pesquisar clientes' }, { status: 500 })
  return NextResponse.json({ clientes: data || [] })
}
