import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { CADASTRO_INICIAL, CHAVE_CONFIGURADOR, validarCadastro } from '@/lib/configuradorSobMedida'

export const dynamic = 'force-dynamic'

async function perfil(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: usuario } = await supabaseAdmin.from('usuarios').select('id,role,empresa_id').eq('id', data.user.id).maybeSingle()
  return usuario?.empresa_id ? usuario : null
}

export async function GET(req: NextRequest) {
  const usuario = await perfil(req)
  if (!usuario) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 })
  try {
    const [config, linhas] = await Promise.all([
      supabaseAdmin.from('configuracoes_gerais').select('valor').eq('chave', `${CHAVE_CONFIGURADOR}:${usuario.empresa_id}`).eq('empresa_id', usuario.empresa_id).maybeSingle(),
      supabaseAdmin.from('linhas_tecnicas').select('id,nome').eq('ativo', true).order('nome'),
    ])
    if (config.error || linhas.error) throw new Error('Falha ao ler cadastro ou linhas. Tente novamente.')
    const cadastro = config.data ? JSON.parse(config.data.valor) : CADASTRO_INICIAL
    validarCadastro(cadastro)
    return NextResponse.json({ cadastro, linhas: linhas.data || [], master: usuario.role === 'master' })
  } catch (erro) {
    return NextResponse.json({ error: erro instanceof Error ? erro.message : 'Falha ao carregar cadastro.' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const usuario = await perfil(req)
  if (usuario?.role !== 'master') return NextResponse.json({ error: 'Somente o Master pode cadastrar regras.' }, { status: 403 })
  let cadastro: unknown
  try {
    const texto = await req.text()
    if (texto.length > 200000) throw new Error('Cadastro muito grande.')
    cadastro = JSON.parse(texto)
    validarCadastro(cadastro)
  } catch (erro) {
    return NextResponse.json({ error: erro instanceof Error ? erro.message : 'Cadastro inválido.' }, { status: 400 })
  }
  const linhas = await supabaseAdmin.from('linhas_tecnicas').select('id,nome').eq('ativo', true)
  if (linhas.error) return NextResponse.json({ error: 'Não foi possível verificar as linhas.' }, { status: 500 })
  if (cadastro.regras.some(r => r.acao.endsWith('_linha') && !linhas.data.some(l => l.id === r.alvo))) return NextResponse.json({ error: 'Uma regra referencia linha inexistente ou inativa.' }, { status: 400 })
  const { error } = await supabaseAdmin.from('configuracoes_gerais').upsert({
    chave: `${CHAVE_CONFIGURADOR}:${usuario.empresa_id}`, empresa_id: usuario.empresa_id,
    valor: JSON.stringify(cadastro), updated_at: new Date().toISOString(),
  }, { onConflict: 'chave' })
  if (error) return NextResponse.json({ error: 'Não foi possível salvar o cadastro.' }, { status: 500 })
  return NextResponse.json({ cadastro, linhas: linhas.data, master: true })
}
